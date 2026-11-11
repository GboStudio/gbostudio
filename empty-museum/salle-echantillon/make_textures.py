#!/usr/bin/env python3
"""PBR maps for the lighting sample room.

Herringbone is assembled from Poly Haven `wood_floor` (CC0, 2k) so each
plank keeps photographic grain. The tile is one seamless 6.3 m square:
twelve by fourteen bâtons-rompus cells. The mesh UVs rotate it 45° so the
arrows run down the nave and the repeat is longer than the view.
"""
from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
PBR = ROOT / 'assets' / 'pbr'
SCAN = Path('/tmp/downloads/wood_diff.jpg')
SCAN_N = Path('/tmp/downloads/wood_nor.jpg')
SCAN_R = Path('/tmp/downloads/wood_rough.jpg')
TOKTX = Path('/tmp/downloads/KTX-Software-4.3.2-Linux-x86_64/bin/toktx')
TILE_M = 6.3
PLANK_W = 0.075
PLANK_L = 0.45


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def save_rgb(path, array):
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), 'RGB').save(path, quality=92)
    print(path.name, array.shape, 'mean', np.round(array.mean(axis=(0, 1)), 1))


def plank_strips(image, across_px):
    """Nine vertical boards. Crop the seam so the joint is drawn, not photographed twice."""
    height, width = image.shape[:2]
    board = width / 9
    strips = []
    for index in range(9):
        x0 = int(index * board + board * 0.12)
        x1 = int((index + 1) * board - board * 0.12)
        crop = image[:, x0:x1]
        resized = np.asarray(
            Image.fromarray(crop.astype(np.uint8)).resize((across_px, height), Image.Resampling.LANCZOS),
            np.float32,
        )
        strips.append(resized)
    return np.stack(strips, axis=0)


def herringbone(size, albedo_src, normal_src, rough_src):
    """Continuous 45° herringbone. The lattice period divides the 6.3 m tile."""
    across = 48
    strips_a = plank_strips(albedo_src, across)
    strips_n = plank_strips(normal_src, across)
    rough_luma = rough_src.mean(axis=2, keepdims=True)
    strips_r = plank_strips(np.repeat(rough_luma, 3, axis=2), across)[:, :, :, 0]
    along_px = strips_a.shape[1]
    length = 0.315
    width = 0.07
    advance = length
    row = width * 2
    ys, xs = np.mgrid[0:size, 0:size]
    x = (xs + 0.5) / size * TILE_M
    y = (ys + 0.5) / size * TILE_M
    i0 = np.floor(x / advance).astype(np.int32)
    j0 = np.floor(y / row).astype(np.int32)
    best = np.full(x.shape, 1e9, np.float32)
    u_along = np.zeros(x.shape, np.float32)
    u_across = np.zeros(x.shape, np.float32)
    which = np.zeros(x.shape, np.int32)
    ident = np.zeros(x.shape, np.int32)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            ii = i0 + di
            jj = j0 + dj
            for family, ang in ((0, math.pi / 4), (1, -math.pi / 4)):
                cx = ii * advance + (advance * 0.5 if family else 0.0)
                cy = jj * row + (row * 0.5 if family else 0.0)
                dx = x - cx
                dy = y - cy
                dx -= TILE_M * np.round(dx / TILE_M)
                dy -= TILE_M * np.round(dy / TILE_M)
                c, s = math.cos(ang), math.sin(ang)
                local_along = dx * c + dy * s
                local_across = -dx * s + dy * c
                ox = np.maximum(np.abs(local_along) - length / 2, 0)
                oy = np.maximum(np.abs(local_across) - width / 2, 0)
                dist = ox * ox + oy * oy + np.abs(local_across) * 1e-4
                closer = dist < best
                best = np.where(closer, dist, best)
                u_along = np.where(closer, local_along / length + 0.5, u_along)
                u_across = np.where(closer, local_across / width + 0.5, u_across)
                which = np.where(closer, family, which)
                ident = np.where(closer, ii * 13 + jj * 7 + family * 3, ident)
    offset = (np.abs(ident) % 100) / 100.0
    flip = (np.abs(ident) & 1) == 0
    u_along = np.mod(u_along + offset, 1.0)
    u_along = np.where(flip, 1.0 - u_along, u_along)
    u_across = np.clip(u_across, 0, 1)
    pid = np.mod(np.abs(ident), 9).astype(np.int32)
    al = np.clip((u_along * (along_px - 1)).astype(np.int32), 0, along_px - 1)
    ac = np.clip((u_across * (across - 1)).astype(np.int32), 0, across - 1)
    color = strips_a[pid, al, ac]
    normal = strips_n[pid, al, ac]
    rough = strips_r[pid, al, ac]
    slanted = which == 1
    nx = normal[:, :, 0].copy()
    ny = normal[:, :, 1].copy()
    normal[:, :, 0] = np.where(slanted, ny, nx)
    normal[:, :, 1] = np.where(slanted, 255.0 - nx, ny)
    gain = 0.90 + (np.abs(ident) % 9) * 0.025
    color *= gain[:, :, None]
    joint = (u_across < 0.045) | (u_across > 0.955) | (u_along < 0.015) | (u_along > 0.985)
    color = np.where(joint[:, :, None], color * 0.62, color)
    # Warm honey oak, still photographic. Linear lift so the lit floor is not chocolate.
    linear = srgb_to_linear(np.clip(color, 0, 255) / 255.0)
    linear = np.clip(linear * 1.22 + 0.015, 0, 1)
    linear[:, :, 0] *= 1.04
    linear[:, :, 2] *= 0.90
    graded = linear_to_srgb(linear) * 255.0
    rough = rough / 255.0
    rough = np.clip(rough * 0.28 + 0.16, 0.14, 0.55)
    rough = np.where(joint, np.clip(rough + 0.28, 0, 0.92), rough)
    # Worn centre of each board takes a softer reflection of the skylight.
    centre = np.clip(1.0 - np.abs(u_across - 0.5) * 2.2, 0, 1)
    rough = np.clip(rough - centre * 0.08, 0.16, 0.92)
    return graded, normal, np.repeat((rough * 255.0)[:, :, None], 3, axis=2)


def bordeaux(size=1024):
    rng = np.random.default_rng(7)
    base = np.array([90, 44, 40], np.float32)
    noise = rng.normal(0, 1, (size // 4, size // 4)).astype(np.float32)
    noise = np.array(Image.fromarray(noise, mode='F').resize((size, size), Image.Resampling.BICUBIC), dtype=np.float32, copy=True)
    noise -= noise.mean()
    noise /= max(float(noise.std()), 1e-3)
    fiber = rng.normal(0, 1, (size, size // 8)).astype(np.float32)
    fiber = np.array(Image.fromarray(fiber, mode='F').resize((size, size), Image.Resampling.BILINEAR), dtype=np.float32, copy=True)
    fiber -= fiber.mean()
    color = base + noise[:, :, None] * np.array([3.2, 1.6, 1.8]) + fiber[:, :, None] * 1.4
    color = np.clip(color, 0, 255)
    rough = np.clip(196 + noise * 8 + fiber * 4, 170, 230)
    # A whisper of weave, not a drawn damask.
    normal = np.zeros((size, size, 3), np.float32)
    normal[:, :, 0] = 128 + fiber * 6
    normal[:, :, 1] = 128 + noise * 5
    normal[:, :, 2] = 255
    return color, normal, np.repeat(rough[:, :, None], 3, axis=2)


def skylight(width=1024, height=512):
    image = np.zeros((height, width, 3), np.float32)
    cols, rows = 4, 8
    rng = np.random.default_rng(3)
    for row in range(rows):
        for col in range(cols):
            x0 = int(col * width / cols)
            x1 = int((col + 1) * width / cols)
            y0 = int(row * height / rows)
            y1 = int((row + 1) * height / rows)
            cx = (col + 0.5) / cols - 0.5
            cy = (row + 0.5) / rows - 0.5
            fall = 1.0 - 0.10 * (cx * cx * 3 + cy * cy)
            jitter = 0.96 + 0.06 * rng.random()
            tone = np.array([248, 242, 230], np.float32) * fall * jitter
            pane = np.ones((y1 - y0, x1 - x0, 3), np.float32) * tone
            yy = np.linspace(0, 1, y1 - y0)[:, None]
            xx = np.linspace(0, 1, x1 - x0)[None, :]
            vignette = 0.93 + 0.07 * np.sin(xx * math.pi) * np.sin(yy * math.pi)
            pane *= vignette[:, :, None]
            image[y0:y1, x0:x1] = pane
    # Mullion ink so the glass keeps structure even where the bar is thin.
    band_x = max(2, width // 90)
    band_y = max(2, height // 70)
    for col in range(cols + 1):
        x = int(col * width / cols)
        image[:, max(0, x - band_x):min(width, x + band_x)] *= 0.55
    for row in range(rows + 1):
        y = int(row * height / rows)
        image[max(0, y - band_y):min(height, y + band_y), :] *= 0.55
    return np.clip(image, 0, 255)


def encode(src, dest, color):
    if not TOKTX.exists():
        print('toktx missing, skipped', dest.name)
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(TOKTX), '--genmipmap', '--encode', 'uastc', '--uastc_quality', '2',
        '--assign_oetf', 'srgb' if color else 'linear',
        '--assign_primaries', 'bt709',
        str(dest), str(src),
    ]
    subprocess.check_call(cmd)
    print('ktx2', dest.name, dest.stat().st_size)


def main():
    PBR.mkdir(parents=True, exist_ok=True)
    if not SCAN.exists():
        raise SystemExit(f'missing wood scan {SCAN}')
    albedo_src = np.asarray(Image.open(SCAN).convert('RGB'), np.float32)
    normal_src = np.asarray(Image.open(SCAN_N).convert('RGB'), np.float32)
    rough_src = np.asarray(Image.open(SCAN_R).convert('RGB'), np.float32)
    print('scan', albedo_src.shape)
    size = 4096 if __import__('os').environ.get('SAMPLE_TEX_FAST') != '1' else 1024
    graded, normal, rough = herringbone(size, albedo_src, normal_src, rough_src)
    save_rgb(PBR / 'herringbone-diff.jpg', graded)
    nor_size = size // 2
    normal_img = np.asarray(Image.fromarray(np.clip(normal, 0, 255).astype(np.uint8)).resize((nor_size, nor_size), Image.Resampling.BILINEAR), np.float32)
    rough_img = np.asarray(Image.fromarray(np.clip(rough, 0, 255).astype(np.uint8)).resize((nor_size, nor_size), Image.Resampling.BILINEAR), np.float32)
    Image.fromarray(np.clip(normal_img, 0, 255).astype(np.uint8), 'RGB').save(PBR / 'herringbone-nor.jpg', quality=92)
    Image.fromarray(np.clip(rough_img, 0, 255).astype(np.uint8), 'RGB').save(PBR / 'herringbone-rough.jpg', quality=92)
    print('herringbone rough mean', round(float(rough_img.mean()) / 255, 3))
    wall, wall_n, wall_r = bordeaux()
    save_rgb(PBR / 'bordeaux-diff.jpg', wall)
    Image.fromarray(np.clip(wall_n, 0, 255).astype(np.uint8), 'RGB').save(PBR / 'bordeaux-nor.jpg', quality=92)
    Image.fromarray(np.clip(wall_r, 0, 255).astype(np.uint8), 'RGB').save(PBR / 'bordeaux-rough.jpg', quality=92)
    sky = skylight()
    save_rgb(PBR / 'skylight.jpg', sky)
    (PBR / 'surfaces.json').write_text(json.dumps({
        'floorTileM': TILE_M,
        'plankM': [PLANK_W, PLANK_L],
        'source': 'Poly Haven wood_floor 2k CC0',
        'wallColor': '#5A2C28',
    }, indent=2))
    jobs = [
        ('herringbone-diff.jpg', 'herringbone-diff.ktx2', True),
        ('herringbone-nor.jpg', 'herringbone-nor.ktx2', False),
        ('herringbone-rough.jpg', 'herringbone-rough.ktx2', False),
        ('bordeaux-diff.jpg', 'bordeaux-diff.ktx2', True),
        ('bordeaux-nor.jpg', 'bordeaux-nor.ktx2', False),
        ('bordeaux-rough.jpg', 'bordeaux-rough.ktx2', False),
        ('skylight.jpg', 'skylight.ktx2', True),
    ]
    for src, dest, color in jobs:
        encode(PBR / src, PBR / dest, color)
    # Mobile floor is a 2k crop of the same tile, not a second pattern.
    if size > 2048:
        for name in ('herringbone-diff.jpg', 'herringbone-nor.jpg', 'herringbone-rough.jpg'):
            image = Image.open(PBR / name)
            image.resize((2048, 2048), Image.Resampling.LANCZOS).save(PBR / name.replace('.jpg', '-mobile.jpg'), quality=90)
        encode(PBR / 'herringbone-diff-mobile.jpg', PBR / 'herringbone-diff-mobile.ktx2', True)
        encode(PBR / 'herringbone-nor-mobile.jpg', PBR / 'herringbone-nor-mobile.ktx2', False)
        encode(PBR / 'herringbone-rough-mobile.jpg', PBR / 'herringbone-rough-mobile.ktx2', False)


if __name__ == '__main__':
    main()
