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
