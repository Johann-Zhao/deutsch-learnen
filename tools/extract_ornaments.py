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
            # 每页 pdfimages 输出两个 image+smask 对（装饰+logo），故页码 = pair//2 + 1
            page_no = pair // 2 + 1
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
