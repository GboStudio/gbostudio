#!/usr/bin/env python3
"""Carrara marble and a bright cloud sky for the white sample room.

Original maps. No paid textures. The sky is painted here; marble veins are
domain-warped noise at a large scale so a 6 m tile does not show a repeat.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
PBR = ROOT / 'assets' / 'pbr'
TOKTX = Path('/tmp/downloads/KTX-Software-4.3.2-Linux-x86_64/bin/toktx')


def fbm(x, y, octaves=5):
    value = np.zeros_like(x, np.float32)
    amplitude = 0.55
    frequency = 1.0
    for octave in range(octaves):
        value += amplitude * np.sin(x * frequency + np.sin(y * frequency * 0.73 + octave))
        value += amplitude * 0.35 * np.sin(y * frequency * 1.3 + np.cos(x * frequency * 0.6))
        amplitude *= 0.5
        frequency *= 2.05
    return value


def marble(size=4096):
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    # 6.3 m tile. Veins run with the slab height (V), bookmatched by the mesh UVs.
    x = xs / size * 6.3
    y = ys / size * 6.3
    warp_x = fbm(x * 0.28, y * 0.18, 5)
    warp_y = fbm(x * 0.22 + 2.4, y * 0.2, 4)
    band = np.sin((x * 0.72 + warp_x * 2.6) * 1.05 + warp_y * 0.4)
    vein = np.clip((0.42 - np.abs(band)) / 0.42, 0, 1) ** 0.5
    band2 = np.sin((y * 0.22 + x * 0.18 + warp_y * 2.2) * 1.3 + 1.1)
    vein2 = np.clip((0.2 - np.abs(band2)) / 0.2, 0, 1) * 0.45
    shade = np.clip(vein * 0.95 + vein2, 0, 1)
    ground = 245 - shade * 102
    warm = shade * 3
    color = np.stack([
        np.clip(ground + warm, 0, 246),
        np.clip(ground + warm * 0.2, 0, 244),
        np.clip(ground - warm * 0.2, 0, 240),
    ], axis=2)
    gy, gx = np.gradient(shade)
    normal = np.zeros((size, size, 3), np.float32)
    normal[:, :, 0] = 128 - gx * 420
    normal[:, :, 1] = 128 - gy * 420
    normal[:, :, 2] = 255
    rough = np.clip(78 + shade * 70, 40, 170)
    return color, np.clip(normal, 0, 255), np.repeat(rough[:, :, None], 3, axis=2)


def sky(width=2048, height=1024):
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    v = ys / height
    u = xs / width
    # White cloud masses with a pale gap so the forms survive AgX, and a centre shaft.
    cloud = fbm(u * 5.4, v * 2.6, 5)
    cloud = np.clip((cloud - 0.02) * 1.55, 0, 1) ** 0.65
    sun = np.exp(-((u - 0.5) ** 2) / 0.01 - ((v - 0.34) ** 2) / 0.014)
    shaft = np.exp(-((u - 0.5) ** 2) / 0.022) * np.clip(1.15 - v, 0, 1)
    gap = np.array([188, 198, 208], np.float32)
    white = np.array([246, 247, 244], np.float32)
    rgb = gap * (1 - cloud[..., None]) + white * cloud[..., None]
    rgb += (sun * 22 + shaft * 12)[..., None]
    return np.clip(rgb, 0, 248)


def save(path, array):
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), 'RGB').save(path, quality=92)
    print(path.name, array.shape, 'mean', np.round(np.asarray(array).mean((0, 1)), 1))


def encode(src, dest, color):
    if not TOKTX.exists():
        print('toktx missing', dest.name)
        return
    subprocess.check_call([
        str(TOKTX), '--genmipmap', '--encode', 'uastc', '--uastc_quality', '2',
        '--assign_oetf', 'srgb' if color else 'linear', '--assign_primaries', 'bt709',
        str(dest), str(src),
    ])
    print('ktx2', dest.name, dest.stat().st_size)


def main():
    PBR.mkdir(parents=True, exist_ok=True)
    color, normal, rough = marble(2048 if __import__('os').environ.get('BLANC_FAST') == '1' else 4096)
    save(PBR / 'carrara-diff.jpg', color)
    normal_s = np.asarray(Image.fromarray(normal.astype(np.uint8)).resize((2048, 2048), Image.Resampling.BILINEAR))
    rough_s = np.asarray(Image.fromarray(rough.astype(np.uint8)).resize((2048, 2048), Image.Resampling.BILINEAR))
    Image.fromarray(normal_s).save(PBR / 'carrara-nor.jpg', quality=92)
    Image.fromarray(rough_s).save(PBR / 'carrara-rough.jpg', quality=92)
    save(PBR / 'sky-dome.jpg', sky())
    encode(PBR / 'carrara-diff.jpg', PBR / 'carrara-diff.ktx2', True)
    encode(PBR / 'carrara-nor.jpg', PBR / 'carrara-nor.ktx2', False)
    encode(PBR / 'carrara-rough.jpg', PBR / 'carrara-rough.ktx2', False)
    encode(PBR / 'sky-dome.jpg', PBR / 'sky-dome.ktx2', True)
    if color.shape[0] > 2048:
        Image.fromarray(color.astype(np.uint8)).resize((2048, 2048), Image.Resampling.LANCZOS).save(PBR / 'carrara-diff-mobile.jpg', quality=90)
        encode(PBR / 'carrara-diff-mobile.jpg', PBR / 'carrara-diff-mobile.ktx2', True)


if __name__ == '__main__':
    main()
