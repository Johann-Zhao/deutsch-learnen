# -*- coding: utf-8 -*-
"""de.wiktionary.org 共享访问模块：fetch_ipa.py 与 fetch_native_audio.py 共用。

- fetch_wikitext: action=parse&prop=wikitext，磁盘缓存到 tools/.cache/wikitext/
- extract_ipa:   {{IPA}} 后首个 {{Lautschrift|...}}（标准读音；reg./Pl. 变体忽略）
- extract_audio: {{Audio|...}} 模板，优先第一个文件名不含空格的（词条发音优先于例句发音）
"""
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path(__file__).resolve().parent / ".cache" / "wikitext"
API = "https://de.wiktionary.org/w/api.php"
USER_AGENT = "deutsch-lernen/1.0 (personal project; contact: local)"
DELAY = 0.5
RETRIES = 2

ARTICLES = re.compile(r"^(der|die|das|ein|eine|einen|sich)\s+", re.IGNORECASE)
_last_call = [0.0]


def query_word(de):
    """'der Tag' → 'Tag'；'sich freuen' → 'freuen'"""
    return ARTICLES.sub("", de).strip()


def _throttle():
    wait = DELAY - (time.time() - _last_call[0])
    if wait > 0:
        time.sleep(wait)
    _last_call[0] = time.time()


def fetch_wikitext(word):
    """返回词条 wikitext；页面不存在/无内容返回 None。带磁盘缓存。"""
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE / (urllib.parse.quote(word, safe="") + ".txt")
    if cache_file.exists():
        text = cache_file.read_text(encoding="utf-8")
        return text if text else None
    params = ("action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page="
              + urllib.parse.quote(word))
    req = urllib.request.Request(API + "?" + params, headers={"User-Agent": USER_AGENT})
    text = None
    missing = False  # True 仅表示页面确实不存在，可缓存为「无」
    for attempt in range(RETRIES + 1):
        try:
            _throttle()
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode("utf-8"))
            if "parse" in data and data["parse"].get("wikitext"):
                text = data["parse"]["wikitext"]
            else:
                missing = True  # 页面不存在（error 字段）不重试
            break
        except Exception as e:
            if attempt == RETRIES:
                print(f"  ✗ wikitext 获取失败 {word}: {e}", flush=True)
            else:
                time.sleep(1.5 * (attempt + 1))
    if text is None and not missing:
        return None  # 网络/限流失败：不写缓存，重跑可恢复
    cache_file.write_text(text or "", encoding="utf-8")
    return text


def extract_ipa(wikitext):
    """{{IPA}} 后首个 {{Lautschrift|X}}；找不到则取页面首个 Lautschrift；值不含斜杠。"""
    m = re.search(r"\{\{IPA\}\}[^\{]*\{\{Lautschrift\|([^}|]+)", wikitext)
    if not m:
        m = re.search(r"\{\{Lautschrift\|([^}|]+)", wikitext)
    return m.group(1).strip() if m else None


def extract_audio(wikitext):
    """全部 {{Audio|file}} 候选中，优先第一个文件名不含空格的，否则第一个。"""
    files = re.findall(r"\{\{Audio\|([^}|]+)", wikitext)
    if not files:
        return None
    for f in files:
        if " " not in f:
            return f.strip()
    return files[0].strip()
