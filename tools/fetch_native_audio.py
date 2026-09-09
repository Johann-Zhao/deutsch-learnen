# -*- coding: utf-8 -*-
"""从 Wikimedia Commons 抓取真人德语发音（经 de.wiktionary {{Audio}} 模板定位文件名）。

用法：python tools/fetch_native_audio.py [--limit N] [--ids id1,id2]
- ogg/oga 原样保存；其他格式用 ffmpeg 转 ogg（libvorbis q3 单声道 22050Hz，ffmpeg 缺失则跳过该词并提示）
- 产物：audio/native/<wordId>.ogg、audio/credits_native.json、audio/manifest.js 的 AUDIO_NATIVE 行
- 已存在文件自动跳过（断点续跑）；wikitext 经 dewikt 磁盘缓存
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from dewikt import ROOT, USER_AGENT, query_word, fetch_wikitext, extract_audio, _retry_after
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


def _get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    _throttle()
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def imageinfo(filename):
    """返回 (download_url, license, speaker, page_url)；失败返回 None。
    429 尊敬 Retry-After（缺省 15/45/90s），最多重试 RATE_RETRIES 次；
    其他错误沿用 1.5s 倍数退避 RETRIES 次。"""
    params = ("action=query&prop=imageinfo&iiprop=url|extmetadata"
              "&format=json&formatversion=2&titles=" + urllib.parse.quote("File:" + filename))
    err_attempt = 0   # 非 429 错误已重试次数
    rate_attempt = 0  # 429 已重试次数
    while True:
        try:
            data = _get_json(COMMONS_API + "?" + params)
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
        except urllib.error.HTTPError as e:
            if e.code == 429:
                if rate_attempt >= RATE_RETRIES:
                    print(f"  ✗ imageinfo 限流放弃 {filename}: {e}", flush=True)
                    return None
                wait = _retry_after(e, RATE_BACKOFF[min(rate_attempt, len(RATE_BACKOFF) - 1)])
                rate_attempt += 1
                print(f"  … imageinfo 429 限流 {filename}，等待 {wait:.0f}s 重试"
                      f"（{rate_attempt}/{RATE_RETRIES}）", flush=True)
                time.sleep(wait)
            else:
                if err_attempt >= RETRIES:
                    print(f"  ✗ imageinfo 失败 {filename}: {e}", flush=True)
                    return None
                err_attempt += 1
                time.sleep(1.5 * err_attempt)
        except Exception as e:
            if err_attempt >= RETRIES:
                print(f"  ✗ imageinfo 失败 {filename}: {e}", flush=True)
                return None
            err_attempt += 1
            time.sleep(1.5 * err_attempt)


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
            hdr.unlink(missing_ok=True)
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
    hdr.unlink(missing_ok=True)
    raise RuntimeError("curl 下载失败" + (f" (HTTP {code})" if code else "") + ": " + err)


def to_ogg(src, dest):
    """ogg/oga 直接改名；其他格式 ffmpeg 转换。成功返回 True。"""
    ext = src.suffix.lower()
    if ext in (".ogg", ".oga"):
        shutil.move(str(src), str(dest))
        return True
    if not shutil.which("ffmpeg"):
        print("  ✗ 需要 ffmpeg 转码但未安装，跳过", flush=True)
        src.unlink(missing_ok=True)
        return False
    r = subprocess.run(["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "22050",
                        "-c:a", "libvorbis", "-q:a", "3", str(dest)],
                       capture_output=True)
    src.unlink(missing_ok=True)
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
            else:
                miss += 1
        except Exception as e:
            print(f"  ✗ 下载失败 {wid} {filename}: {e}", flush=True)
            tmp.unlink(missing_ok=True)
            miss += 1
        if (i + 1) % 100 == 0:
            print(f"  进度 {i + 1}/{len(items)}，成功 {ok}，无资源 {miss}", flush=True)
    n = update_manifest_and_credits(credits)
    print(f"完成：本次成功 {ok}，无资源 {miss}；AUDIO_NATIVE 共 {n} 条 → audio/manifest.js")


if __name__ == "__main__":
    main()
