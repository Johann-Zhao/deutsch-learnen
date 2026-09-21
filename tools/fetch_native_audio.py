# -*- coding: utf-8 -*-
"""从 Wikimedia Commons 抓取真人德语发音（经 de.wiktionary {{Audio}} 模板定位文件名）。

用法：python tools/fetch_native_audio.py [--limit N] [--ids id1,id2]
- ogg/oga 原样保存；其他格式用 ffmpeg 转 ogg（libvorbis q3 单声道 22050Hz，ffmpeg 缺失则跳过该词并提示）
- 产物：audio/native/<wordId>.ogg、audio/credits_native.json、audio/manifest.js 的 AUDIO_NATIVE 行
- 已存在文件自动跳过（断点续跑）；wikitext 经 dewikt 磁盘缓存
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse

from dewikt import ROOT, USER_AGENT, query_word, fetch_wikitext, extract_audio
from generate_audio import load_items

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
DELAY = 3.0
RETRIES = 2
RATE_RETRIES = 4
RATE_BACKOFF = (15, 45, 90)
NATIVE_DIR = ROOT / "audio" / "native"
CREDITS = ROOT / "audio" / "credits_native.json"
MANIFEST = ROOT / "audio" / "manifest.js"
_last_call = [0.0]


def _throttle():
    wait = DELAY - (time.time() - _last_call[0])
    if wait > 0:
        time.sleep(wait)
    _last_call[0] = time.time()


def _safe_unlink(path):
    """容错删除：Windows 瞬时文件锁（杀软/索引，WinError 32）时 sleep 1s 重试，
    最多 3 次；仍失败打印警告不中断（孤儿 tmp 文件无害，glob *.ogg 会忽略）。"""
    for attempt in range(3):
        try:
            path.unlink(missing_ok=True)
            return
        except PermissionError:
            if attempt < 2:
                time.sleep(1)
    print(f"  ⚠ 临时文件删除失败（忽略）: {path.name}", flush=True)


def _get_json(url, hdr_path):
    """commons API 同样按 TLS 指纹封 Python 客户端（urllib 直接 SSL EOF），改走 curl。
    返回 (http_code, json_data)；响应非 JSON 时 data 为 None。
    响应头 dump 到 hdr_path（供 429 解析 Retry-After）。"""
    _throttle()
    r = subprocess.run(["curl", "-sS", "--max-time", "60", "-A", USER_AGENT,
                        "-D", str(hdr_path), "-w", "%{http_code}", url],
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("curl API 请求失败: " + r.stderr.decode("utf-8", "replace")[:200])
    out = r.stdout.decode("utf-8", "replace")
    code, body = out[-3:], out[:-3]
    try:
        return code, json.loads(body)
    except ValueError:
        return code, None


def imageinfo(filename):
    """返回 (download_url, license, speaker, page_url)；失败返回 None。
    429 尊敬 Retry-After（缺省 15/45/90s），最多重试 RATE_RETRIES 次；
    其他错误沿用 1.5s 倍数退避 RETRIES 次。"""
    params = ("action=query&prop=imageinfo&iiprop=url|extmetadata"
              "&format=json&formatversion=2&titles=" + urllib.parse.quote("File:" + filename))
    fd, hdr_name = tempfile.mkstemp(suffix=".hdr")
    os.close(fd)
    hdr = pathlib.Path(hdr_name)
    err_attempt = 0   # 非 429 错误已重试次数
    rate_attempt = 0  # 429 已重试次数
    try:
        while True:
            try:
                code, data = _get_json(COMMONS_API + "?" + params, hdr)
            except Exception as e:
                if err_attempt >= RETRIES:
                    print(f"  ✗ imageinfo 失败 {filename}: {e}", flush=True)
                    return None
                err_attempt += 1
                time.sleep(1.5 * err_attempt)
                continue
            if code == "429":
                if rate_attempt >= RATE_RETRIES:
                    print(f"  ✗ imageinfo 限流放弃 {filename} (HTTP 429)", flush=True)
                    return None
                wait = _curl_retry_after(hdr, RATE_BACKOFF[min(rate_attempt, len(RATE_BACKOFF) - 1)])
                rate_attempt += 1
                print(f"  … imageinfo 429 限流 {filename}，等待 {wait:.0f}s 重试"
                      f"（{rate_attempt}/{RATE_RETRIES}）", flush=True)
                time.sleep(wait)
                continue
            if code != "200" or not isinstance(data, dict) or "query" not in data:
                if err_attempt >= RETRIES:
                    print(f"  ✗ imageinfo 失败 {filename} (HTTP {code})", flush=True)
                    return None
                err_attempt += 1
                time.sleep(1.5 * err_attempt)
                continue
            page = data["query"]["pages"][0]
            if "imageinfo" not in page:
                return None
            ii = page["imageinfo"][0]
            em = ii.get("extmetadata", {})
            license_ = em.get("LicenseShortName", {}).get("value", "")
            artist = re.sub(r"<[^>]+>", "", em.get("Artist", {}).get("value", "")).strip()
            url = ii["url"].split("?")[0]  # 去掉 utm 跟踪参数
            page_url = "https://commons.wikimedia.org/wiki/" + urllib.parse.quote("File:" + filename)
            return url, license_, artist, page_url
    finally:
        _safe_unlink(hdr)


def _curl_retry_after(hdr_path, fallback):
    """从 curl -D 头部 dump 解析 Retry-After 秒数；缺失/非法用 fallback。"""
    try:
        m = re.search(r"(?im)^Retry-After:\s*([0-9]+)",
                      hdr_path.read_text(encoding="utf-8", errors="replace"))
        if m:
            return max(float(m.group(1)), 0.0)
    except Exception:
        pass
    return float(fallback)


def download(url, dest_tmp):
    """upload.wikimedia.org 按 TLS 指纹封 Python HTTP 客户端（urllib/requests 均 429，
    curl 正常），故经系统 curl 下载。
    HTTP 429：尊敬 Retry-After（缺省 15/45/90s），最多重试 RATE_RETRIES 次；
    非 429 失败：5s/10s 退避 RETRIES 次。"""
    hdr = dest_tmp.with_name(dest_tmp.name + ".hdr")
    err = ""
    rate_attempt = 0  # 429 已重试次数
    err_attempt = 0   # 非 429 失败已重试次数
    while True:
        _throttle()
        r = subprocess.run(["curl", "-sS", "-f", "--max-time", "120", "-A", USER_AGENT,
                            "-D", str(hdr), "-w", "%{http_code}",
                            "-o", str(dest_tmp), url], capture_output=True)
        code = r.stdout.decode("ascii", "replace").strip()[-3:]
        if r.returncode == 0:
            _safe_unlink(hdr)
            return
        err = r.stderr.decode("utf-8", "replace")[:200]
        if code == "429":
            if rate_attempt >= RATE_RETRIES:
                break
            wait = _curl_retry_after(hdr, RATE_BACKOFF[min(rate_attempt, len(RATE_BACKOFF) - 1)])
            rate_attempt += 1
            print(f"  … 下载 429 限流，等待 {wait:.0f}s 重试"
                  f"（{rate_attempt}/{RATE_RETRIES}）", flush=True)
            time.sleep(wait)
        else:
            if err_attempt >= RETRIES:
                break
            err_attempt += 1
            time.sleep(5 * err_attempt)
    _safe_unlink(hdr)
    raise RuntimeError("curl 下载失败" + (f" (HTTP {code})" if code else "") + ": " + err)


def to_ogg(src, dest):
    """ogg/oga 直接改名；其他格式 ffmpeg 转换。成功返回 True。"""
    ext = src.suffix.lower()
    if ext in (".ogg", ".oga"):
        shutil.move(str(src), str(dest))
        return True
    if not shutil.which("ffmpeg"):
        print("  ✗ 需要 ffmpeg 转码但未安装，跳过", flush=True)
        _safe_unlink(src)
        return False
    r = subprocess.run(["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "22050",
                        "-c:a", "libvorbis", "-q:a", "3", str(dest)],
                       capture_output=True)
    _safe_unlink(src)
    return r.returncode == 0 and dest.exists() and dest.stat().st_size > 0


def update_manifest_and_credits(credits):
    """按 audio/native/ 实际文件重写 AUDIO_NATIVE 行与 credits 文件。"""
    native = {}
    for f in sorted(NATIVE_DIR.glob("*.ogg")):
        native[f.stem] = "native/" + f.name
    lines = MANIFEST.read_text(encoding="utf-8").splitlines()
    lines = [ln for ln in lines if not ln.startswith("window.AUDIO_NATIVE")]
    lines.append("window.AUDIO_NATIVE = " + json.dumps(native, ensure_ascii=False) + ";")
    MANIFEST.write_text("\n".join(lines) + "\n", encoding="utf-8")
    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(native)


def main():
    if not shutil.which("curl"):
        print("需要 curl")
        sys.exit(1)
    limit = None
    ids = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    if "--ids" in sys.argv:
        ids = set(sys.argv[sys.argv.index("--ids") + 1].split(","))
    items = load_items()
    if ids:
        items = [it for it in items if it[0] in ids]
    if limit:
        items = items[:limit]
    NATIVE_DIR.mkdir(parents=True, exist_ok=True)
    for stale in NATIVE_DIR.glob("*.tmp.*"):
        _safe_unlink(stale)
    credits = {}
    if CREDITS.exists():
        credits = json.loads(CREDITS.read_text(encoding="utf-8"))
    print(f"共 {len(items)} 词待查真人发音（已有 {len(credits)} 词记录）")
    ok = miss = 0
    for i, (wid, word, _sent) in enumerate(items):
        dest = NATIVE_DIR / (wid + ".ogg")
        if dest.exists() and dest.stat().st_size > 0 and wid in credits:
            ok += 1
            continue
        wt = fetch_wikitext(query_word(word))
        filename = extract_audio(wt) if wt else None
        if filename:
            filename = re.sub(r"[‎‏‪-‮⁦-⁩﻿]", "", filename)
        info = imageinfo(filename) if filename else None
        if not info:
            miss += 1
            continue
        url, license_, artist, page_url = info
        ext = pathlib.Path(urllib.parse.urlparse(url).path).suffix or ".ogg"
        tmp = NATIVE_DIR / (wid + ".tmp" + ext)
        try:
            download(url, tmp)
            if to_ogg(tmp, dest):
                credits[wid] = {"file": filename, "speaker": artist,
                                "license": license_, "url": page_url}
                ok += 1
                update_manifest_and_credits(credits)
            else:
                miss += 1
        except Exception as e:
            print(f"  ✗ 下载失败 {wid} {filename}: {e}", flush=True)
            _safe_unlink(tmp)
            miss += 1
        if (i + 1) % 100 == 0:
            print(f"  进度 {i + 1}/{len(items)}，成功 {ok}，无资源 {miss}", flush=True)
    n = update_manifest_and_credits(credits)
    print(f"完成：本次成功 {ok}，无资源 {miss}；AUDIO_NATIVE 共 {n} 条 → audio/manifest.js")


if __name__ == "__main__":
    main()
