#!/usr/bin/env python3
"""Pass 5 surfaces for the salle témoin.

Oak is one clean plank from Poly Haven `wood_floor` (CC0, 1.70 m square,
nine straight boards). The crop is the plank between the seams, so the
1.6 mm joints stay geometric. Damask is an original tone-on-tone ogee
and palmette, one motif per 55 cm. Coffers and leather are flat enough
to read as plaster and a banquette, not as noise.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
PBR = ROOT / 'assets' / 'pbr'
SCAN = Path('/tmp/tex/veneer_diff.jpg')
SCAN_N = Path('/tmp/tex/veneer_nor.jpg')
SCAN_R = Path('/tmp/tex/veneer_rough.jpg')

# Poly Haven wood_floor is 1.70 m square with nine equal planks.
PLANK_COUNT = 9
WORLD = 1.70
# Columns 16:120 and rows 80:1680 of the 2048 scan, clear of the seam and a crack.
# Kept in step with plank_uvs() in the baker.
PLANK_X0, PLANK_X1 = 16, 120
PLANK_Y0, PLANK_Y1 = 80, 1680
PLANK_ACROSS = (PLANK_X1 - PLANK_X0) / 2048 * WORLD
PLANK_ALONG = (PLANK_Y1 - PLANK_Y0) / 2048 * WORLD


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def plank_window(width):
    """Straight-grain side of the first plank, clear of the seam and the cathedral.

    The 2048 scan is 1.70 m across nine planks. Columns 16:120 are the calm
    edge of plank 0 (about 8.6 cm of wood), which is what a 4.8 cm board shows.
    """
    if width != 2048:
        raise SystemExit(f'expected the 2048 wood_floor scan, got {width}')
    return 16, 120


def match_mean(image, target):
    shift = np.array(target, np.float32) - image.mean(axis=(0, 1))
    return np.clip(image + shift, 0, 255)


def save_srgb(path, array):
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), 'RGB').save(path, quality=92)
    print(path.name, array.shape, 'mean', np.round(array.mean((0, 1)), 1))


def oak():
    """Fine straight grain from Poly Haven white_oak_veneer (CC0, 0.50 m), warmed to oak."""
    diff = np.asarray(Image.open(SCAN).convert('RGB'), np.float32)
    nor = np.asarray(Image.open(SCAN_N).convert('RGB'), np.float32)
    rough = np.asarray(Image.open(SCAN_R).convert('RGB'), np.float32)
    size = (1024, 1024)
    print('veneer world 0.50 m, source', diff.shape)
    diff = np.asarray(Image.fromarray(diff.astype(np.uint8)).resize(size, Image.Resampling.LANCZOS), np.float32)
    nor = np.asarray(Image.fromarray(nor.astype(np.uint8)).resize(size, Image.Resampling.LANCZOS), np.float32)
    rough = np.asarray(Image.fromarray(rough.astype(np.uint8)).resize(size, Image.Resampling.LANCZOS), np.float32)

    linear = srgb_to_linear(diff / 255.0)
    luma = 0.2126 * linear[:, :, 0] + 0.7152 * linear[:, :, 1] + 0.0722 * linear[:, :, 2]
    # Pull chroma in so the scan reads as waxed oak rather than orange varnish.
    linear = luma[:, :, None] + (linear - luma[:, :, None]) * 0.80
    graded = linear_to_srgb(linear) * 255.0
    graded = (graded - graded.mean(axis=(0, 1))) * 0.90 + graded.mean(axis=(0, 1))
    graded = match_mean(graded, (128, 101, 74))
    save_srgb(PBR / 'oak-diff.jpg', graded)

    flat = np.array([128, 128, 255], np.float32)
    nor = nor * 0.72 + flat * 0.28
    Image.fromarray(np.clip(nor, 0, 255).astype(np.uint8), 'RGB').save(PBR / 'oak-nor.jpg', quality=92)

    # Satin, not a raw sanded board. Roughness is data, stored in the byte value.
    value = rough.mean(axis=2) / 255.0
    value = np.clip(value * 0.40 + 0.40, 0.36, 0.68)
    rough_out = np.repeat((value * 255.0)[:, :, None], 3, axis=2)
    Image.fromarray(rough_out.astype(np.uint8), 'RGB').save(PBR / 'oak-rough.jpg', quality=92)
    print('oak rough mean', round(float(value.mean()), 3))


def damask():
    """One tileable 18th-century damask compartment. The wall UV is 55 cm per tile."""
    size = 1024
    base = (122, 46, 46)  # #7A2E2E
    light = (150, 68, 64)
    dark = (98, 32, 34)
    image = Image.new('RGB', (size, size), base)
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    def leaf_layer(cx, cy, scale, color, alpha, flip=1):
        layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        # A full rosette, so the repeat reads as a flower and not a crescent.
        d.ellipse((cx - 16 * scale, cy - 16 * scale, cx + 16 * scale, cy + 16 * scale), fill=(*color, alpha))
        for angle in range(0, 360, 30):
            length = int(150 * scale)
            width = int(28 * scale)
            rad = math.radians(angle - 90 * flip)
            tip_x = cx + math.cos(rad) * length * 0.48
            tip_y = cy + math.sin(rad) * length * 0.48
            blade = Image.new('L', (max(length, 2), max(width, 2)), 0)
            ImageDraw.Draw(blade).ellipse((0, 0, length - 1, width - 1), fill=alpha)
            blade = blade.rotate(-angle * flip, resample=Image.Resampling.BICUBIC, expand=True)
            stamp = Image.new('RGBA', blade.size, (*color, 0))
            stamp.putalpha(blade)
            layer.alpha_composite(stamp, (int(tip_x - blade.size[0] / 2), int(tip_y - blade.size[1] / 2)))
        d.line((cx, cy, cx, cy + 240 * scale * flip), fill=(*color, alpha), width=max(3, int(8 * scale)))
        return layer

    def scrolls(cx, cy, scale, color, alpha):
        layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        r = 150 * scale
        width = max(4, int(14 * scale))
        # Acanthus C-scrolls either side of the stem, the part that reads as damask.
        for sign in (-1, 1):
            box = (cx + sign * 20 * scale - r, cy - r * 0.15, cx + sign * 20 * scale + r, cy - r * 0.15 + 2 * r)
            start, end = (210, 350) if sign < 0 else (190, 330)
            d.arc(box, start=start, end=end, fill=(*color, alpha), width=width)
            # A smaller return scroll.
            r2 = r * 0.48
            box2 = (cx + sign * 130 * scale - r2, cy + 40 * scale - r2, cx + sign * 130 * scale + r2, cy + 40 * scale + r2)
            d.arc(box2, start=20 if sign > 0 else 160, end=200 if sign > 0 else 340, fill=(*color, alpha), width=max(3, width - 4))
        return layer

    # The repeat is the medallion at the centre and the same medallion split across the four edges.
    centers = [
        (512, 250), (0, 250), (1024, 250),
        (512, 770), (0, 770), (1024, 770),
    ]
    for cx, cy in centers:
        overlay = Image.alpha_composite(overlay, leaf_layer(cx, cy, 1.15, light, 230, flip=1))
        overlay = Image.alpha_composite(overlay, leaf_layer(cx, cy + 210, 0.85, dark, 210, flip=-1))
        overlay = Image.alpha_composite(overlay, scrolls(cx, cy + 40, 1.05, light, 200))
    image = Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')
    image = image.filter(ImageFilter.GaussianBlur(radius=0.4))
    arr = match_mean(np.asarray(image, np.float32), base)
    mean = arr.mean(axis=(0, 1))
    # Tone on tone: the figure stays inside roughly ±16 of the ground, but it covers the tile.
    arr = np.clip((arr - mean) * 0.85 + mean, 0, 255)
    arr = match_mean(arr, base)
    save_srgb(PBR / 'pompeian-diff.jpg', arr)

    # Height from the motif, then a normal. No diamond grid.
    height = arr.mean(axis=2)
    height = (height - height.mean()) / (height.std() + 1e-6)
    gy, gx = np.gradient(height)
    strength = 0.55
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(gx)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack(((nx / norm) * 0.5 + 0.5, (ny / norm) * 0.5 + 0.5, (nz / norm) * 0.5 + 0.5), axis=2)
    Image.fromarray((normal * 255).astype(np.uint8), 'RGB').save(PBR / 'damask-nor.jpg', quality=92)
    print('damask normal', normal.shape)


def coffer():
    rng = np.random.default_rng(7)
    size = 1024
    base = np.array([232, 224, 208], np.float32)
    noise = rng.normal(0, 2.2, (size, size, 1)).astype(np.float32)
    # A slow mottling, not a tile of concrete blocks.
    coarse = rng.normal(0, 1.0, (32, 32, 1)).astype(np.float32)
    coarse = np.asarray(Image.fromarray(coarse[:, :, 0], 'F').resize((size, size), Image.Resampling.BICUBIC))
    arr = base + noise + coarse[:, :, None] * 3.2
    save_srgb(PBR / 'coffer-diff.jpg', arr)


def leather():
    rng = np.random.default_rng(11)
    size = 1024
    base = np.array([112, 74, 54], np.float32)
    grain = rng.normal(0, 3.0, (size, size, 1)).astype(np.float32)
    arr = np.clip(base + grain, 0, 255)
    arr = match_mean(arr, (112, 74, 54))
    save_srgb(PBR / 'leather-diff.jpg', arr)


if __name__ == '__main__':
    oak()
    damask()
    coffer()
    leather()
