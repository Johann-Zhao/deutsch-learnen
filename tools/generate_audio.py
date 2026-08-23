# -*- coding: utf-8 -*-
"""为全部 A1 词汇与例句生成标准德语音频（edge-tts，微软神经语音）。

用法：python tools/generate_audio.py
- 读取 data/vocabulary.js，输出 audio/word/<id>.mp3 与 audio/sent/<id>.mp3
- 生成 audio/manifest.js（已有哪些音频的清单，供网页加载）
- 已存在的文件自动跳过（可断点续跑）
"""
import asyncio
import pathlib
import re
import sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE = "de-DE-KatjaNeural"          # 备选：de-DE-ConradNeural（男声）
CONCURRENCY = 5
RETRIES = 3


def load_items():
    """解析 data/vocabulary*.js 全部文件，返回 [(id, word, sentence), ...]"""
    items = []
    theme_id = None
    index = 0
    for vf in sorted((ROOT / "data").glob("vocabulary*.js")):
        text = vf.read_text(encoding="utf-8")
        for line in text.splitlines():
            m = re.search(r"id:\s*'([\w-]+)'", line)
            if m:
                theme_id = m.group(1)
                index = 0
                continue
            if theme_id and line.lstrip().startswith("['"):
                parts = re.findall(r"'((?:[^'\\]|\\.)*)'", line)
                if len(parts) >= 5:
                    items.append((f"{theme_id}-{index}", parts[0], parts[3]))
                    index += 1
    return items


async def gen_one(sem, tts_maker, kind, wid, txt, done, total):
    out = ROOT / "audio" / kind / f"{wid}.mp3"
    if out.exists() and out.stat().st_size > 0:
        done[0] += 1
        return
    async with sem:
        for attempt in range(RETRIES):
            try:
                await (await tts_maker()).save(str(out))
                done[0] += 1
                if done[0] % 100 == 0:
                    print(f"  进度 {done[0]}/{total}", flush=True)
                return
            except Exception as e:
                if attempt == RETRIES - 1:
                    print(f"  ✗ 失败 {kind}/{wid}: {e}", flush=True)
                else:
                    await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    items = load_items()
    if not items:
        print("未解析到词汇数据")
        sys.exit(1)
    total = len(items) * 2
    print(f"共 {len(items)} 词 × 2（单词+例句）= {total} 个文件，语音 {VOICE}")

    # 变位表音频清单（tools/dump_conj.js 输出）
    import subprocess, json as _json
    conj = []
    try:
        out = subprocess.run(["node", str(ROOT / "tools" / "dump_conj.js")],
                             capture_output=True, text=True, check=True, timeout=30)
        conj = _json.loads(out.stdout)
        total += len(conj)
        print(f"另加变位形式 {len(conj)} 个")
    except Exception as e:
        print(f"（跳过变位音频：{e}）")

    (ROOT / "audio" / "word").mkdir(parents=True, exist_ok=True)
    (ROOT / "audio" / "sent").mkdir(parents=True, exist_ok=True)
    (ROOT / "audio" / "conj").mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(CONCURRENCY)

    def mk(text):
        async def make():
            return edge_tts.Communicate(text, VOICE)
        return make

    done = [0]
    tasks = []
    for wid, word, sent in items:
        tasks.append(gen_one(sem, mk(word), "word", wid, word, done, total))
        tasks.append(gen_one(sem, mk(sent), "sent", wid, sent, done, total))
    for c in conj:
        cid = f"{c['verb']}-{c['idx']}"
        tasks.append(gen_one(sem, mk(c["text"]), "conj", cid, c["text"], done, total))
    await asyncio.gather(*tasks)

    # 写 manifest.js
    word_ids = [wid for wid, _, _ in items
                if (ROOT / "audio" / "word" / f"{wid}.mp3").exists()]
    sent_ids = [wid for wid, _, _ in items
                if (ROOT / "audio" / "sent" / f"{wid}.mp3").exists()]
    conj_ids = [f"{c['verb']}-{c['idx']}" for c in conj
                if (ROOT / "audio" / "conj" / f"{c['verb']}-{c['idx']}.mp3").exists()]
    manifest = ("// 由 tools/generate_audio.py 自动生成，勿手改\n"
                f"window.AUDIO_WORDS = {repr(word_ids).replace(chr(39), chr(34))};\n"
                f"window.AUDIO_SENTS = {repr(sent_ids).replace(chr(39), chr(34))};\n"
                f"window.AUDIO_CONJ = {repr(conj_ids).replace(chr(39), chr(34))};\n")
    (ROOT / "audio" / "manifest.js").write_text(manifest, encoding="utf-8")
    print(f"完成：单词 {len(word_ids)}，例句 {len(sent_ids)}，变位 {len(conj_ids)} → audio/manifest.js")


if __name__ == "__main__":
    asyncio.run(main())
