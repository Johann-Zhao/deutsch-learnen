# -*- coding: utf-8 -*-
"""为阅读短文生成整篇朗读音频（edge-tts，S8 阅读模块）。

用法：python tools/generate_reading_audio.py [--limit N] [--ids id1,id2]
- 读取 data/reading.js 的 window.READING_TEXTS，每篇纯文本（tokens 的 w 以空格连接）
  → edge-tts de-DE-KatjaNeural（单声部叙述，与听力对话音色体系一致），默认语速
  → audio/reading/<id>.mp3（整篇一个文件）
- 已存在且非空的文件自动跳过（可断点续跑）；请求间隔 ≥1 秒；失败重试 2 次
- 结束后重写 audio/manifest.js：用通用保留逻辑——保留所有非本脚本管理的行
  （AUDIO_WORDS / AUDIO_SENTS / AUDIO_CONJ / AUDIO_NATIVE / AUDIO_DIALOGS …），
  只重建自己负责的 AUDIO_READING 行（值为实际已生成 mp3 的篇目 id，按文本顺序）
"""
import asyncio
import json
import pathlib
import re
import sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE = "de-DE-KatjaNeural"   # 单声部叙述；与听力模块角色 A 同音色
RETRIES = 2                   # 首次失败后再重试 2 次（共 3 次尝试）
DELAY = 1.0                   # 每次请求之间的礼貌间隔（秒）
MANAGED = ("window.AUDIO_READING",)
HEADER = ("// 由 tools/generate_audio.py、tools/fetch_native_audio.py、"
          "tools/generate_dialog_audio.py 与 tools/generate_reading_audio.py "
          "自动维护，勿手改\n")


def load_texts():
    """解析 data/reading.js → [(id, 纯文本)]（JSON 格式："id": "rd-…"）"""
    text = (ROOT / "data" / "reading.js").read_text(encoding="utf-8")
    blocks = re.split(r'"id":\s*"(rd-[\w-]+)"', text)  # [前言, id1, 块1, ...]
    out = []
    for i in range(1, len(blocks) - 1, 2):
        rid, chunk = blocks[i], blocks[i + 1]
        words = re.findall(r'"w":\s*"((?:[^"\\]|\\.)*)"', chunk)
        out.append((rid, plain_text(words)))
    return out


def plain_text(words):
    """tokens 的 w 以空格连接；标点贴紧前文，德语开引号贴紧后文（TTS 友好）"""
    s = " ".join(words)
    s = re.sub(r"\s+([,.!?:;])", r"\1", s)      # 逗号句号等贴前
    s = re.sub(r"([„(])\s+", r"\1", s)          # 开引号/括号贴后
    s = re.sub(r"\s+([”’])", r"\1", s)          # 闭引号贴前
    return s


def read_kept_lines(manifest_path):
    """保留旧 manifest 中所有「window.<NAME> = …」行里不属于本脚本管理的行（原样、原顺序）。"""
    kept = []
    if manifest_path.exists():
        for ln in manifest_path.read_text(encoding="utf-8").splitlines():
            if ln.startswith("window.") and not ln.startswith(MANAGED):
                kept.append(ln)
    return kept


def build_manifest_text(ids, manifest_path):
    kept = read_kept_lines(manifest_path)
    return (HEADER + "".join(ln + "\n" for ln in kept)
            + "window.AUDIO_READING = " + json.dumps(ids, ensure_ascii=False) + ";\n")


def audio_path(rid):
    return ROOT / "audio" / "reading" / f"{rid}.mp3"


def exists_ok(p):
    return p.exists() and p.stat().st_size > 0


async def gen_one(rid, text, failures):
    out = audio_path(rid)
    if exists_ok(out):
        return True
    for attempt in range(RETRIES + 1):
        try:
            await edge_tts.Communicate(text, VOICE).save(str(out))
            await asyncio.sleep(DELAY)
            return True
        except Exception as e:
            if attempt == RETRIES:
                print(f"  [fail] {rid}: {e}", flush=True)
                failures.append(rid)
            else:
                await asyncio.sleep(1.5 * (attempt + 1))
    return False


async def main():
    limit = None
    ids = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    if "--ids" in sys.argv:
        ids = set(sys.argv[sys.argv.index("--ids") + 1].split(","))

    texts = load_texts()
    if not texts:
        print("未解析到阅读数据，请检查 data/reading.js")
        sys.exit(1)
    all_texts = texts
    if ids:
        unknown = sorted(ids - {t[0] for t in texts})
        if unknown:
            print(f"警告：--ids 中不存在的篇目 {unknown}")
        texts = [t for t in texts if t[0] in ids]
    if limit:
        texts = texts[:limit]
    print(f"共 {len(texts)} 篇朗读；音色 {VOICE}（单声部叙述）")

    (ROOT / "audio" / "reading").mkdir(parents=True, exist_ok=True)

    failures = []
    for rid, text in texts:
        await gen_one(rid, text, failures)
        print(f"  完成 {rid}", flush=True)

    manifest_path = ROOT / "audio" / "manifest.js"
    done_ids = [rid for rid, _ in all_texts if exists_ok(audio_path(rid))]
    manifest_path.write_text(build_manifest_text(done_ids, manifest_path),
                             encoding="utf-8")
    print(f"manifest：保留所有非本脚本管理的行，写入 AUDIO_READING（{len(done_ids)} 篇）")
    print(f"\n失败 {len(failures)} 篇：{'、'.join(failures) if failures else '无'}")


if __name__ == "__main__":
    asyncio.run(main())
