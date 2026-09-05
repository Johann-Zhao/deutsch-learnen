# S3「Deutsch Zine」前端重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把德语学习站前端全面重构为 muted zine 纸感杂志风（桌面+移动），并重生成 38 张主题封面与约 6 张装饰插图，学习逻辑零改动。

**Architecture:** 保持 vanilla JS + ESM + esbuild（`src/main.js` → `js/bundle.js`）、hash 路由、IndexedDB 存储不变。视觉层重写 `css/style.css`（设计令牌驱动），视图层（`src/views.js / vocabulary.js / grammar.js / conjugate.js / app.js` + `index.html`）只做模板与 class 调整。素材管道新增两个 Python 脚本：Cove PDF 装饰提取、zine 封面/装饰图生成（复用已验证可用的 `tools/seedream_client.py`，模型 doubao-seedream-5-0-pro，`.env` 已配置）。

**Tech Stack:** vanilla JS (ES2018)、esbuild、Python 3.13 + httpx/python-dotenv/Pillow（已装）、pdfimages（poppler，已装）、Edge headless 截图验收。

**设计依据:** `docs/superpowers/specs/2026-09-06-zine-redesign-design.md`（已批准）。muted zine 风格规则参考 skill：旧纸、70–90% 留白、低饱和灰调、打字机/衬线微文本、撕纸拼贴锚点、至多一个极淡 wash（占 0.5–3%）、禁高饱和色块。

## Global Constraints

- 分支：`phase/s3-zine-redesign`（已创建）。提交规范：`类型(范围): 中文描述`（feat/fix/refactor/test/docs/chore/build/assets）。
- **学习逻辑零改动**：FSRS（`src/srs.js`）、判分 `SRS.matches`、存储（`src/storage.js / store.js`）、数据懒加载（`src/data.js`）、命名约定（AGENTS.md 第 7 节）一律不碰。
- 每次改完 `src/` 必须：`npm test` 全绿 + `npm run build` 重建 `js/bundle.js`，两者都过才允许提交。
- 设计令牌（写死在 Task 4 的 CSS 中，各处引用变量名一致）：
  - `--paper:#F2EDE3` `--card:#F8F5EC` `--ink:#26221B` `--ink-2:#6E675A` `--ink-3:#9A917F` `--gold:#A88C4A` `--line:#D8D0BE`
  - 词性低饱和功能色：`--m:#4A6FA5` `--f:#A85B6E` `--n:#4E7D5E`；`--ok` 同 `--n`，`--bad` 同 `--f`
- 移动端底线：375px 无横向滚动；可点热区 ≥44×44px；输入字号 ≥16px；`env(safe-area-inset-*)`；`touch-action: manipulation`。
- 动效 ≤300ms，且包在 `@media (prefers-reduced-motion: no-preference)` 内。
- 文案准则沿用 DESIGN.md：按钮写结果、空状态是行动邀请、错误提示直接。
- 生成图质量门：逐张目检；出现高饱和色块/跑题/大段可读文字 → 收紧 prompt 重生成一次。

---
### Task 1: seedream_client 支持自定义后缀（zine 图需要保留微文本）

现状：`tools/seedream_client.py` 的 `generate()` 无条件拼接 `NO_TEXT_SUFFIX`（"…无文字，无水印，无logo"），这与 zine 封面需要"德语单词微文本"冲突。

**Files:**
- Modify: `tools/seedream_client.py`（`generate` 函数签名与 `body_prompt` 行）

**Interfaces:**
- Produces: `generate(prompt, out_path, sizes=("1024x1024",), max_retry=3, verbose=True, suffix=NO_TEXT_SUFFIX)` —— Task 3 以 `suffix=''` 调用。

- [ ] **Step 1: 修改签名与拼接逻辑**

把：
```python
def generate(prompt, out_path, sizes=("1024x1024",), max_retry=3, verbose=True):
    """生成一张图并落盘，返回 (ok, out_path|None, note)"""
    out_path = pathlib.Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    body_prompt = prompt + NO_TEXT_SUFFIX
```
改为：
```python
def generate(prompt, out_path, sizes=("1024x1024",), max_retry=3, verbose=True, suffix=NO_TEXT_SUFFIX):
    """生成一张图并落盘，返回 (ok, out_path|None, note)。suffix=None/'' 时不追加默认后缀。"""
    out_path = pathlib.Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    body_prompt = prompt + (suffix or '')
```

- [ ] **Step 2: 回归验证旧行为不变**

Run: `cd 项目根 && python tools/seedream_client.py "一只橘猫在读书" .tmp_pdf/t1_regression.png`
Expected: 输出 `True ... ok@...`，且旧调用方（`gen_covers.py` 未传 suffix）行为不变。

- [ ] **Step 3: Commit**

```bash
git add tools/seedream_client.py
git commit -m "feat(tools): seedream_client 支持自定义 prompt 后缀，为 zine 封面保留微文本"
```

---

### Task 2: Cove PDF 装饰素材提取（images/ornaments/）

从 `Desktop/Cove前端 PNG 素材分享 01.pdf` 提取带透明通道的装饰 PNG。已验证：每页一个主图 + 一个 smask（alpha），`pdfimages -png` 按页序输出成对文件；PIL 12.2.0 已安装。

**Files:**
- Create: `tools/extract_ornaments.py`
- Create（脚本产物）: `images/ornaments/*.png`、`images/ornaments/_contact.png`（联络表，目检用，不部署引用）

**Interfaces:**
- Produces: 语义化文件名，供 Task 4/6/9 的模板直接引用：
  - `images/ornaments/divider.png`（p01 竖向装饰分隔条）
  - `images/ornaments/sun-moon.png`（p02 日月）
  - `images/ornaments/frame-gold.png`（p03 金色装饰框）
  - `images/ornaments/dotted-ring.png`（p04 点阵圆环）
  - `images/ornaments/constellation-heart.png`（p08 心形星座）
  - `images/ornaments/constellation.png`（p14 星座）
  - `images/ornaments/crescent.png`（p20 弯月）
  - `images/ornaments/gothic-window.png`（p26 哥特花窗）

- [ ] **Step 1: 写提取脚本**

```python
# -*- coding: utf-8 -*-
"""从 Cove PDF 素材包提取装饰 PNG（合成 smask alpha，裁边，语义命名）。

用法：python tools/extract_ornaments.py [pdf路径]
默认 pdf 路径：桌面/Cove前端 PNG 素材分享 01.pdf
产物：images/ornaments/<name>.png + _contact.png（联络表目检用）
依赖：pdfimages（poppler）、Pillow
"""
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'images' / 'ornaments'
PDF_DEFAULT = pathlib.Path.home() / 'Desktop' / 'Cove前端 PNG 素材分享 01.pdf'

# 页码(1-based) → 语义名；未列出的页仅进联络表
CURATED = {
    1: 'divider',
    2: 'sun-moon',
    3: 'frame-gold',
    4: 'dotted-ring',
    8: 'constellation-heart',
    14: 'constellation',
    20: 'crescent',
    26: 'gothic-window',
}


def extract(pdf_path):
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        prefix = str(pathlib.Path(td) / 'a')
        subprocess.run(['pdfimages', '-png', str(pdf_path), prefix], check=True)
        files = sorted(pathlib.Path(td).glob('a-*.png'))
        # pdfimages 对每页输出：image 然后 smask；按页码成对
        pages = {}
        for f in files:
            # 文件名 a-NNN.png 为全局序号；两两成对（偶=图，奇=smask）
            idx = int(f.stem.split('-')[1])
            pair = idx // 2
            pages.setdefault(pair, []).append(f)
        results = {}
        for pair, pair_files in sorted(pages.items()):
            if len(pair_files) < 2:
                continue
            img = Image.open(pair_files[0]).convert('RGB')
            mask = Image.open(pair_files[1]).convert('L')
            if img.size != mask.size:
                mask = mask.resize(img.size)
            rgba = img.convert('RGBA')
            rgba.putalpha(mask)
            bbox = rgba.getbbox()
            if bbox:
                rgba = rgba.crop(bbox)
            # 过滤小图标（页内 logo 等）
            if rgba.width < 200 or rgba.height < 100:
                continue
            page_no = pair + 1
            results[page_no] = rgba
        # 语义命名 + 全量页留存
        for page_no, rgba in results.items():
            name = CURATED.get(page_no, 'p%02d' % page_no)
            rgba.save(OUT / (name + '.png'))
        # 联络表：全部页缩略图拼一张，标页码
        thumbs = []
        for page_no, rgba in sorted(results.items()):
            t = rgba.copy()
            t.thumbnail((220, 220))
            thumbs.append((page_no, t))
        if thumbs:
            cols = 5
            rows = (len(thumbs) + cols - 1) // cols
            sheet = Image.new('RGB', (cols * 240, rows * 260), (242, 237, 227))
            from PIL import ImageDraw
            d = ImageDraw.Draw(sheet)
            for i, (page_no, t) in enumerate(thumbs):
                x, y = (i % cols) * 240 + 10, (i // cols) * 260 + 10
                bg = Image.new('RGB', (220, 220), (242, 237, 227))
                bg.paste(t, ((220 - t.width) // 2, (220 - t.height) // 2), t)
                sheet.paste(bg, (x, y))
                d.text((x, y + 224), 'p%02d %s' % (page_no, CURATED.get(page_no, '')), fill=(38, 34, 27))
            sheet.save(OUT / '_contact.png')
        print('提取 %d 页 → %s' % (len(results), OUT))


if __name__ == '__main__':
    pdf = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else PDF_DEFAULT
    if not pdf.exists():
        print('PDF 不存在: %s' % pdf)
        sys.exit(1)
    extract(pdf)
```

- [ ] **Step 2: 运行并验证产物**

Run: `cd 项目根 && python tools/extract_ornaments.py`
Expected: 输出"提取 N 页 → .../images/ornaments"，`images/ornaments/` 下出现 8 个语义命名 PNG 与 `_contact.png`。

- [ ] **Step 3: 目检联络表与关键件**

用 ReadMediaFile 查看 `images/ornaments/_contact.png` 与 `sun-moon.png`、`gothic-window.png`。若某语义件透明通道缺失（整图不透明矩形）或裁切错误，调整脚本后重跑。确认金色装饰在透明底上正常。

- [ ] **Step 4: Commit**

```bash
git add tools/extract_ornaments.py images/ornaments/
git commit -m "assets(images): 提取 Cove 装饰素材为透明 PNG（8 件语义命名 + 联络表）"
```

---
### Task 3: zine 封面与装饰图生成（38 封面 + 6 装饰图）

新增 `tools/gen_zine_covers.py`：每个主题一条 muted zine 配方（主体与主题强相关 + 德语微文本 + 版式轮换 + 至多一个极淡 wash）。封面竖版 2:3（`832x1248`，回退 `1024x1024`），装饰图横版/方形。生成后覆盖 `images/covers/*.png` 并更新 `images/manifest.js` 的 `IMAGE_COVERS`；装饰图落 `images/zine/`。

**Files:**
- Create: `tools/gen_zine_covers.py`
- Modify: `tools/seedream_client.py`（Task 1 已改，本任务复用 `suffix=''` 与 `sizes` 参数）
- 产物: `images/covers/<themeId>.png` ×38、`images/zine/{hero,empty-review,empty-mistakes,grammar-head,settings-foot,splash}.png`、`images/manifest.js`

**Interfaces:**
- Consumes: `tools/seedream_client.py` 的 `generate(prompt, out_path, sizes, suffix)`（Task 1）；`tools/gen_covers.py` 的 `load_themes()` 与 `update_manifest(cover_ids)`（直接 import 复用，不改 gen_covers.py）。
- Produces: 38 张封面（文件名=主题 id，不变）；6 张装饰图固定文件名，供 Task 6/9/10 模板直接引用。

- [ ] **Step 1: 写生成脚本（含全部 38+6 条配方，无占位）**

```python
# -*- coding: utf-8 -*-
"""muted zine 风格主题封面 + 装饰插图生成（Seedream 5.0 pro）。

用法：
  python tools/gen_zine_covers.py            # 全部缺失项补齐（已存在自动跳过）
  python tools/gen_zine_covers.py --force    # 强制重生成全部
  python tools/gen_zine_covers.py --only greet,time   # 只跑指定 id
产物：images/covers/<themeId>.png（2:3 竖版）、images/zine/*.png、更新 images/manifest.js
风格依据：docs/superpowers/specs/2026-09-06-zine-redesign-design.md + muted-zine-poster skill
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from seedream_client import generate
from gen_covers import load_themes, update_manifest

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 配方：themeId → (主体与处理, 德语微文本, 版式, wash)
# 版式轮换 muted-zine skill 的 Layout Family；wash 至多一个且极淡
RECIPES = {
    # ---- A1 ----
    'greet': ('a torn-paper clipping of two people shaking hands, low-contrast grayscale old photo', 'Hallo', 'center-fragment', 'pale yellow paper strip near top'),
    'time': ('a torn-paper clipping of a vintage brass alarm clock, photocopy softness', 'Zeit', 'lower-left-float', 'pale yellow paper band'),
    'family': ('a faded grayscale photo of a family dinner table with bread and coffee cups, scan noise', 'Familie', 'center-fragment', None),
    'food': ('an object specimen of a bread roll and a small coffee cup, risograph grain', 'Essen', 'single-specimen', 'faint blue-gray diagonal band'),
    'shop': ('a flat silhouette of a paper shopping bag with a price tag, letterpress ink bleed', 'Einkaufen', 'lower-left-float', None),
    'home': ('an old printed illustration of an armchair and a floor lamp, halftone degradation', 'Zuhause', 'center-fragment', 'soft gray-green wash strip'),
    'traffic': ('an old printed illustration of a small train beside a punched train ticket, xerox wear', 'die Bahn', 'dual-panel', None),
    'work': ('an object specimen of a vintage typewriter, film grain photo', 'Arbeit', 'single-specimen', 'pale yellow paper strip'),
    'free': ('a torn-paper clipping of a football next to an open book, low contrast', 'Freizeit', 'center-fragment', None),
    'health': ('a grayscale photo crop of a stethoscope on paper, softened edge', 'Gesundheit', 'lower-left-float', 'faint blue-gray wash'),
    'clothes': ('a flat silhouette of a coat on a hanger, scanline texture', 'Kleidung', 'center-fragment', None),
    'weather': ('a small woodcut-style sun half covered by a cloud, risograph grain', 'Wetter', 'upper-right-block', 'pale yellow wash'),
    # ---- A2 ----
    'a2-travel': ('a torn-paper clipping of a leather suitcase on a folded map, photocopy softness', 'Urlaub', 'lower-left-float', 'faint blue-gray band'),
    'a2-office': ('a faded photo of a wooden desk with papers and a fountain pen, scan noise', 'Büro', 'center-fragment', None),
    'a2-city': ('an old printed illustration of a town hall square with a fountain, halftone', 'die Stadt', 'center-fragment', 'soft gray-green strip'),
    'a2-media': ('an object specimen of a folded newspaper stack, xerox wear', 'Medien', 'single-specimen', None),
    'a2-feelings': ('two small theatre masks, one smiling one sad, torn-paper cutout', 'Gefühle', 'dual-panel', 'pale yellow wash'),
    'a2-nature': ('an old printed illustration of a pine tree and a small windmill, risograph grain', 'Natur', 'center-fragment', 'soft gray-green wash'),
    'a2-festival': ('a grayscale photo of a candle and a fir branch, film grain', 'Fest', 'lower-left-float', None),
    'a2-tech': ('an object specimen of a retro television set, scanline texture', 'Technik', 'single-specimen', 'faint blue-gray band'),
    'a2-bank': ('a torn-paper clipping of coins and an old envelope with a wax seal, low contrast', 'das Geld', 'center-fragment', None),
    'a2-education': ('an old printed illustration of a blackboard with chalk and stacked books', 'Schule', 'center-fragment', 'pale yellow strip'),
    'a2-sport': ('a faded photo of a pair of running shoes on paper, scan noise', 'Sport', 'lower-left-float', None),
    'a2-housing': ('a torn-paper clipping of cardboard moving boxes and a key, photocopy softness', 'Wohnen', 'center-fragment', 'soft gray-green wash'),
    # ---- B1 ----
    'b1-career': ('a flat silhouette of a ladder leaning against nothing, letterpress ink bleed', 'Karriere', 'center-fragment', 'pale yellow band'),
    'b1-economy': ('an old printed rising line chart engraving on paper, halftone degradation', 'Wirtschaft', 'upper-right-block', None),
    'b1-media': ('an object specimen of a vintage microphone, film grain photo', 'Presse', 'single-specimen', 'faint blue-gray wash'),
    'b1-environment': ('an old printed illustration of a wind turbine over a field, risograph grain', 'Umwelt', 'center-fragment', 'soft gray-green wash'),
    'b1-university': ('a torn-paper clipping of a graduation cap on stacked books, low contrast', 'Universität', 'center-fragment', None),
    'b1-health': ('a flat silhouette of a meditating person, scanline texture', 'Balance', 'center-fragment', 'soft gray-green band'),
    'b1-society': ('a paper-chain of cut-out human figures holding hands, torn edges', 'Gesellschaft', 'center-fragment', None),
    'b1-digital': ('an object specimen of a retro computer terminal, xerox wear', 'Digital', 'single-specimen', 'faint blue-gray wash'),
    'b1-culture': ('a torn-paper clipping of a classical sculpture head beside a theatre mask', 'Kultur', 'dual-panel', 'pale yellow wash'),
    'b1-europe': ('an old printed engraving of a globe circled by small stars, halftone', 'Europa', 'dot-orbit', None),
    'b1-writing': ('an object specimen of a fountain pen resting on aged paper, film grain', 'Schreiben', 'single-specimen', 'pale yellow strip'),
    'b1-law': ('an old printed illustration of a balance scale, letterpress ink bleed', 'Gesetz', 'center-fragment', None),
    'b1-colloquial': ('a faded photo of two coffee cups on a small cafe table, scan noise', 'Alltag', 'lower-left-float', 'pale yellow wash'),
    'b1-formal': ('a torn-paper clipping of an official stamp and a sealed letter, low contrast', 'Amt', 'center-fragment', 'faint blue-gray band'),
}

LAYOUT_DESC = {
    'center-fragment': 'one small visual cluster at the center occupying about 15 percent of the canvas, surrounded by empty paper',
    'lower-left-float': 'one small visual cluster in the lower-left quadrant, the upper two thirds stay empty paper',
    'upper-right-block': 'one small visual cluster in the upper-right, loose empty space below and left',
    'dual-panel': 'two small adjacent panels with a narrow gap at the center, lots of empty paper around',
    'single-specimen': 'one isolated small object at the center with almost no supporting graphics',
    'dot-orbit': 'a ring of tiny dots or hairlines orbiting one small central subject',
}

# 装饰图：文件名 → (prompt 主体, 微文本, 尺寸组)
ZINE_DECOR = {
    'hero': ('a muted zine collage of a German study still life: an open squared exercise book, a fountain pen, a cup of coffee, and a tiny torn-paper clipping of the Brandenburg Gate, all small at the lower third, huge empty aged paper above', 'Deutsch lernen', ('1248x832', '1024x1024')),
    'empty-review': ('a tiny grayscale paper-cut bird perched on an empty aged paper sheet, very small at the center, almost everything empty', 'Alles erledigt', ('1024x1024',)),
    'empty-mistakes': ('a small eraser and a pencil resting on clean aged paper, tiny at the center, huge negative space', 'Keine Fehler', ('1024x1024',)),
    'grammar-head': ('a muted zine collage of a small gothic cathedral window cutout surrounded by tiny gold-ink stars, small cluster at the center, huge empty paper', 'Grammatik', ('1248x832', '1024x1024')),
    'settings-foot': ('a tiny brass wax-seal stamp on aged paper, very small at the center, huge negative space', 'Einstellungen', ('1024x1024',)),
    'splash': ('a muted zine sun-and-moon gold-ink ornament at the center of an aged paper sheet, small, surrounded by empty paper', 'Guten Tag', ('1024x1024',)),
}

PROMPT_TMPL = (
    'Tall vertical 2:3 paper poster, full-frame aged cream paper with visible fibers and mottling, '
    'no border, no mockup. 70 to 90 percent of the canvas is plain empty paper; {layout}. '
    'The single image anchor is {subject}; the anchor keeps a muted grayscale old-print treatment. '
    'Typography: one tiny typewriter-style word "{word}" pressed against the anchor edge, plus a tiny semi-legible date stamp; '
    'text stays small and sparse. Color logic: muted grayscale ink on aged paper{wash}. '
    'Flat orthographic scanned-paper appearance, matte absorbent paper, diffuse light, low contrast, no hard shadow, no 3D depth. '
    'Quiet, poetic, archival, diary-like zine mood. '
    'Avoid: full-bleed scene, commercial headline, logo, glossy mockup, clean digital UI, cinematic lighting, 3D, neon, cartoon, '
    'dense scrapbook, many colors, long readable text, any high-chroma color block.'
)


def cover_prompt(theme_id):
    subject, word, layout, wash = RECIPES[theme_id]
    wash_txt = (', with exactly one very pale wash: %s, covering under 3 percent of the canvas' % wash) if wash else ''
    return PROMPT_TMPL.format(layout=LAYOUT_DESC[layout], subject=subject, word=word, wash=wash_txt)


def decor_prompt(name):
    subject, word, _ = ZINE_DECOR[name]
    return (
        'Paper poster on full-frame aged cream paper, no border, no mockup. '
        '80 percent plain empty paper; the only visual is %s. '
        'One tiny typewriter-style word "%s" near the visual. '
        'Muted grayscale ink on aged paper, at most one barely visible pale wash. '
        'Flat orthographic scanned-paper appearance, matte, diffuse light, low contrast, no hard shadow, no 3D. '
        'Quiet archival zine mood. Avoid: full-bleed scene, commercial headline, logo, glossy mockup, clean UI white, '
        'cinematic lighting, 3D, neon, cartoon, many colors, long readable text, high-chroma blocks.'
    ) % (subject, word)


def main():
    force = '--force' in sys.argv
    only = None
    for a in sys.argv[1:]:
        if a.startswith('--only='):
            only = set(a.split('=', 1)[1].split(','))
    covers_dir = ROOT / 'images' / 'covers'
    zine_dir = ROOT / 'images' / 'zine'
    themes = load_themes()
    done, failed = [], []
    for theme_id, name in themes:
        if theme_id not in RECIPES:
            print('跳过（无配方）: %s' % theme_id)
            continue
        if only and theme_id not in only:
            continue
        out = covers_dir / (theme_id + '.png')
        if out.exists() and not force:
            done.append(theme_id)
            continue
        print('生成封面 %s（%s）...' % (theme_id, name))
        ok, path, note = generate(cover_prompt(theme_id), out,
                                  sizes=('832x1248', '1024x1024'), suffix='')
        if ok:
            done.append(theme_id)
        else:
            failed.append(theme_id)
            print('  失败: %s' % theme_id)
    for name, (_, _, sizes) in ZINE_DECOR.items():
        if only and name not in only:
            continue
        out = zine_dir / (name + '.png')
        if out.exists() and not force:
            continue
        print('生成装饰图 %s ...' % name)
        ok, path, note = generate(decor_prompt(name), out, sizes=sizes, suffix='')
        if not ok:
            failed.append(name)
            print('  失败: %s' % name)
    # manifest：以磁盘实际存在的封面为准
    existing = sorted(p.stem for p in covers_dir.glob('*.png'))
    update_manifest(existing)
    print('完成。封面 %d 张，失败 %d 项: %s' % (len(done), len(failed), failed or '无'))


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: 先试跑 2 张验证风格**

Run: `cd 项目根 && python tools/gen_zine_covers.py --force --only=greet,hero`
Expected: `images/covers/greet.png`（2:3 竖版）与 `images/zine/hero.png` 生成成功。用 ReadMediaFile 目检：旧纸底、大面积留白、灰调锚点、"Hallo"/"Deutsch lernen" 微文本、无高饱和色块。不合格则收紧 prompt（加 "grayscale, desaturated, no color block"）重跑一次。

- [ ] **Step 3: 全量生成**

Run: `python tools/gen_zine_covers.py --force`（约 44 张，每张 10–30 秒，总耗时约 15–25 分钟；可中断后用不带 --force 的命令断点续跑）
Expected: 38 张封面 + 6 张装饰图全部存在，`images/manifest.js` 的 `IMAGE_COVERS` 更新为磁盘实际清单。失败项用 `--only=<id>` 单独补跑。

- [ ] **Step 4: 全量目检（质量门）**

用 PIL 拼联络表快速目检（可临时脚本：把 covers/*.png 缩略拼 6 列大图，ReadMediaFile 查看）：逐张确认 ① 纸感与留白 ② 主体与主题强相关 ③ 无高饱和色块 ④ 无大段文字。问题图记 id，`--only=<id>` 收紧 prompt 重生成。

- [ ] **Step 5: npm test 保持绿 + Commit**

Run: `npm test`（封面/menifest 变更不应影响测试，但必须确认）
```bash
git add tools/gen_zine_covers.py images/covers/ images/zine/ images/manifest.js
git commit -m "assets(images): 38 张主题封面与 6 张装饰图全面 muted zine 化（Seedream 5.0 pro）"
```

---
### Task 4: 设计令牌与全局样式重写（css/style.css 全文替换）

**Files:**
- Modify: `css/style.css`（全文替换，288 行 → 约 470 行）

**Interfaces:**
- Produces（后续任务模板直接使用的 class 名，必须与之一致）：
  - 既有保留：`card / btn / btn-ghost / btn-sm / grid grid-2 grid-3 / page-title / page-sub / stat-num / stat-label / opt / opts / feedback ok|bad / progress-dots dot / gender-tag / g-m g-f g-n / hl-m hl-f hl-n / word-card word-de word-zh word-ex / bar bar-fill / cal-grid cal-cell cal-on cal-protected cal-today / badge / mistake-item / setting-row / empty / result-num / self-rate / speak-btn / lesson / topic-item / level-switch / word-img`
  - 新增：`.micro`（打字机微文本） `.hero-zine`（首页 hero 图框） `.ornament`（装饰 PNG，透明底） `.cover-wall / .cover-cell / .cover-cap`（封面墙） `.sheet`（学习流程居中单栏纸卡容器） `.spell-input`（练习本横线输入框） `.archive-table`（档案表格） `.badge-seal`（金色印章徽章） `.chapter-head`（语法章头） `.level-band`（分辑横线标题） `.tabbar`（移动端底部导航） `.fade-in`（页面淡入）

- [ ] **Step 1: 全文替换 css/style.css**

```css
/* ===== Deutsch Zine · 德语学习志 —— S3 设计规范见 DESIGN.md（v4）=====
   米色旧纸 / 墨色 / 装饰金 / 低饱和词性三色（仅功能性小面积使用） */

:root {
  --paper: #F2EDE3;
  --card: #F8F5EC;
  --ink: #26221B;
  --ink-2: #6E675A;
  --ink-3: #9A917F;
  --gold: #A88C4A;
  --line: #D8D0BE;
  --m: #4A6FA5;            /* der 蓝（低饱和） */
  --f: #A85B6E;            /* die 红（低饱和） */
  --n: #4E7D5E;            /* das 绿（低饱和） */
  --ok: #4E7D5E;
  --bad: #A85B6E;
  --radius-s: 3px;
  --radius: 4px;
  --serif: Georgia, "Noto Serif SC", "Songti SC", "SimSun", serif;
  --sans: "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  --mono: "Courier New", ui-monospace, monospace;
  --paper-shadow: 0 1px 2px rgba(38, 34, 27, 0.06), 0 4px 14px rgba(38, 34, 27, 0.05);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { -webkit-text-size-adjust: 100%; }
html { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
button, a, input, select, textarea, [role="button"] { touch-action: manipulation; }

body {
  font-family: var(--sans);
  background-color: var(--paper);
  /* 纸纹噪点（SVG feTurbulence data-URI，极低透明度） */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.15 0 0 0 0 0.13 0 0 0 0 0.10 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E");
  color: var(--ink);
  font-size: 16px;
  line-height: 1.65;
}

:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 2px; }

a { color: var(--m); text-decoration: none; }

/* ===== 排版 ===== */
.page-title {
  font-family: var(--serif);
  font-size: 30px; font-weight: 700; letter-spacing: 0.01em;
  margin-bottom: 4px; line-height: 1.25;
}
.page-sub { color: var(--ink-2); font-size: 14px; margin-bottom: 24px; }
.micro {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--ink-3);
}
h1, h2, h3 { font-family: var(--serif); }
.card h3 { font-size: 16px; margin-bottom: 8px; }

/* ===== 布局 ===== */
.topbar {
  background: var(--card);
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 20;
  padding-top: env(safe-area-inset-top, 0px);
}
.topbar-inner {
  max-width: 960px; margin: 0 auto; padding: 12px 24px;
  display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
}
.brand { font-family: var(--serif); font-weight: 700; font-size: 18px; letter-spacing: 0.02em; color: var(--ink); }
.brand small {
  font-family: var(--mono); font-weight: 400; color: var(--ink-3);
  margin-left: 8px; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
}
.nav { display: flex; gap: 4px; flex-wrap: wrap; }
.nav a {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; min-width: 44px;
  padding: 6px 12px; border-radius: var(--radius-s); color: var(--ink-2);
  font-size: 14px;
}
.nav a:hover { background: var(--paper); color: var(--ink); }
.nav a.active { background: var(--ink); color: var(--card); }

main { max-width: 960px; margin: 0 auto; padding: 32px 24px calc(72px + env(safe-area-inset-bottom, 0px)); }

/* 移动端底部 tab bar（桌面隐藏） */
.tabbar {
  display: none;
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
  background: var(--card); border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.tabbar a {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 52px; color: var(--ink-2); font-size: 11px; gap: 2px;
}
.tabbar a .tab-ic { font-size: 17px; line-height: 1; }
.tabbar a.active { color: var(--ink); font-weight: 600; }

/* ===== 卡片（纸卡） ===== */
.card {
  background: var(--card); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 22px; margin-bottom: 16px;
  box-shadow: var(--paper-shadow);
}

.grid { display: grid; gap: 16px; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 640px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }

/* 学习/复习流程居中单栏纸卡 */
.sheet { max-width: 680px; margin: 0 auto; }

/* ===== 按钮 ===== */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--ink); background: var(--ink);
  color: var(--card); padding: 10px 22px; border-radius: var(--radius-s);
  font-size: 14px; cursor: pointer; font-family: inherit; line-height: 1.4;
  min-height: 44px;
}
.btn:hover { background: #3A342A; border-color: #3A342A; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost { background: transparent; color: var(--ink); border-color: var(--line); }
.btn-ghost:hover { background: var(--paper); border-color: var(--ink); }
.btn-sm { padding: 6px 14px; font-size: 13px; }
.btn-block { display: block; width: 100%; text-align: center; }

.self-rate { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.self-rate .btn { flex: 1; min-width: 110px; }
.speak-btn {
  border: none; background: none; cursor: pointer; color: var(--ink-2);
  font-size: 15px; padding: 4px 8px; border-radius: 4px; vertical-align: middle;
  min-height: 44px; min-width: 44px;
}
.speak-btn:hover { background: var(--paper); color: var(--ink); }

/* ===== 词性色系统（低饱和，仅功能性小面积） ===== */
.g-m { color: var(--m); }
.g-f { color: var(--f); }
.g-n { color: var(--n); }
.gender-tag {
  display: inline-block; font-size: 12px; font-weight: 600;
  padding: 1px 10px; border-radius: 999px; margin-right: 8px;
  font-family: var(--mono); letter-spacing: 0.04em;
}
.gender-tag.m { color: var(--m); background: rgba(74, 111, 165, 0.10); }
.gender-tag.f { color: var(--f); background: rgba(168, 91, 110, 0.10); }
.gender-tag.n { color: var(--n); background: rgba(78, 125, 94, 0.10); }
.gender-tag.pl { color: var(--ink-2); background: rgba(110, 103, 90, 0.12); }

.word-card { border-left: 3px solid var(--line); }
.word-card.g-m { border-left-color: var(--m); }
.word-card.g-f { border-left-color: var(--f); }
.word-card.g-n { border-left-color: var(--n); }
.word-card.g-pl { border-left-color: var(--ink-3); }
.word-de { font-family: var(--serif); font-size: 27px; font-weight: 700; margin: 2px 0; }
.word-zh { color: var(--ink-2); font-size: 15px; }
.word-ex { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 14px; color: var(--ink-2); }
.word-ex b { color: var(--ink); font-weight: 600; }
.word-ex b.hl-m { color: var(--m); }
.word-ex b.hl-f { color: var(--f); }
.word-ex b.hl-n { color: var(--n); }

/* ===== 进度 / 统计 ===== */
.bar { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--ink); border-radius: 3px; transition: width .3s; }
.stat-num { font-family: var(--serif); font-size: 30px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 13px; color: var(--ink-2); }
.week-chart { display: flex; align-items: flex-end; gap: 8px; height: 88px; margin-top: 12px; }
.week-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--ink-3); }
.week-bar { width: 100%; background: var(--ink); border-radius: 2px 2px 0 0; min-height: 2px; opacity: .85; }
.week-col span.day { color: var(--ink-2); }

/* ===== 词汇封面墙 ===== */
.level-band {
  display: flex; align-items: center; gap: 14px; margin: 28px 0 14px;
}
.level-band::before, .level-band::after {
  content: ""; flex: 1; border-top: 1px solid var(--line);
}
.cover-wall { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 18px; }
.cover-cell { color: inherit; display: block; }
.cover-cell .cover-img {
  display: block; width: 100%; aspect-ratio: 2 / 3; object-fit: cover;
  border: 1px solid var(--line); border-radius: var(--radius-s);
  background: var(--card); box-shadow: var(--paper-shadow);
}
.cover-cell .cover-cap { margin-top: 8px; }
.cover-cell .cover-cap .t-name { font-family: var(--serif); font-weight: 700; font-size: 14px; display: block; }
.cover-cell .cover-cap .t-meta { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; color: var(--ink-3); text-transform: uppercase; }

/* ===== 练习 ===== */
.quiz-prompt { font-size: 19px; font-weight: 600; margin: 6px 0 18px; }
.quiz-prompt input, .spell-input {
  font-size: 18px; padding: 8px 4px; border: none; border-bottom: 2px solid var(--line);
  border-radius: 0; width: 100%; max-width: 380px; font-family: var(--mono);
  margin-top: 10px; background: transparent; color: var(--ink); letter-spacing: 0.04em;
}
.quiz-prompt input:focus, .spell-input:focus { border-bottom-color: var(--ink); outline: none; }
.opts { display: grid; gap: 10px; }
.opt {
  display: flex; align-items: center;
  text-align: left; padding: 12px 16px; border: 1px solid var(--line); border-radius: var(--radius-s);
  background: var(--card); font-size: 15px; cursor: pointer; font-family: inherit; color: var(--ink);
  min-height: 44px;
}
.opt:hover { border-color: var(--ink); }
.opt.correct { border-color: var(--ok); background: rgba(78, 125, 94, 0.10); color: var(--ok); font-weight: 600; }
.opt.wrong { border-color: var(--bad); background: rgba(168, 91, 110, 0.08); color: var(--bad); }
.feedback { margin-top: 14px; padding: 12px 14px; border-radius: var(--radius-s); font-size: 14px; }
.feedback.ok { background: rgba(78, 125, 94, 0.10); color: var(--ok); }
.feedback.bad { background: rgba(168, 91, 110, 0.09); color: var(--bad); }
.progress-dots { display: flex; gap: 5px; margin-bottom: 16px; flex-wrap: wrap; }
.dot { width: 22px; height: 4px; border-radius: 2px; background: var(--line); }
.dot.done { background: var(--ink); }

.rate-yes { background: var(--n); border-color: var(--n); }
.rate-yes:hover { background: #416B50; border-color: #416B50; }
.rate-mid { background: var(--card); color: var(--ink); }
.rate-no { background: var(--f); border-color: var(--f); }
.rate-no:hover { background: #8F4C5D; border-color: #8F4C5D; }

/* ===== 语法（editorial 章节） ===== */
.chapter-head {
  display: flex; align-items: center; gap: 14px; margin-bottom: 6px;
}
.chapter-head .ornament { height: 46px; width: auto; }
.lesson { font-size: 15px; }
.lesson h3 { font-size: 17px; margin: 24px 0 8px; }
.lesson p { margin-bottom: 10px; }
.lesson ul, .lesson ol { padding-left: 22px; margin-bottom: 10px; }
.lesson table { border-collapse: collapse; width: 100%; margin: 10px 0 16px; font-size: 14px; }
.lesson th, .lesson td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; }
.lesson th { background: var(--paper); font-weight: 600; }
.lesson u { text-decoration-color: var(--m); text-decoration-thickness: 2px; }

.topic-item {
  display: block; padding: 16px 18px; background: var(--card);
  border: 1px solid var(--line); border-radius: var(--radius); color: inherit; margin-bottom: 12px;
  box-shadow: var(--paper-shadow);
}
.topic-item:hover { border-color: var(--ink); }
.topic-item .t-name { font-family: var(--serif); font-weight: 700; font-size: 16px; }
.topic-item .t-desc { font-size: 13px; color: var(--ink-2); margin-top: 3px; }

/* ===== 档案表格（变位 / 错题 / 设置） ===== */
.archive-table { border-collapse: collapse; width: 100%; font-size: 15px; }
.archive-table th, .archive-table td { border: 1px solid var(--line); padding: 8px 12px; text-align: left; }
.archive-table th { background: var(--paper); font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-2); font-weight: 600; }
.archive-table td:last-child { font-weight: 600; }

.mistake-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--line); font-size: 14px; }
.mistake-item:last-child { border-bottom: none; }
.mistake-item .m-body { flex: 1; }
.badge { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--paper); color: var(--ink-2); border: 1px solid var(--line); }
.badge-on { background: var(--ink); color: var(--card); border-color: var(--ink); }

/* 成就印章（金色镂空圆章） */
.badge-seal {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 64px; min-height: 64px; padding: 6px; text-align: center;
  border: 1.5px solid var(--gold); border-radius: 50%;
  color: var(--gold); font-size: 11px; line-height: 1.3;
  background: transparent;
}
.badge-seal.locked { opacity: 0.35; border-style: dashed; }

/* 连胜日历（纸格点阵） */
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; max-width: 308px; margin-top: 10px; }
.cal-cell { aspect-ratio: 1; border-radius: 2px; background: var(--card); border: 1px solid var(--line); }
.cal-cell.cal-on { background: var(--ink); border-color: var(--ink); }
.cal-cell.cal-protected { background: repeating-linear-gradient(45deg, var(--line) 0 3px, var(--card) 3px 6px); }
.cal-cell.cal-today { outline: 2px solid var(--m); outline-offset: 1px; }

.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.setting-row:last-child { border-bottom: none; }
.setting-row label { font-weight: 600; font-size: 14px; }
.setting-row input[type=number], .setting-row select {
  padding: 6px 10px; border: 1px solid var(--line); border-radius: var(--radius-s);
  font-size: 16px; font-family: inherit; background: var(--card); color: var(--ink);
  min-height: 44px;
}

/* 级别切换 */
.level-switch { display: flex; gap: 2px; margin-left: auto; background: var(--paper); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.level-switch button {
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--ink-2); font-family: inherit;
  font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 999px; cursor: pointer;
  min-height: 44px; min-width: 44px;
}
.level-switch button:hover { color: var(--ink); }
.level-switch button.on { background: var(--ink); color: var(--card); }
@media (max-width: 640px) { .level-switch { margin-left: 0; } }

/* 词条图片与装饰 */
.word-img {
  display: block; width: 200px; max-width: 100%; height: auto;
  border-radius: var(--radius-s); margin: 12px 0 4px; border: 1px solid var(--line);
  background: var(--card);
}
.hero-zine {
  display: block; width: 100%; height: auto;
  border: 1px solid var(--line); border-radius: var(--radius);
  box-shadow: var(--paper-shadow); margin-bottom: 20px;
}
.ornament { display: block; background: transparent; }

/* 空状态（行动邀请） */
.empty { text-align: center; padding: 40px 20px; color: var(--ink-2); }
.empty .btn { margin-top: 16px; }
.empty .empty-art { width: 180px; max-width: 60%; margin: 0 auto 12px; display: block; }

/* 结果页 */
.result-num { font-family: var(--serif); font-size: 46px; font-weight: 700; text-align: center; margin: 8px 0; }

/* ===== 动效（克制；reduced-motion 下全部关闭） ===== */
@media (prefers-reduced-motion: no-preference) {
  .card, .opt, .btn, .cover-cell .cover-img { transition: background-color .15s, border-color .15s, color .15s, transform .2s, box-shadow .2s; }
  .cover-cell:hover .cover-img { transform: translateY(-3px); box-shadow: 0 2px 3px rgba(38,34,27,0.07), 0 10px 22px rgba(38,34,27,0.09); }
  @keyframes pop { 0% { transform: scale(1); } 40% { transform: scale(1.02); } 100% { transform: scale(1); } }
  .feedback.ok, .feedback.bad { animation: pop .25s ease; }
  @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
  .fade-in { animation: fadein .24s ease; }
  @keyframes seal { 0% { transform: scale(1.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  .badge-seal:not(.locked) { animation: seal .28s ease backwards; }
}

/* ===== 移动端（≤768px 启用 tab bar；≤480px 紧凑） ===== */
@media (max-width: 768px) {
  .topbar .nav { display: none; }
  .tabbar { display: flex; }
  main { padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px)); }
}
@media (max-width: 480px) {
  main { padding: 20px 14px calc(84px + env(safe-area-inset-bottom, 0px)); }
  .page-title { font-size: 25px; }
  .word-de { font-size: 23px; }
  .topbar-inner { padding: 10px 14px; gap: 12px; }
  .card { padding: 16px; }
  .cover-wall { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 12px; }
  input, select, textarea { font-size: 16px; }
  .quiz-prompt input, .spell-input { font-size: 17px; max-width: 100%; }
  .setting-row input[type=number], .setting-row select { max-width: 100%; }
  .self-rate { flex-direction: column; }
  .self-rate .btn { width: 100%; }
}
```

- [ ] **Step 2: 构建 + 测试（CSS 改动不影响逻辑，但必须确认管线正常）**

Run: `npm test && npm run build`
Expected: 测试全绿，`js/bundle.js` 重建成功。

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat(ui): 全站样式重写为 muted zine 纸感设计令牌（含 tabbar/封面墙/印章等新组件）"
```

---

### Task 5: 应用外壳（index.html + app.js 底部 tab bar 联动）

**Files:**
- Modify: `index.html`（品牌、主题色、tabbar 容器）
- Modify: `src/app.js`（render 中同步 tabbar active；mistakes 归入"我的"）

**Interfaces:**
- Consumes: Task 4 的 `.tabbar` 样式。
- Produces: `#tabbar a[data-route]`（`/ /vocab /grammar /conjugate /settings`）；tabbar 激活规则：route 命中或 `cur==='/mistakes' && data-route==='/settings'`。

- [ ] **Step 1: 替换 index.html 的 header 与 body 尾部**

把 `<header class="topbar">…</header>` 整段与 `<main id="view"></main>` 替换为：

```html
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="#/">德语学习志<small>Deutsch Zine · A1–B1</small></a>
    <nav class="nav" id="nav">
      <a href="#/" data-route="/">今日</a>
      <a href="#/vocab" data-route="/vocab">词汇</a>
      <a href="#/grammar" data-route="/grammar">语法</a>
      <a href="#/conjugate" data-route="/conjugate">变位</a>
      <a href="#/mistakes" data-route="/mistakes">错题本</a>
      <a href="#/settings" data-route="/settings">设置</a>
    </nav>
    <div class="level-switch" id="levelSwitch" role="group" aria-label="级别切换">
      <button data-level="A1">A1</button>
      <button data-level="A2">A2</button>
      <button data-level="B1">B1</button>
    </div>
  </div>
</header>
<main id="view"></main>
<nav class="tabbar" id="tabbar" aria-label="底部导航">
  <a href="#/" data-route="/"><span class="tab-ic">✦</span>今日</a>
  <a href="#/vocab" data-route="/vocab"><span class="tab-ic">❖</span>词汇</a>
  <a href="#/grammar" data-route="/grammar"><span class="tab-ic">§</span>语法</a>
  <a href="#/conjugate" data-route="/conjugate"><span class="tab-ic">λ</span>变位</a>
  <a href="#/settings" data-route="/settings"><span class="tab-ic">●</span>我的</a>
</nav>
```

同时把 `<meta name="theme-color" content="#1B1F24">` 改为 `content="#F2EDE3"`，`<title>` 改为 `德语学习志 · Deutsch Zine A1–B1`。

- [ ] **Step 2: app.js 同步 tabbar 激活态 + 页面淡入**

在 `render()` 中，现有 `document.querySelectorAll('#nav a')…` 循环之后插入：

```javascript
  document.querySelectorAll('#tabbar a').forEach(function (a) {
    const r = a.getAttribute('data-route');
    a.classList.toggle('active', r === cur || (cur === '/mistakes' && r === '/settings'));
  });
```

并把 `view.appendChild(...)` 之后、 `window.scrollTo(0, 0)` 之前加一行：

```javascript
  view.classList.remove('fade-in'); void view.offsetWidth; view.classList.add('fade-in');
```

- [ ] **Step 3: 构建 + 测试 + 提交**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功。
```bash
git add index.html src/app.js js/bundle.js
git commit -m "feat(app): 应用外壳 zine 化——品牌、主题色、移动端底部 tab bar 与页面淡入"
```

---
### Task 6: 今日页杂志封面化（src/views.js dashboard）

**Files:**
- Modify: `src/views.js`（`dashboard()` 整函数替换；`settingsPage` 本任务不动）

**Interfaces:**
- Consumes: `images/zine/hero.png`（Task 3）、`images/ornaments/constellation-heart.png`（Task 2）、Task 4 的 `.micro .hero-zine .badge-seal`。
- Produces: 无新导出；`dashboard()` 签名不变。

- [ ] **Step 1: 替换 dashboard() 函数体（统计/日历/成就逻辑不变，仅结构与新 class）**

```javascript
export function dashboard() {
  const todayStr = today();
  const s = store.state;
  const cur = currentLevel();
  const pool = wordsOfLevel(cur);
  const learned = pool.filter(function (w) { return s.srs[w.id]; }).length;
  const mastered = pool.filter(function (w) { return s.srs[w.id] && s.srs[w.id].mastered; }).length;
  const due = Object.keys(s.srs).filter(function (id) { return id.indexOf('#') === -1 && SRS.isDue(s.srs[id], todayStr); }).length;
  const grammarDue = Object.keys(s.srs).filter(function (id) { return id.indexOf('#') >= 0 && SRS.isDue(s.srs[id], todayStr); }).length;
  const t = s.daily[todayStr] || { new: 0, reviewed: 0, correct: 0 };

  const v = UI.el('div');
  // 刊头：打字机德语日期 + 衬线大标题
  const deDate = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  v.appendChild(UI.el('p', 'micro', deDate + ' · Tagesausgabe'));
  v.appendChild(UI.el('h1', 'page-title', '今日'));
  v.appendChild(UI.el('p', 'page-sub', new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })));

  const hero = UI.el('img', 'hero-zine');
  hero.src = 'images/zine/hero.png';
  hero.alt = '德语学习志 · 今日刊头插画';
  hero.loading = 'lazy';
  v.appendChild(hero);

  // 本期导读（今日任务）
  const card = UI.el('div', 'card');
  card.appendChild(UI.el('p', 'micro', 'INHALT · 本期导读'));
  card.appendChild(UI.el('h3', null, '今日任务'));
  if (t.new + t.reviewed === 0 && due === 0) {
    card.appendChild(UI.el('p', null, '还没有开始。从 ' + s.settings.dailyNew + ' 个新词开始？'));
  } else {
    card.appendChild(UI.el('p', null, '已学新词 ' + t.new + ' 个 · 已复习 ' + t.reviewed + ' 个'));
  }
  const row = UI.el('div', null);
  row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:12px';
  const bNew = UI.el('button', 'btn', '学 ' + s.settings.dailyNew + ' 个新词');
  bNew.onclick = function () { location.hash = '#/learn'; };
  row.appendChild(bNew);
  const bRev = UI.el('button', 'btn ' + (due ? '' : 'btn-ghost'), due ? '复习 ' + due + ' 个到期词' : '没有到期复习');
  bRev.disabled = !due;
  bRev.onclick = function () { location.hash = '#/review'; };
  row.appendChild(bRev);
  card.appendChild(row);
  const gRow = UI.el('div', null);
  gRow.style.cssText = 'margin-top:10px';
  const bGram = UI.el('button', 'btn btn-sm ' + (grammarDue ? '' : 'btn-ghost'), grammarDue ? '语法复习 ' + grammarDue + ' 题' : '无到期语法复习');
  bGram.disabled = !grammarDue;
  bGram.onclick = function () { location.hash = '#/review-grammar'; };
  gRow.appendChild(bGram);
  card.appendChild(gRow);
  v.appendChild(card);

  // 档案式统计栏
  const stats = UI.el('div', 'grid grid-3');
  [['已学 / ' + cur + ' 词量', learned + ' / ' + pool.length], ['已掌握', mastered], ['连续打卡', s.streak.count + ' 天']].forEach(function (x) {
    const c = UI.el('div', 'card');
    c.appendChild(UI.el('div', 'stat-num', String(x[1])));
    c.appendChild(UI.el('div', 'micro', x[0]));
    stats.appendChild(c);
  });
  v.appendChild(stats);

  const pc = Math.round(learned / pool.length * 100) || 0;
  const prog = UI.el('div', 'card');
  prog.appendChild(UI.el('h3', null, cur + ' 词汇进度'));
  const bar = UI.el('div', 'bar');
  const fill = UI.el('div', 'bar-fill'); fill.style.width = pc + '%';
  bar.appendChild(fill); prog.appendChild(bar);
  prog.appendChild(UI.el('p', 'stat-label', pc + '%（' + learned + ' / ' + pool.length + '）'));
  v.appendChild(prog);

  // 连胜日历（纸格点阵）+ 冻结券
  const cal = UI.el('div', 'card');
  const calHead = UI.el('div', 'chapter-head');
  const orn = UI.el('img', 'ornament');
  orn.src = 'images/ornaments/constellation-heart.png'; orn.alt = ''; orn.loading = 'lazy';
  calHead.appendChild(orn);
  const calTitle = UI.el('div');
  calTitle.appendChild(UI.el('h3', null, '连胜 ' + s.streak.count + ' 天 · 冻结券 × ' + (s.streak.freezes || 0)));
  calTitle.appendChild(UI.el('p', 'stat-label', '漏卡一天会自动用冻结券保住连胜（每满 7 天补 1 张，最多 2 张）。'));
  calHead.appendChild(calTitle);
  cal.appendChild(calHead);
  const grid = UI.el('div', 'cal-grid');
  const protectedDays = {};
  (s.streak.protected || []).forEach(function (d) { protectedDays[d] = 1; });
  const start = new Date(); start.setDate(start.getDate() - 6 - start.getDay());
  for (let ci = 0; ci < 35; ci++) {
    const day = new Date(start); day.setDate(start.getDate() + ci);
    const key = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
    const cell = UI.el('div', 'cal-cell');
    if (s.daily[key] && (s.daily[key].new + s.daily[key].reviewed) > 0) cell.classList.add('cal-on');
    else if (protectedDays[key]) { cell.classList.add('cal-protected'); cell.title = '冻结券保住'; }
    if (key === todayStr) cell.classList.add('cal-today');
    cell.title = cell.title || key;
    grid.appendChild(cell);
  }
  cal.appendChild(grid);
  cal.appendChild(UI.el('p', 'stat-label', '■ 已学习 · ▨ 冻结保护 · □ 空缺'));
  v.appendChild(cal);

  // 成就（金色印章）
  const ach = UI.el('div', 'card');
  ach.appendChild(UI.el('p', 'micro', 'AUSZEICHNUNGEN · 成就'));
  let totalReviewed = 0;
  Object.keys(s.daily).forEach(function (k) { totalReviewed += (s.daily[k].reviewed || 0); });
  const topicsDone = Object.keys(s.grammarDone).length;
  const grammarCount = getGrammar().length;
  const ACHV = [
    ['第一个单词', learned >= 1],
    [cur + ' 词汇 50', learned >= 50],
    [cur + ' 词汇 200', learned >= 200],
    [cur + ' 全词汇', learned >= pool.length],
    ['连续 3 天', s.streak.count >= 3],
    ['连续 7 天', s.streak.count >= 7],
    ['连续 30 天', s.streak.count >= 30],
    ['语法第一课', topicsDone >= 1],
    ['语法过半', topicsDone >= Math.ceil(grammarCount / 2)],
    ['语法全通', topicsDone >= grammarCount],
    ['复习 100 题', totalReviewed >= 100]
  ];
  const rowAch = UI.el('div', null);
  rowAch.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-top:10px';
  ACHV.forEach(function (a, i) {
    const b = UI.el('span', 'badge-seal' + (a[1] ? '' : ' locked'), a[0]);
    if (a[1]) b.style.animationDelay = (i * 30) + 'ms';
    rowAch.appendChild(b);
  });
  ach.appendChild(rowAch);
  v.appendChild(ach);
  return v;
}
```

- [ ] **Step 2: 构建 + 测试**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功。

- [ ] **Step 3: 截图目检今日页（桌面+移动）**

```bash
cd 项目根 && (python -m http.server 8765 >/dev/null 2>&1 &) && sleep 1
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
mkdir -p shots
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t6_dash_1280.png --window-size=1280,1800 "http://localhost:8765/#/"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t6_dash_375.png --window-size=375,1600 "http://localhost:8765/#/"
```
（若该路径无 Edge，用 `"/c/Program Files/Google/Chrome/Application/chrome.exe"` 替代；两者都无则安装 Playwright Chromium 截图。）用 ReadMediaFile 查看两张图：纸底与纸纹正常、刊头/hero/印章显示正常、375px 无横向滚动、底部 tab bar 出现且"今日"高亮。发现问题回本步修正后再截图。

- [ ] **Step 4: Commit**

```bash
git add src/views.js js/bundle.js
git commit -m "feat(views): 今日页杂志封面化——德语刊头、hero 插画、档案统计、印章成就"
```

---

### Task 7: 词汇封面墙（src/vocabulary.js themesPage）

**Files:**
- Modify: `src/vocabulary.js`（`themesPage()` 整函数替换）

**Interfaces:**
- Consumes: 38 张 2:3 封面 `images/covers/<themeId>.png`（Task 3）、Task 4 的 `.cover-wall .cover-cell .cover-cap .level-band .micro`；`getImageCovers()` 行为不变。
- Produces: 无新导出。

- [ ] **Step 1: 替换 themesPage()**

```javascript
function themesPage() {
  const s = store.state;
  const lv = currentLevel();
  const themes = getVocabThemes().filter(function (t) { return (t.level || 'A1') === lv; });
  const total = themes.reduce(function (n, t) { return n + t.words.length; }, 0);
  const v = UI.el('div');
  v.appendChild(UI.el('p', 'micro', 'WORTSCHATZ · ' + lv));
  v.appendChild(UI.el('h1', 'page-title', '词汇 · ' + lv));
  v.appendChild(UI.el('p', 'page-sub', themes.length + ' 个主题 · ' + total + ' 个核心词。点封面进主题学习，或从「今日」开始每日计划。'));
  const band = UI.el('div', 'level-band');
  band.appendChild(UI.el('span', 'micro', 'AUSGABE ' + lv));
  v.appendChild(band);
  const wall = UI.el('div', 'cover-wall');
  const imageCovers = getImageCovers();
  themes.forEach(function (t) {
    let learned = 0;
    t.words.forEach(function (w, i) { if (s.srs[t.id + '-' + i]) learned++; });
    const a = UI.el('a', 'cover-cell');
    a.href = '#/theme/' + t.id;
    const hasCover = imageCovers.indexOf && imageCovers.indexOf(t.id) >= 0;
    const imgHtml = hasCover
      ? '<img class="cover-img" loading="lazy" src="images/covers/' + t.id + '.png" alt="">'
      : '<div class="cover-img"></div>';
    a.innerHTML = imgHtml +
      '<span class="cover-cap"><span class="t-name">' + UI.esc(t.name) + '</span>' +
      '<span class="t-meta">' + learned + ' / ' + t.words.length + ' · ' + t.words.length + ' WÖRTER</span></span>';
    wall.appendChild(a);
  });
  v.appendChild(wall);
  return v;
}
```

- [ ] **Step 2: 构建 + 测试**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功。

- [ ] **Step 3: 截图目检词汇墙（1280 与 375）**

命令同 Task 6 Step 3，URL 换 `http://localhost:8765/#/vocab`，产物 `shots/t7_vocab_1280.png / t7_vocab_375.png`。目检：2:3 封面齐整、hover 不可用（headless）但布局间距正常、375px 双列不溢出。

- [ ] **Step 4: Commit**

```bash
git add src/vocabulary.js js/bundle.js
git commit -m "feat(vocab): 词汇主题列表改为 zine 封面墙（2:3 封面 + 微文本进度）"
```

---

### Task 8: 学习 / 复习流程纸卡化（src/vocabulary.js 其余部分）

**Files:**
- Modify: `src/vocabulary.js`（`wordCard`、`learnSession`、`reviewSession` 的容器/输入/步骤标签；判分与 FSRS 逻辑不动）

**Interfaces:**
- Consumes: Task 4 的 `.sheet .spell-input .micro`；`images/zine/empty-review.png`（Task 3）。
- Produces: 无新导出；`Vocab` 导出对象不变。

- [ ] **Step 1: wordCard 顶部加微文本刊头**

在 `wordCard(w)` 函数开头 `const c = UI.el('div', 'card word-card g-' + w.g);` 之后插入一行：

```javascript
  c.appendChild(UI.el('p', 'micro', 'WORT DES TAGES'));
```

- [ ] **Step 2: learnSession 容器 sheet 化 + 步骤标签微文本化**

- `const v = UI.el('div');`（learnSession 内，约第 142 行）改为 `const v = UI.el('div', 'sheet');`
- `const stepLabel = UI.el('p', 'stat-label', '第 ' + (idx + 1) + ' 词 · 步骤 ' + (si + 1) + '/' + steps.length);` 改为：
```javascript
      const stepLabel = UI.el('p', 'micro', 'WORT ' + (idx + 1) + ' · SCHRITT ' + (si + 1) + '/' + steps.length);
```
- 拼写输入框：把 `input.style.cssText = 'font-size:18px;...'` 整行删除，改为 `input.className = 'spell-input';`
- 预览分流提示 `const hint = UI.el('p', 'stat-label', '认识吗？...');` 的 class 改为 `'micro'`，并删除 `hint.style.margin = '10px 0 0';` 替换为 `hint.style.cssText = 'margin:10px 0 0;text-transform:none;letter-spacing:0.06em';`

- [ ] **Step 3: reviewSession 容器 sheet 化 + 空状态配图 + 听写输入**

- `const v = UI.el('div');`（reviewSession 内，约第 406 行）改为 `const v = UI.el('div', 'sheet');`
- 空状态 `e.innerHTML = '<p>…</p>';` 之前插入配图：
```javascript
    const art = UI.el('img', 'empty-art');
    art.src = 'images/zine/empty-review.png'; art.alt = ''; art.loading = 'lazy';
    e.appendChild(art);
```
- 听写/填空的 `<input id="cloze-input">` 由 CSS `.quiz-prompt input` 统一生效（Task 4 已定义），无需改 JS；确认 `q.prompt` 中 input 无内联样式（现状即无）。

- [ ] **Step 4: 构建 + 测试**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功。

- [ ] **Step 5: 截图目检学习流程**

```bash
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t8_learn_1280.png --window-size=1280,1400 "http://localhost:8765/#/learn"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t8_learn_375.png --window-size=375,1400 "http://localhost:8765/#/learn"
```
目检：词卡居中 sheet、词性色条低饱和、横线输入框、375px 无溢出。（若当日无新词可学显示空状态，则改截 `#/theme/greet` 或临时用无痕窗口。）

- [ ] **Step 6: Commit**

```bash
git add src/vocabulary.js js/bundle.js
git commit -m "feat(vocab): 学习与复习流程纸卡化——居中单栏、微文本步骤标、练习本输入、空状态插画"
```

---
### Task 9: 语法 editorial 章节化（src/grammar.js）

**Files:**
- Modify: `src/grammar.js`（`listPage`、`topicPage`、`reviewPage` 的标题/容器；`renderExerciseItem` 输入框样式）

**Interfaces:**
- Consumes: `images/ornaments/gothic-window.png`（Task 2）、`images/zine/grammar-head.png`（Task 3）、Task 4 的 `.chapter-head .ornament .micro .sheet .spell-input`。
- Produces: 无新导出；`Grammar / Mistakes` 导出不变。

- [ ] **Step 1: renderExerciseItem 填空输入改为横线练习本样式**

把 fill 分支里 `input.style.cssText = 'font-size:17px;...'` 整行删除，改为：

```javascript
    input.className = 'spell-input';
```

- [ ] **Step 2: listPage 章头装饰**

在 `listPage()` 中 `v.appendChild(UI.el('h1', ...))` 之前插入：

```javascript
  const head = UI.el('div', 'chapter-head');
  const win = UI.el('img', 'ornament');
  win.src = 'images/ornaments/gothic-window.png'; win.alt = ''; win.loading = 'lazy';
  head.appendChild(win);
  const headTxt = UI.el('div');
  headTxt.appendChild(UI.el('p', 'micro', 'GRAMMATIK · ' + lv));
  head.appendChild(headTxt);
  v.appendChild(head);
```

- [ ] **Step 3: topicPage 刊头 + 讲解页 editorial**

在 `topicPage(id)` 找到 topic 之后、`v.appendChild(UI.el('h1', ...))` 之前插入：

```javascript
  v.appendChild(UI.el('p', 'micro', 'KAPITEL · ' + (topic.level || 'A1') + ' · ' + topic.id.toUpperCase()));
```

讲解卡 `const lesson = UI.el('div', 'card lesson');` 改为：

```javascript
  const lesson = UI.el('div', 'card lesson sheet');
```

- [ ] **Step 4: reviewPage 容器 sheet 化**

`const v = UI.el('div');`（reviewPage 内，约第 193 行）改为 `const v = UI.el('div', 'sheet');`

- [ ] **Step 5: 构建 + 测试**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功。

- [ ] **Step 6: 截图目检语法页**

```bash
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t9_grammar_1280.png --window-size=1280,1400 "http://localhost:8765/#/grammar"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t9_topic_1280.png --window-size=1280,1800 "http://localhost:8765/#/topic/g-praesens"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t9_grammar_375.png --window-size=375,1400 "http://localhost:8765/#/grammar"
```
目检：哥特花窗章头显示、讲解长文衬线排版、练习卡横线输入、375px 正常。

- [ ] **Step 7: Commit**

```bash
git add src/grammar.js js/bundle.js
git commit -m "feat(grammar): 语法模块 editorial 章节化——哥特花窗章头、衬线讲解、横线填空"
```

---

### Task 10: 变位 / 错题本 / 设置档案风（conjugate.js + grammar.js Mistakes + views.js settingsPage）

**Files:**
- Modify: `src/conjugate.js`（`page()` 的表格内联样式 → `.archive-table`；输入框 → `.spell-input`）
- Modify: `src/grammar.js`（`Mistakes.page()` 空状态配图 + 头部微文本）
- Modify: `src/views.js`（`settingsPage` 微文本刊头 + 错题本入口卡 + 页脚装饰图）

**Interfaces:**
- Consumes: `images/zine/empty-mistakes.png`、`images/zine/settings-foot.png`（Task 3）、Task 4 的 `.archive-table .spell-input .micro .empty-art`。
- Produces: 无新导出。

- [ ] **Step 1: conjugate.js 档案表格化**

- 输入框 `input.style.cssText = 'font-size:17px;...'` 整行删除，改为 `input.className = 'spell-input'; input.style.maxWidth = '320px';`
- 表格构建：把 `const t = UI.el('table', null);` 改为 `const t = UI.el('table', 'archive-table');`，并删除 `t.style.cssText = ...` 行；把 html 字符串中所有 `style="text-align:left;padding:6px 12px;border:1px solid var(--line);background:var(--bg)"`（th）与 `style="padding:6px 12px;border:1px solid var(--line);..."`（td）内联样式全部删除（class 已接管样式）。
- 页首 `v.appendChild(UI.el('h1', ...))` 之前插入 `v.appendChild(UI.el('p', 'micro', 'KONJUGATION · VERBTABELLE'));`

- [ ] **Step 2: Mistakes.page() 空状态配图 + 刊头**

- `v.appendChild(UI.el('h1', 'page-title', '错题本'));` 之前插入 `v.appendChild(UI.el('p', 'micro', 'FEHLERBUCH'));`
- 空状态 `const e = UI.el('div', 'card empty');` 之后、`e.innerHTML = ...` 之前插入：

```javascript
      const art = UI.el('img', 'empty-art');
      art.src = 'images/zine/empty-mistakes.png'; art.alt = ''; art.loading = 'lazy';
      e.appendChild(art);
```

- [ ] **Step 3: settingsPage 刊头 + 错题本入口 + 页脚装饰**

- `v.appendChild(UI.el('h1', 'page-title', '设置'));` 之前插入 `v.appendChild(UI.el('p', 'micro', 'EINSTELLUNGEN'));`
- 在「数据备份」卡（c2）之前插入错题本入口卡（移动端 tab 无错题本，此处保底可达）：

```javascript
  const c0 = UI.el('div', 'card');
  c0.appendChild(UI.el('h3', null, '错题本'));
  c0.appendChild(UI.el('p', 'stat-label', '做错的词汇与语法题都收在这里，可以集中重练。'));
  const bmRow = UI.el('div', null); bmRow.style.cssText = 'margin-top:12px';
  const bMistake = UI.el('button', 'btn btn-ghost btn-sm', '打开错题本');
  bMistake.onclick = function () { location.hash = '#/mistakes'; };
  bmRow.appendChild(bMistake);
  c0.appendChild(bmRow);
  v.appendChild(c0);
```

- 函数末尾 `return v;` 之前插入页脚装饰：

```javascript
  const foot = UI.el('img', 'ornament');
  foot.src = 'images/zine/settings-foot.png'; foot.alt = ''; foot.loading = 'lazy';
  foot.style.cssText = 'width:120px;margin:24px auto 0;opacity:.9';
  v.appendChild(foot);
```

- [ ] **Step 4: 构建 + 测试**

Run: `npm test && npm run build`
Expected: 全绿 + 构建成功。

- [ ] **Step 5: 截图目检三页**

```bash
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t10_conj_1280.png --window-size=1280,1400 "http://localhost:8765/#/conjugate"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t10_settings_375.png --window-size=375,1600 "http://localhost:8765/#/settings"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=shots/t10_mistakes_375.png --window-size=375,1200 "http://localhost:8765/#/mistakes"
```
目检：档案表格等宽表头、设置页错题本入口、空状态插画、375px tab bar 各 tab 可点。

- [ ] **Step 6: Commit**

```bash
git add src/conjugate.js src/grammar.js src/views.js js/bundle.js
git commit -m "feat(ui): 变位/错题本/设置档案风——等宽表格、微文本刊头、空状态与页脚插画"
```

---

### Task 11: 移动端适配收尾 + 双端全页验收 + 文档同步

**Files:**
- Modify: `css/style.css`（验收中发现的移动端问题修正）
- Modify: `DESIGN.md`（全文重写为 v4 zine 规范）
- Modify: `AGENTS.md`（SOP 8.1/8.3 换 `gen_zine_covers.py`，新增提取脚本说明）
- Modify: `CHANGELOG.md`（新增 v4.0 条目）
- Modify: `README.md`（视觉描述与文档索引同步）

**Interfaces:**
- Consumes: 全部前置任务。
- Produces: 验收截图集 `shots/final_*.png`；文档终稿。

- [ ] **Step 1: 全路由双端截图**

```bash
cd 项目根 && (python -m http.server 8765 >/dev/null 2>&1 &) && sleep 1
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
mkdir -p shots
for r in "" "vocab" "learn" "review" "grammar" "topic/g-praesens" "conjugate" "mistakes" "settings" "review-grammar"; do
  name=$(echo "home$r" | tr '/' '_')
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot="shots/final_${name}_1280.png" --window-size=1280,1800 "http://localhost:8765/#/$r"
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot="shots/final_${name}_375.png" --window-size=375,1500 "http://localhost:8765/#/$r"
done
```

- [ ] **Step 2: 逐张目检验收清单**

用 ReadMediaFile 逐张检查（20 张）：
- [ ] 纸底/纸纹/墨色/金色装饰统一，无旧冷白残留
- [ ] 词性三色为低饱和版本且仅小面积出现
- [ ] 375px 全部无横向滚动、无元素遮挡、底部 tab bar 不遮内容（main 底部 padding 足够）
- [ ] 触控目标 ≥44px（tab bar、按钮、选项）
- [ ] 封面墙 2:3 齐整；hero/空状态/章头装饰图全部加载（无破图）
- [ ] 桌面顶栏导航完整，移动顶栏精简（品牌+级别切换）
发现问题 → 修 CSS/模板 → 重新构建 → 重截对应页，直到全部通过。

- [ ] **Step 3: 重写 DESIGN.md 为 v4**

要点： muted zine 纸感为全站视觉方向；设计令牌表（色值/字体/圆角/阴影）；词性低饱和三色为唯一功能性色彩；组件规范（纸卡、墨线按钮、封面墙、印章、档案表格、tab bar）；动效规范（≤300ms + reduced-motion）；文案准则沿用；质量底线沿用（375px/WCAG AA/焦点可见/判分规则）；移动端规范沿用 S2 章节并补充 tab bar 约定。同时删除旧"禁止暖米色衬线"条款（用户已批准转向）。

- [ ] **Step 4: 同步 AGENTS.md / CHANGELOG.md / README.md**

- AGENTS.md：SOP 8.1 第 2、4 步的 `gen_covers.py` 改为 `gen_zine_covers.py`；8.3 主题封面行同步；目录结构 tools/ 增加 `extract_ornaments.py`、`gen_zine_covers.py`；images/ 增加 `zine/`、`ornaments/` 说明。
- CHANGELOG.md：顶部新增 `## [4.0.0] - 2026-09-06`：全站 muted zine 重构（纸感设计令牌、封面墙、editorial 语法、移动 tab bar）+ 38 封面与 6 装饰图重生成 + Cove 装饰素材提取。
- README.md：视觉相关描述同步（封面改为 zine 纸感封面；图片说明段落更新生成脚本名）。

- [ ] **Step 5: 终验 + 提交**

Run: `npm test && npm run build`
Expected: 全绿 + bundle 最新。
```bash
git add css/style.css DESIGN.md AGENTS.md CHANGELOG.md README.md js/bundle.js shots/
git commit -m "docs+fix(ui): S3 验收修正与文档同步（DESIGN v4 / AGENTS SOP / CHANGELOG v4.0）"
```

- [ ] **Step 6: 交付自查清单（对用户承诺逐项确认）**

- [ ] `npm test` 全绿
- [ ] `npm run build` 产物已提交
- [ ] 38 封面 + 6 装饰图全部目检合格，manifest 已更新
- [ ] 20 张双端截图全部通过验收清单
- [ ] DESIGN.md / AGENTS.md / CHANGELOG.md / README.md 已同步
- [ ] 无遗留 TBD/TODO/占位；学习逻辑零改动（`git diff main -- src/srs.js src/storage.js src/data.js` 应为空）
- [ ] `.env` 未被提交（`git status` 确认，.gitignore 已覆盖）

---

## Self-Review 记录

- **Spec 覆盖**：spec §2 令牌→Task 4；§3 页面版式→Task 5–10；§4 图像系统→Task 1–3；§5 交互动效→Task 4 CSS 动效节 + Task 5 淡入 + Task 6 印章；§6 移动端→Task 4 媒体查询 + Task 5 tabbar + Task 11 验收；§7 工程验证→Task 11。无缺口。
- **占位符扫描**：无 TBD/TODO；38+6 条生图配方已全量写出；CSS 全文给出。
- **类型一致性**：`.micro .sheet .spell-input .cover-wall .badge-seal .archive-table .chapter-head .ornament .hero-zine .empty-art .tabbar .fade-in` 在 Task 4 定义，后续任务引用名一致；`generate(..., suffix='')` 与 Task 1 签名一致；`load_themes / update_manifest` 复用自 `gen_covers.py`（现有函数，签名已核对）。
