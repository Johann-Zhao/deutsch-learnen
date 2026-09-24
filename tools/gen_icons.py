# -*- coding: utf-8 -*-
"""从 images/zine/hero.png 本地派生 PWA 图标（PIL，不调 API）。

产物（images/icons/）：
- icon-192.png          192x192 any
- icon-512.png          512x512 any
- icon-maskable-512.png 512x512 maskable：内容缩至安全区（四周纸色 #F2EDE3 内边距 ≥10%）

源图为 1248x832 横构图，主体（摊开的书/勃兰登堡照片/咖啡杯/钢笔）
位于画面中下部，中心裁剪取该正方形区域。自产素材，授权无问题。
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "images" / "zine" / "hero.png"
OUT_DIR = ROOT / "images" / "icons"
PAPER = (0xF2, 0xED, 0xE3)

# 裁剪窗口：以源图宽高的比例给出（中心 + 边长），主体居中略偏下
CROP_CENTER_X = 0.495
CROP_CENTER_Y = 0.675
CROP_SIDE = 0.50  # 相对短边（832）的比例 → 416px 正方形

# maskable 安全区：内容占画布 80%（四周各 10% 纸色内边距）
MASKABLE_SAFE = 0.80


def crop_square(im: Image.Image) -> Image.Image:
    w, h = im.size
    side = int(min(w, h) * CROP_SIDE)
    cx, cy = int(w * CROP_CENTER_X), int(h * CROP_CENTER_Y)
    left = min(max(cx - side // 2, 0), w - side)
    top = min(max(cy - side // 2, 0), h - side)
    return im.crop((left, top, left + side, top + side))


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    square = crop_square(im)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        square.resize((size, size), Image.LANCZOS).save(OUT_DIR / f"icon-{size}.png")

    size = 512
    # 取偶数边长，保证四周内边距严格相等（512 → 408，四边各 52px = 10.16% ≥ 10%）
    inner = int(size * MASKABLE_SAFE)
    inner -= inner % 2
    pad = (size - inner) // 2
    icon = square.resize((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), PAPER)
    canvas.paste(icon, (pad, pad))
    canvas.save(OUT_DIR / "icon-maskable-512.png")

    print(f"icons -> {OUT_DIR.relative_to(ROOT)}: icon-192.png, icon-512.png, icon-maskable-512.png")


if __name__ == "__main__":
    main()
