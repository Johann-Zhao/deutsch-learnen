# S6 发音与音标增强 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。逐步实现，每任务结束提交。步骤用 checkbox 跟踪。

**Goal:** 按 `docs/superpowers/specs/2026-09-08-pronunciation-ipa-design.md` 实现：真人发音管道（de.wiktionary → Wikimedia Commons）+ IPA 音标（仅学习场景）+ 词卡 0.5× 慢速按钮 + 设置页署名。

**Architecture:** 两个 Python 管道脚本（共享 `tools/dewikt.py` 缓存模块）产出 `audio/native/*.ogg`、`audio/credits_native.json`、`audio/manifest.js` 新增 `AUDIO_NATIVE`、`data/ipa.js`（`window.WORD_IPA`）；前端 `src/audio.js` 改真人优先回退链并支持一次性 rate，`src/ui.js` 新增 `slowBtn`，`src/vocabulary.js`/`src/views.js` 接线显示。SRS/存储/现有数据文件零改动。

**Tech Stack:** Python 3（urllib，无新依赖）+ ffmpeg（本机已装 v8.1.1）；前端原生 ESM JS（src/ → esbuild → js/bundle.js）；Node 原生 assert 单测（tests/run.js）。

## Global Constraints

- 分支 `phase/s6-pronunciation`（Task 1 从 main 新建）；提交规范 `类型(范围): 中文描述`。
- `npm test`（node tests/run.js）必须全绿（当前 57 项）；新逻辑追加测试，不新建测试文件。
- 子代理**不 git commit、不跑 build**；改 `src/` 后由主代理统一 `npm run build` 与提交。
- 子代理只做本任务文件，不动 README/CHANGELOG/AGENTS.md/DESIGN.md/spec。
- **模型分工（本会话规则）**：任务头标注模型——`deepseek` = deepseek/deepseek-v4.1-flash-expires-on-0910（简单任务）；`primary` = 主模型 K3（较难任务）。
- 数据格式约束：`data/vocabulary*.js`、`data/grammar*.js` 零改动；`audio/manifest.js`、`audio/credits_native.json`、`data/ipa.js` 均为脚本自动生成，头部注明勿手改。
- UI 遵守 DESIGN.md：zine 纸感、词性三色仅小面积、动效 ≤300ms、按钮写明结果；新元素复用现有 class（`speak-btn`、`stat-label`、`micro`），不发明新视觉语言。
- 网络礼貌：API 请求间隔 ≥0.5s，带 UA 头，失败重试 2 次；wikitext 结果缓存到 `tools/.cache/`（断点续跑）。
- file:// 双击可用是硬约束：不引入动态 import()。

## 现状锚点（已核实）

- `src/audio.js`：`play(kind,id,fallbackText)`（L18-31）按 set 命中播 `audio/<dir>/<id>.mp3`，`a.playbackRate = rate`（模块级 rate，L24）；未命中回退 `TTS.speak(fallbackText)`。`buildSets()`（L9-16）从 `data.js` 的 `getAudioWords/getAudioSents/getAudioConj` 建 Set。
- `src/tts.js`：模块级 `let rate = 1.0`（L4）；`speak` 内 `u.rate = rate`（L34）；`setRate`（L26）。
- `src/data.js`：`getAudioWords()`（L19）等读 `window.AUDIO_WORDS` 等全局；`wordById`（L72）。
- `src/ui.js`：`speakBtn(text, kind, id, cls)`（L21-32）——word 时 `audio.playWord(id, text)`。
- `src/vocabulary.js`：`wordCard`（L45-66，L55 `de.appendChild(speakBtn(w.de,'word',w.id))`，L64 挂 `detailDrawer(w)`）；`detailDrawer`（L76-103，L83-84 首个 word-detail-row 是 词性+级别+释义）；学新词介绍 `showIntro`（L261）；加强步 listen 播放钮（L468-472 区域 `play.onclick`）、spell 步播放钮（L503-507 区域 `play2`）；复习 `show()` listen/dict 播放钮（L795-800 区域）。import 块 L8-11（从 data.js 导入，含 `getImageWords`）。
- `src/views.js`：设置页「学习统计」卡片 `cStat`（L193 起）；语速下拉在 L167-175。
- `index.html`：script 标签在 L41-45（data 与 manifest 静态加载，`js/bundle.js` defer）。
- `tools/generate_audio.py`：`load_items()`（L22-40）返回 `[(wordId, word, sentence), ...]`；manifest 写出在 L104-115（会整文件覆盖，需保留 AUDIO_NATIVE 行，见 Task 2）。
- 实测 API（2026-09-08）：de.wiktionary `action=parse&prop=wikitext&format=json&formatversion=2&page=Haus&redirects=1` 返回 wikitext，含 `{{IPA}} {{Lautschrift|haʊ̯s}}` 与 `{{Audio|De-Haus.ogg}}`；Commons `action=query&titles=File:De-Haus.ogg&prop=imageinfo&iiprop=url|extmetadata&format=json&formatversion=2` 返回 `url`、`extmetadata.LicenseShortName.value`（如 "CC BY-SA 3.0"）、`extmetadata.Artist.value`（含 HTML）。Kaikki 逐词 JSON 已验证 404 不可用。

---

### Task 1: wiktionary 共享模块 + IPA 管道

**模型：deepseek**

**Files:**
- Create: `tools/dewikt.py`
- Create: `tools/fetch_ipa.py`
- Create: `data/ipa.js`（运行脚本生成）
- Modify: `index.html:41-45`（加一行 script）
- Modify: `.gitignore`（追加 `tools/.cache/`）

**Interfaces:**
- Produces（Task 2 依赖）：
  - `dewikt.query_word(de: str) -> str`：去冠词/反身词干。
  - `dewikt.fetch_wikitext(word: str) -> str | None`：带磁盘缓存 `tools/.cache/wikitext/<urlencode(word)>.txt`；页面不存在返回 None。
  - `dewikt.extract_ipa(wikitext: str) -> str | None`。
  - `dewikt.extract_audio(wikitext: str) -> str | None`（本任务实现，Task 2 使用）。
  - `dewikt.USER_AGENT`：`'deutsch-lernen/1.0 (personal project; contact: local)'`。
- Produces（前端依赖）：`data/ipa.js` 定义 `window.WORD_IPA`（Object.assign push 式），值**不带斜杠**（如 `"haʊ̯s"`）。

- [ ] **Step 0: 建分支（主代理已建则跳过确认）**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目"
git checkout -b phase/s6-pronunciation
```

- [ ] **Step 1: 写 `tools/dewikt.py`**

```python
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
    for attempt in range(RETRIES + 1):
        try:
            _throttle()
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode("utf-8"))
            if "parse" in data and data["parse"].get("wikitext"):
                text = data["parse"]["wikitext"]
            break  # 页面不存在（error 字段）不重试
        except Exception as e:
            if attempt == RETRIES:
                print(f"  ✗ wikitext 获取失败 {word}: {e}", flush=True)
            else:
                time.sleep(1.5 * (attempt + 1))
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
```

- [ ] **Step 2: 冒烟验证 dewikt（真实网络，3 个词）**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目/tools"
python -c "from dewikt import fetch_wikitext, extract_ipa, extract_audio, query_word; \
wt = fetch_wikitext('Haus'); print('ipa:', extract_ipa(wt)); print('audio:', extract_audio(wt)); \
wt2 = fetch_wikitext('Tag'); print('ipa2:', extract_ipa(wt2)); \
print('query:', query_word('der Tag'), query_word('sich freuen'))"
```

预期输出类似：`ipa: haʊ̯s` / `audio: De-Haus.ogg` / `query: Tag freuen`。任一不符则修 dewikt 后再继续。

- [ ] **Step 3: 写 `tools/fetch_ipa.py`**

```python
# -*- coding: utf-8 -*-
"""从 de.wiktionary 抓取全部词汇的 IPA 音标，生成 data/ipa.js。

用法：python tools/fetch_ipa.py [--limit N]
- 复用 generate_audio.load_items() 取得全部 (wordId, word, sentence)
- 查不到的词不写条目（前端不显示，宁缺毋滥）；wikitext 经 dewikt 磁盘缓存，可断点续跑
"""
import json
import sys

from dewikt import ROOT, query_word, fetch_wikitext, extract_ipa
from generate_audio import load_items


def write_ipa_js(mapping):
    lines = ["// 由 tools/fetch_ipa.py 自动生成，勿手改",
             "window.WORD_IPA = window.WORD_IPA || {};",
             "Object.assign(window.WORD_IPA, {"]
    for wid in sorted(mapping):
        lines.append("  %s: %s," % (json.dumps(wid), json.dumps(mapping[wid], ensure_ascii=False)))
    lines.append("});")
    out = ROOT / "data" / "ipa.js"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def main():
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    items = load_items()
    if limit:
        items = items[:limit]
    print(f"共 {len(items)} 词待查 IPA")
    mapping = {}
    miss = []
    for i, (wid, word, _sent) in enumerate(items):
        wt = fetch_wikitext(query_word(word))
        ipa = extract_ipa(wt) if wt else None
        if ipa:
            mapping[wid] = ipa
        else:
            miss.append(wid)
        if (i + 1) % 100 == 0:
            print(f"  进度 {i + 1}/{len(items)}，命中 {len(mapping)}", flush=True)
    out = write_ipa_js(mapping)
    print(f"完成：{len(mapping)}/{len(items)} 词有 IPA → {out}")
    print(f"未命中 {len(miss)} 个：{' '.join(miss[:20])}{' ...' if len(miss) > 20 else ''}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 运行小样验证**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目/tools"
python fetch_ipa.py --limit 20
```

预期：生成 `data/ipa.js`，命中率 ≥15/20；文件头含「勿手改」注释；`window.WORD_IPA` 结构正确。

- [ ] **Step 5: `index.html` 引入 + `.gitignore`**

`index.html` L42（`<script src="data/grammar.js"></script>` 之后）插入：

```html
<script src="data/ipa.js"></script>
```

`.gitignore` 追加一行：

```
tools/.cache/
```

- [ ] **Step 6: 交接**

不 commit。报告：生成的 ipa.js 条目数、未命中词列表、index.html/.gitignore 改动。

---

### Task 2: 真人发音抓取管道

**模型：primary**（双 API + ffmpeg + manifest 兼容性，较难）

**Files:**
- Create: `tools/fetch_native_audio.py`
- Create: `audio/native/`（运行产物目录）
- Modify: `tools/generate_audio.py:104-115`（manifest 写出处保留 AUDIO_NATIVE 行）
- Modify: `audio/manifest.js`（脚本自动更新，勿手改）
- Create: `audio/credits_native.json`（脚本自动生成，勿手改）

**Interfaces:**
- Consumes：`dewikt.query_word / fetch_wikitext / extract_audio / USER_AGENT`（Task 1）；`generate_audio.load_items`。
- Produces：`window.AUDIO_NATIVE`（`audio/manifest.js` 内新增行，结构 `{ "greet-0": "native/greet-0.ogg", ... }`）——Task 3 的 `getAudioNative()` 读取它。`audio/credits_native.json`：`{ wordId: { file, speaker, license, url } }`。

- [ ] **Step 1: 写 `tools/fetch_native_audio.py`**

```python
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
import urllib.parse
import urllib.request

from dewikt import ROOT, USER_AGENT, query_word, fetch_wikitext, extract_audio
from generate_audio import load_items

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
DELAY = 0.5
RETRIES = 2
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
    """返回 (download_url, license, speaker, page_url)；失败返回 None。"""
    params = ("action=query&prop=imageinfo&iiprop=url|extmetadata"
              "&format=json&formatversion=2&titles=" + urllib.parse.quote("File:" + filename))
    for attempt in range(RETRIES + 1):
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
        except Exception as e:
            if attempt == RETRIES:
                print(f"  ✗ imageinfo 失败 {filename}: {e}", flush=True)
                return None
            time.sleep(1.5 * (attempt + 1))
    return None


def download(url, dest_tmp):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    _throttle()
    with urllib.request.urlopen(req, timeout=120) as r, open(dest_tmp, "wb") as f:
        shutil.copyfileobj(r, f)


def to_ogg(src, dest):
    """ogg/oga 直接改名；其他格式 ffmpeg 转换。成功返回 True。"""
    ext = src.suffix.lower()
    if ext in (".ogg", ".oga"):
        shutil.move(str(src), str(dest))
        return True
    if not shutil.which("ffmpeg"):
        print("  ✗ 需要 ffmpeg 转码但未安装，跳过", flush=True)
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
```

- [ ] **Step 2: 修改 `tools/generate_audio.py` 保留 AUDIO_NATIVE 行**

`tools/generate_audio.py` L104-115 写 manifest 处，在写文件前读取旧 manifest 中的 `window.AUDIO_NATIVE` 行并附加：

```python
    # 写 manifest.js
    word_ids = [wid for wid, _, _ in items
                if (ROOT / "audio" / "word" / f"{wid}.mp3").exists()]
    sent_ids = [wid for wid, _, _ in items
                if (ROOT / "audio" / "sent" / f"{wid}.mp3").exists()]
    conj_ids = [f"{c['verb']}-{c['idx']}" for c in conj
                if (ROOT / "audio" / "conj" / f"{c['verb']}-{c['idx']}.mp3").exists()]
    # 保留 fetch_native_audio.py 生成的 AUDIO_NATIVE 行（本脚本不管理真人发音）
    native_line = ""
    old_manifest = ROOT / "audio" / "manifest.js"
    if old_manifest.exists():
        for ln in old_manifest.read_text(encoding="utf-8").splitlines():
            if ln.startswith("window.AUDIO_NATIVE"):
                native_line = ln + "\n"
    manifest = ("// 由 tools/generate_audio.py 自动生成，勿手改\n"
                f"window.AUDIO_WORDS = {repr(word_ids).replace(chr(39), chr(34))};\n"
                f"window.AUDIO_SENTS = {repr(sent_ids).replace(chr(39), chr(34))};\n"
                f"window.AUDIO_CONJ = {repr(conj_ids).replace(chr(39), chr(34))};\n"
                ) + native_line
    (ROOT / "audio" / "manifest.js").write_text(manifest, encoding="utf-8")
```

- [ ] **Step 3: 小样验证（真实网络，10 个词）**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目/tools"
python fetch_native_audio.py --limit 10
ls -la ../audio/native/ && head -c 300 ../audio/credits_native.json && grep -c "AUDIO_NATIVE" ../audio/manifest.js
```

预期：`audio/native/` 有 ≥5 个非空 .ogg；`credits_native.json` 每条含 file/speaker/license/url；manifest 恰 1 行 AUDIO_NATIVE 且 JSON 可解析。抽查一个文件：`ffprobe -hide_banner ../audio/native/greet-0.ogg 2>&1 | head -3` 显示 vorbis 音频。

- [ ] **Step 4: 回归验证 manifest 兼容**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目"
node -e "global.window={};require('fs');eval(require('fs').readFileSync('audio/manifest.js','utf8'));console.log(Object.keys(window.AUDIO_NATIVE).length, window.AUDIO_WORDS.length, window.AUDIO_SENTS.length, window.AUDIO_CONJ.length)"
```

预期：4 个数字均 >0。

- [ ] **Step 5: 交接**

不 commit。报告：native 文件数、命中率、manifest/credits 状态、generate_audio.py 改动位置。

---

### Task 3: 前端真人发音回退链 + 一次性语速

**模型：primary**（核心播放路径，TDD）

**Files:**
- Modify: `src/data.js`（L19 附近追加 `getAudioNative`）
- Modify: `src/audio.js`（全文重写播放层）
- Modify: `src/tts.js`（speak 支持一次性 rate）
- Test: `tests/run.js`（追加用例）

**Interfaces:**
- Consumes：`window.AUDIO_NATIVE`（Task 2 的 manifest 行；缺失时 `getAudioNative()` 返回 `{}`）。
- Produces：
  - `getAudioNative() -> { [wordId]: "native/<file>.ogg" }`（data.js）
  - `pickWordSrc(id, native, wordSet) -> string | null`（audio.js，纯函数）
  - `resolveRate(oneShot, global) -> number`（audio.js，纯函数）
  - `audio.playWord(id, fallbackText, opts?)`：`opts.rate` 一次性语速，不改全局
  - `TTS.speak(text, r?)`：第二参可选，缺省用全局 rate（tts.js）
  - `audio.hasWord(id)` 语义扩展：native 或 mp3 任一存在即 true（Task 5 依赖）

- [ ] **Step 1: 写失败测试（tests/run.js 追加）**

import 区（文件头部，L10 之后）追加：

```js
import { pickWordSrc, resolveRate } from '../src/audio.js';
import { getWordIpa } from '../src/data.js';
```

文件末尾（结果打印之前）追加：

```js
console.log('\n真人发音回退链与一次性语速：');
test('pickWordSrc：真人发音优先于 TTS 预生成', function () {
  const native = { 'greet-0': 'native/greet-0.ogg' };
  const words = new Set(['greet-0', 'greet-1']);
  assert.strictEqual(pickWordSrc('greet-0', native, words), 'audio/native/greet-0.ogg');
});
test('pickWordSrc：无真人发音回退到 word mp3', function () {
  const words = new Set(['greet-1']);
  assert.strictEqual(pickWordSrc('greet-1', {}, words), 'audio/word/greet-1.mp3');
  assert.strictEqual(pickWordSrc('greet-1', null, words), 'audio/word/greet-1.mp3');
});
test('pickWordSrc：都没有返回 null', function () {
  assert.strictEqual(pickWordSrc('x-9', {}, new Set()), null);
});
test('resolveRate：一次性 rate 覆盖全局，缺省用全局', function () {
  assert.strictEqual(resolveRate(0.5, 1), 0.5);
  assert.strictEqual(resolveRate(undefined, 0.9), 0.9);
  assert.strictEqual(resolveRate(null, 0.75), 0.75);
});
test('getWordIpa：命中返回音标，缺失返回 null', function () {
  globalThis.window = { WORD_IPA: { 'greet-0': 'ˈtaːk' } };
  try {
    assert.strictEqual(getWordIpa('greet-0'), 'ˈtaːk');
    assert.strictEqual(getWordIpa('greet-9'), null);
  } finally {
    delete globalThis.window;
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目" && node tests/run.js
```

预期：报 `pickWordSrc is not exported` / `getWordIpa is not exported` 类错误。

- [ ] **Step 3: `src/data.js` 追加两个访问器**

在 `getAudioConj()`（L29-32）之后插入：

```js
export function getAudioNative() {
  return (typeof window !== 'undefined' && window.AUDIO_NATIVE) || {};
}

export function getWordIpa(id) {
  const m = (typeof window !== 'undefined' && window.WORD_IPA) || {};
  return m[id] || null;
}
```

- [ ] **Step 4: `src/tts.js` speak 支持一次性 rate**

把 speak 改为（保持其余逻辑不变）：

```js
  speak: function (text, r) {
    // ...
    u.rate = typeof r === 'number' ? r : rate;
    // ...
  },
```

（仅改动 `u.rate = rate;` 一行为 `u.rate = typeof r === 'number' ? r : rate;`，并给 speak 函数加第二形参 `r`。）

- [ ] **Step 5: `src/audio.js` 重写播放层**

```js
/* 音频播放层：真人发音（audio/native/，Wikimedia Commons）优先，
   其次 edge-tts 预生成 mp3（audio/word|sent|conj/），
   清单都没有的词回退浏览器 speechSynthesis */

import { TTS } from './tts.js';
import { getAudioWords, getAudioSents, getAudioConj, getAudioNative } from './data.js';

let wordSet = null, sentSet = null, conjSet = null, nativeMap = null, current = null, rate = 1;

function buildSets() {
  const words = getAudioWords();
  const sents = getAudioSents();
  const conjs = getAudioConj();
  const native = getAudioNative();
  if (words.length) wordSet = new Set(words);
  if (sents.length) sentSet = new Set(sents);
  if (conjs.length) conjSet = new Set(conjs);
  if (Object.keys(native).length) nativeMap = native;
}

/* 纯函数：决定单词音频播放来源（真人发音 > TTS 预生成 > null=交给 TTS 引擎） */
export function pickWordSrc(id, native, wordSet) {
  if (native && native[id]) return 'audio/' + native[id];
  if (wordSet && wordSet.has(id)) return 'audio/word/' + id + '.mp3';
  return null;
}

/* 纯函数：一次性语速覆盖全局语速 */
export function resolveRate(oneShot, global) {
  return typeof oneShot === 'number' ? oneShot : global;
}

function playUrl(url, r, fallbackText) {
  stop();
  const a = new Audio(url);
  a.playbackRate = r;
  current = a;
  a.play().catch(function () { TTS.speak(fallbackText, r); });
  return true;
}

function play(kind, id, fallbackText, oneShotRate) {
  const r = resolveRate(oneShotRate, rate);
  if (kind === 'word') {
    const url = pickWordSrc(id, nativeMap, wordSet);
    if (url) return playUrl(url, r, fallbackText);
    TTS.speak(fallbackText, r);
    return false;
  }
  const set = kind === 'sent' ? sentSet : conjSet;
  const dir = kind === 'conj' ? 'conj' : kind;
  if (set && set.has(id)) return playUrl('audio/' + dir + '/' + id + '.mp3', r, fallbackText);
  TTS.speak(fallbackText, r);
  return false;
}

export function stop() {
  if (current) { try { current.pause(); } catch (e) {} current = null; }
  TTS.stop();
}

export function init() {
  buildSets();
}

export const audio = {
  init: init,
  hasWord: function (id) { return !!((nativeMap && nativeMap[id]) || (wordSet && wordSet.has(id))); },
  hasSentence: function (id) { return !!(sentSet && sentSet.has(id)); },
  hasConj: function (id) { return !!(conjSet && conjSet.has(id)); },
  playWord: function (id, fallbackText, opts) { return play('word', id, fallbackText, opts && opts.rate); },
  playSentence: function (id, fallbackText, opts) { return play('sent', id, fallbackText, opts && opts.rate); },
  playConj: function (id, fallbackText, opts) { return play('conj', id, fallbackText, opts && opts.rate); },
  setRate: function (r) { rate = r; },
  stop: stop
};

if (typeof document !== 'undefined' && document.readyState !== 'loading') buildSets();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', buildSets);
```

- [ ] **Step 6: 跑测试确认通过**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目" && node tests/run.js
```

预期：57+5=62 项全绿。

- [ ] **Step 7: 交接**

不 commit、不 build。报告改动文件与测试结果。

---

### Task 4: IPA 音标显示（仅学习场景）

**模型：deepseek**

**Files:**
- Modify: `src/vocabulary.js`（wordCard L54-56 区域、detailDrawer L83-84 区域；import 块 L8-11）
- Modify: `css/style.css`（追加 `.word-ipa` 一条规则）

**Interfaces:**
- Consumes：`getWordIpa(id)`（Task 3，data.js）。
- Produces：无新接口。复习页/图片题/拼写题**不得**出现 IPA。

- [ ] **Step 1: import 追加**

`src/vocabulary.js` L8-11 的 data.js import 块中，在 `getImageWords, getImageCovers` 后追加 `getWordIpa`：

```js
import {
  currentLevel, getVocabThemes, allWords, wordsOfLevel, wordById,
  loadLevelData, isLevelLoaded, inferLevelFromId, themeLevels, getImageWords, getImageCovers,
  getWordIpa
} from './data.js';
```

- [ ] **Step 2: wordCard 显示 IPA**

`src/vocabulary.js` wordCard 中（L54-56 区域），在 `c.appendChild(de);` 之后、`c.appendChild(UI.el('div', 'word-zh', ...))` 之前插入：

```js
  const ipa = getWordIpa(w.id);
  if (ipa) c.appendChild(UI.el('div', 'word-ipa stat-label', '/' + UI.esc(ipa) + '/'));
```

- [ ] **Step 3: detailDrawer 显示 IPA**

detailDrawer（L83-84 区域），在首个 `word-detail-row`（genderTag + 级别 + 释义那行）`body.appendChild(...)` 之后插入：

```js
  const ipaRow = getWordIpa(w.id);
  if (ipaRow) body.appendChild(UI.el('div', 'word-detail-row',
    '<span class="stat-label">音标</span>　<span>/' + UI.esc(ipaRow) + '/</span>'));
```

- [ ] **Step 4: CSS**

`css/style.css` 末尾追加：

```css
.word-ipa { margin: 2px 0 0; letter-spacing: 0.04em; }
```

- [ ] **Step 5: 验证**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目" && node tests/run.js
```

预期：全绿（本任务无新测试，纯展示层）。grep 确认复习路径不含 ipa：

```bash
grep -n "ipa" src/vocabulary.js
```

预期：仅 wordCard 与 detailDrawer 两处 + import 一行。

- [ ] **Step 6: 交接**

不 commit、不 build。报告改动位置。

---

### Task 5: 0.5× 慢速按钮

**模型：primary**（多处学习流接线，需判断）

**Files:**
- Modify: `src/ui.js`（追加 `slowBtn`，L32 之后）
- Modify: `src/vocabulary.js`（4 处接线：wordCard L55、加强 listen 播放钮、加强 spell 播放钮、复习 listen/dict 播放钮）
- Modify: `css/style.css`（`.slow-btn` 一条规则）

**Interfaces:**
- Consumes：`audio.playWord(id, text, { rate })`（Task 3）。
- Produces：`slowBtn(text, id)`（ui.js）——word 音频的 0.5× 播放按钮。

- [ ] **Step 1: `src/ui.js` 追加 slowBtn**

在 `speakBtn` 函数之后插入：

```js
export function slowBtn(text, id) {
  const b = el('button', 'speak-btn slow-btn', '0.5×');
  b.title = '慢速朗读（0.5×）';
  b.setAttribute('aria-label', '慢速朗读 ' + text);
  b.onclick = function (e) {
    e.stopPropagation();
    audio.playWord(id, text, { rate: 0.5 });
  };
  return b;
}
```

- [ ] **Step 2: `src/vocabulary.js` 四处接线**

import 行 L7 改为：

```js
import { UI, speakBtn, slowBtn } from './ui.js';
```

① wordCard（学新词介绍卡，L55 区域）：

```js
  de.appendChild(speakBtn(w.de, 'word', w.id));
  de.appendChild(slowBtn(w.de, w.id));
```

② 加强 listen 步（`play.onclick = function () { audio.playWord(w.id, w.de); };` + `card.appendChild(play);` 区域，约 L468-472）：在 `card.appendChild(play);` 后插入：

```js
        const slow1 = slowBtn(w.de, w.id); slow1.style.marginLeft = '6px';
        card.appendChild(slow1);
```

③ 加强 spell 步（`play2` 区域，约 L503-507）：在 `card.appendChild(play2);` 后插入：

```js
        const slow2 = slowBtn(w.de, w.id); slow2.style.marginLeft = '6px';
        card.appendChild(slow2);
```

④ 复习 listen/dict（复习 `show()` 内 `play.onclick = function () { audio.playWord(w.id, w.de); };` 区域，约 L795-800）：在 `card.appendChild(play);` 后插入：

```js
      const slowR = slowBtn(w.de, w.id); slowR.style.marginLeft = '6px';
      card.appendChild(slowR);
```

注意：②与④的变量名都不可用 `play` 冲突名；插入位置以「该处的 `card.appendChild(play*)` 之后」为准，锚点行号可能漂移，用 grep 定位 `card.appendChild(play` 确认是 listen/spell/review 三处（排除图片题与例句的）。

- [ ] **Step 3: CSS**

`css/style.css` 末尾追加：

```css
.slow-btn { font-size: 11px; padding: 2px 6px; }
```

- [ ] **Step 4: 验证**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目" && node tests/run.js && grep -c "slowBtn" src/vocabulary.js src/ui.js
```

预期：测试全绿；vocabulary.js 5 次（import + 4 处）、ui.js 1 次（定义）。

- [ ] **Step 5: 交接**

不 commit、不 build。报告四处接线的最终行号。

---

### Task 6: 设置页署名

**模型：deepseek**

**Files:**
- Modify: `src/views.js`（设置页，「学习统计」卡片 `cStat` 挂载之后，L193 起的卡片块结束后）

**Interfaces:**
- Consumes：无。Produces：无。

- [ ] **Step 1: 追加署名卡片**

用 grep 找到 `cStat.appendChild(UI.el('h3', null, '学习统计'))` 所在卡片块，在 `v.appendChild(cStat);` 之后插入：

```js
  const cCredits = UI.el('div', 'card');
  cCredits.appendChild(UI.el('h3', null, '音频与音标来源'));
  cCredits.appendChild(UI.el('p', 'stat-label',
    '真人发音：Wikimedia Commons / Lingua Libre 贡献者（CC BY-SA，逐词署名见 audio/credits_native.json）。' +
    '音标：de.wiktionary.org（CC BY-SA）。合成语音：Microsoft edge-tts（个人自用）。'));
  v.appendChild(cCredits);
```

（若设置页结构是先 append 全部卡片再 return v，则插入位置以「cStat 卡片块之后、其余卡片之前」为准，保持视觉顺序：统计 → 署名。）

- [ ] **Step 2: 验证与交接**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目" && node tests/run.js
```

预期全绿。不 commit、不 build。

---

### Task 7: 主会话收尾（构建 / 全量抓取 / 文档 / 合并打 tag）

**模型：主会话亲自执行**

- [ ] **Step 1: 构建与测试**

```bash
cd "C:/Users/matebook 14/Desktop/德语学习项目" && node tests/run.js && npm run build
```

- [ ] **Step 2: 全量抓取（后台，耗时长）**

```bash
cd tools && python fetch_ipa.py && python fetch_native_audio.py
```

先后台跑 IPA（约 1945 × 0.5s ≈ 20 分钟），再跑真人发音（wikitext 走缓存，主要是 imageinfo+下载，约 30-60 分钟）。中途可断点续跑。

- [ ] **Step 3: 验收**

- `audio/manifest.js` 含 AUDIO_NATIVE 且数量符合抓取结果；`data/ipa.js` 条目数符合。
- `node tools/shot.mjs /learn shots/s6_learn.png 1280` 截图确认：词卡显示 IPA 与 0.5× 按钮（需有可学新词的账号状态；若该级别已学完则用测试数据或手动构造路由验证）。
- 浏览器实际点开一个词卡，确认真人发音可播放（抽 3 个 native 词）。

- [ ] **Step 4: 文档更新**

- `CHANGELOG.md`：新增 `[4.3.0]` 条目（真人发音回退链 / IPA / 0.5× 按钮 / 设置页署名 / 两个新管道脚本）。
- `README.md`：功能清单补充音标与真人发音。
- `AGENTS.md`：目录结构补 `audio/native/`、`audio/credits_native.json`、`data/ipa.js`、`tools/dewikt.py`、`tools/fetch_ipa.py`、`tools/fetch_native_audio.py`；SOP 8.3 补两条新脚本用法；注明 manifest 的 AUDIO_NATIVE 行由 fetch_native_audio.py 维护。

- [ ] **Step 5: 提交、合并、打 tag**

```bash
git add -A
git commit -m "feat(audio): 真人发音回退链 + 一次性语速"      # src/audio.js tts.js data.js ui.js + 测试
git commit -m "feat(vocab): 词卡 IPA 音标与 0.5× 慢速按钮"      # vocabulary.js views.js style.css
git commit -m "feat(tools): de.wiktionary 共享模块与 IPA/真人发音管道"  # tools/*.py
git commit -m "assets(audio,data): 真人发音全量抓取与 IPA 数据"  # audio/native credits manifest data/ipa.js
git commit -m "docs: S6 收尾（CHANGELOG/README/AGENTS）"
git checkout main && git merge phase/s6-pronunciation
git tag v4.3.0
```

（提交切分按文件归属分批 add；以上消息为示例，按实际批次调整。）

---

## 每阶段收尾

Task 1–6 全部 review 通过后执行 Task 7；合并后更新 CHANGELOG 的 `[Unreleased]` 为空。
