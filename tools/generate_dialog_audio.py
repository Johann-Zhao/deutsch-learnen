# -*- coding: utf-8 -*-
"""为听力小对话逐行生成德语音频（edge-tts，分角色音色）。

用法：python tools/generate_dialog_audio.py [--limit N] [--ids id1,id2]
- 读取 data/listening.js 的 window.LISTEN_DIALOGS
- 逐行输出 audio/dialog/<dialogueId>-<lineIndex>.mp3（lineIndex 从 0 起）
  角色 A = de-DE-KatjaNeural（女声），角色 B = de-DE-ConradNeural（男声），默认语速 1.0
- 已存在且非空的文件自动跳过（可断点续跑）；请求间隔 ≥1 秒；失败重试 2 次
- 结束后重写 audio/manifest.js：保留所有非本脚本管理的行（通用约定：解析旧 manifest
  全部「window.<NAME> = …」行，只丢弃并重建本脚本负责的 AUDIO_DIALOGS 键，其余行
  ——AUDIO_WORDS / AUDIO_SENTS / AUDIO_CONJ / AUDIO_NATIVE / AUDIO_READING …——原样保留），
  AUDIO_DIALOGS 值为该组「从第 0 行起连续存在」的音频文件数；全部成功时即等于对话行数，
  这样中途中断或个别行失败时前端仍能只播已有音频、其余回退 TTS
"""
import asyncio
import pathlib
import re
import sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICES = {"A": "de-DE-KatjaNeural", "B": "de-DE-ConradNeural"}
RETRIES = 2          # 首次失败后再重试 2 次（共 3 次尝试）
DELAY = 1.0          # 每次请求之间的礼貌间隔（秒）
MANAGED = ("window.AUDIO_DIALOGS",)
HEADER = ("// 由 tools/generate_audio.py、tools/fetch_native_audio.py、"
          "tools/generate_dialog_audio.py 与 tools/generate_reading_audio.py "
          "自动维护，勿手改\n")


def read_kept_lines(manifest_path):
    """保留旧 manifest 中所有「window.<NAME> = …」行里不属于本脚本管理的行（原样、原顺序）。

    通用约定（S7 教训的正式修复，三个音频脚本共用）：每类音频脚本只重建自己负责的键，
    其他任何清单行——现有的与将来新增的——一律原样保留，加新音频类型不再要改旧脚本。
    """
    kept = []
    if manifest_path.exists():
        for ln in manifest_path.read_text(encoding="utf-8").splitlines():
            if ln.startswith("window.") and not ln.startswith(MANAGED):
                kept.append(ln)
    return kept


def load_dialogs():
    """解析 data/listening.js，返回 [(dialogue_id, level, [(sp, text), ...]), ...]"""
    text = (ROOT / "data" / "listening.js").read_text(encoding="utf-8")
    blocks = re.split(r"id:\s*'(dl-[\w-]+)'", text)   # [前言, id1, 块1, id2, 块2, ...]
    dialogs = []
    for i in range(1, len(blocks) - 1, 2):
        did, chunk = blocks[i], blocks[i + 1]
        lv = re.search(r"level:\s*'(A1|A2|B1)'", chunk)
        lines = re.findall(r"\{\s*sp:\s*'([AB])',\s*de:\s*'((?:[^'\\]|\\.)*)'", chunk)
        dialogs.append((did, lv.group(1) if lv else "?", lines))
    return dialogs


def audio_path(did, idx):
    return ROOT / "audio" / "dialog" / f"{did}-{idx}.mp3"


def exists_ok(p):
    return p.exists() and p.stat().st_size > 0


async def gen_one(did, idx, sp, text, failures):
    out = audio_path(did, idx)
    if exists_ok(out):
        return True
    for attempt in range(RETRIES + 1):
        try:
            await edge_tts.Communicate(text, VOICES[sp]).save(str(out))
            await asyncio.sleep(DELAY)
            return True
        except Exception as e:
            if attempt == RETRIES:
                print(f"  [fail] {did}-{idx}: {e}", flush=True)
                failures.append(f"{did}-{idx}")
            else:
                await asyncio.sleep(1.5 * (attempt + 1))
    return False


def available_count(did, n):
    """从第 0 行起连续存在的音频文件数（供 AUDIO_DIALOGS 使用）"""
    count = 0
    while count < n and exists_ok(audio_path(did, count)):
        count += 1
    return count


def build_manifest_text(items, manifest_path):
    """items = [(dialogueId, 可用行数)]；保留所有非本脚本管理的行，重建 AUDIO_DIALOGS 行"""
    kept = read_kept_lines(manifest_path)
    entry = ", ".join(f'"{did}": {n}' for did, n in items)
    return (HEADER + "".join(ln + "\n" for ln in kept)
            + f"window.AUDIO_DIALOGS = {{{entry}}};\n")


def update_manifest(dialogs, path=None):
    """重写 audio/manifest.js：保留所有非本脚本管理的行，更新 AUDIO_DIALOGS 行"""
    path = path or (ROOT / "audio" / "manifest.js")
    items = [(did, available_count(did, len(lines))) for did, _, lines in dialogs]
    items = [(did, n) for did, n in items if n > 0]
    path.write_text(build_manifest_text(items, path), encoding="utf-8")
    print(f"manifest：保留所有非本脚本管理的行，写入 AUDIO_DIALOGS（{len(items)} 组）")


async def main():
    limit = None
    ids = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    if "--ids" in sys.argv:
        ids = set(sys.argv[sys.argv.index("--ids") + 1].split(","))

    dialogs = load_dialogs()
    if not dialogs:
        print("未解析到听力对话数据，请检查 data/listening.js")
        sys.exit(1)
    all_dialogs = dialogs
    if ids:
        unknown = sorted(ids - {d[0] for d in dialogs})
        if unknown:
            print(f"警告：--ids 中不存在的对话 {unknown}")
        dialogs = [d for d in dialogs if d[0] in ids]
    if limit:
        dialogs = dialogs[:limit]
    total = sum(len(lines) for _, _, lines in dialogs)
    print(f"共 {len(dialogs)} 组对话 / {total} 行音频；音色 A={VOICES['A']}、B={VOICES['B']}")

    (ROOT / "audio" / "dialog").mkdir(parents=True, exist_ok=True)

    failures = []
    for did, lv, lines in dialogs:
        for idx, (sp, text) in enumerate(lines):
            await gen_one(did, idx, sp, text, failures)
        print(f"  完成 {lv} {did}（{len(lines)} 行）", flush=True)

    update_manifest(all_dialogs)
    print(f"\n失败 {len(failures)} 行：{'、'.join(failures) if failures else '无'}")
    print("逐组抽查清单（连续可用音频 / 对话行数）：")
    for did, lv, lines in all_dialogs:
        n = available_count(did, len(lines))
        print(f"  [{'ok' if n == len(lines) else '!!'}] {lv} {did}: {n}/{len(lines)}")


if __name__ == "__main__":
    asyncio.run(main())
