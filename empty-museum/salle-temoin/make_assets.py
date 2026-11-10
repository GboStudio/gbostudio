#!/usr/bin/env python3
"""Tileable oak, limestone and marble plus original demo paintings.

Textures contain grain, veins and pores only. Joints are never painted:
parquet joints are real gaps in the baked mesh.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)


def srgb(linear: np.ndarray) -> np.ndarray:
    linear = np.clip(linear, 0, 1)
    return np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - 0.055)


def save_rgb(path: Path, linear: np.ndarray) -> None:
    Image.fromarray((srgb(linear) * 255).astype(np.uint8), 'RGB').save(path, quality=90)


def save_linear(path: Path, value: np.ndarray) -> None:
    Image.fromarray(np.clip(value * 255, 0, 255).astype(np.uint8), 'L').save(path)


def save_normal(path: Path, height: np.ndarray, strength: float) -> None:
    h, w = height.shape
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    normal = np.dstack((-dx, dy, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    rgb = (normal * 0.5 + 0.5)
    Image.fromarray((rgb * 255).astype(np.uint8), 'RGB').save(path)


def value_noise(height: int, width: int, cells: int, seed: int, tile: bool = True) -> np.ndarray:
    rng = np.random.default_rng(seed)
    grid = rng.random((cells + 1, cells + 1))
    if tile:
        grid[-1, :] = grid[0, :]
        grid[:, -1] = grid[:, 0]
        grid[-1, -1] = grid[0, 0]
    ys = np.linspace(0, cells, height, endpoint=False)
    xs = np.linspace(0, cells, width, endpoint=False)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = (ys - y0)[:, None]
    fx = (xs - x0)[None, :]
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)
    g00 = grid[y0[:, None], x0[None, :]]
    g10 = grid[y0[:, None] + 1, x0[None, :]]
    g01 = grid[y0[:, None], x0[None, :] + 1]
    g11 = grid[y0[:, None] + 1, x0[None, :] + 1]
    return g00 * (1 - fy) * (1 - fx) + g10 * fy * (1 - fx) + g01 * (1 - fy) * fx + g11 * fy * fx


def fbm(height: int, width: int, seed: int, octaves: int = 5, tile: bool = True) -> np.ndarray:
    total = np.zeros((height, width))
    weight = 0
    amp = 1
    cells = 2
    for octave in range(octaves):
        total += amp * value_noise(height, width, cells, seed + octave * 17, tile)
        weight += amp
        amp *= 0.5
        cells *= 2
    return total / weight


def oak() -> None:
    height, width = 512, 2048
    u = np.linspace(0, 1, width, endpoint=False)[None, :]
    v = np.linspace(0, 1, height, endpoint=False)[:, None]
    warp = fbm(height, width, 3, 4)
    grain = np.sin((v * 9.0 + warp * 0.55) * np.pi * 2)
    fine = np.sin((v * 46 + warp * 1.4) * np.pi * 2)
    pore = fbm(height, width, 11, 5)
    rays = (fbm(height, width, 21, 3) > 0.72) * (fbm(height, width, 22, 2) > 0.4)
    # Edge of a single board: v is across the width. A soft roundover catches light.
    edge = np.minimum(v, 1 - v)
    bevel = np.clip(edge / 0.14, 0, 1)
    catch = 1 - np.power(bevel, 0.45) * 0.22
    base = np.array([0.28, 0.145, 0.055])
    light = np.array([0.55, 0.34, 0.15])
    mix = np.clip(0.45 + 0.38 * grain + 0.12 * fine + 0.08 * (pore - 0.5), 0, 1)
    color = base * (1 - mix[..., None]) + light * mix[..., None]
    color *= 0.82 + 0.28 * pore[..., None]
    color += rays[..., None] * np.array([0.16, 0.1, 0.04])
    color *= catch[..., None]
    height_map = (0.55 + 0.3 * grain + 0.15 * fine) * 0.5 + pore * 0.25
    height_map = height_map * (0.75 + 0.25 * bevel) 
    rough = np.clip(0.28 + 0.22 * (1 - bevel) + 0.12 * (1 - pore) + 0.05 * (fine * 0.5 + 0.5), 0.18, 0.72)
    save_rgb(OUT / 'oak-albedo.png', color)
    save_linear(OUT / 'oak-roughness.png', rough)
    save_normal(OUT / 'oak-normal.png', height_map, 2.4)
    print('oak', color.shape)


def limestone() -> None:
    height = width = 1024
    mottling = fbm(height, width, 40, 5)
    pit = fbm(height, width, 48, 6)
    base = np.array([0.62, 0.57, 0.50])
    shade = np.array([0.48, 0.44, 0.38])
    color = base * (0.86 + 0.22 * mottling[..., None]) 
    color = color * (1 - (pit > 0.78)[..., None] * 0.08) + shade * (pit > 0.78)[..., None] * 0.08
    save_rgb(OUT / 'stone-albedo.png', np.clip(color, 0, 1))
    save_normal(OUT / 'stone-normal.png', pit * 0.35 + mottling * 0.2, 1.1)
    print('stone')


def marble() -> None:
    height = width = 1024
    warp = fbm(height, width, 70, 5)
    vein = np.abs(np.sin((np.linspace(0, 1, width)[None, :] * 3.2 + warp * 2.4) * np.pi))
    vein = np.power(1 - vein, 6)
    fine = np.power(1 - np.abs(np.sin((np.linspace(0, 1, height)[:, None] * 8 + warp * 5) * np.pi)), 10)
    ground = np.array([0.72, 0.70, 0.67])
    dark = np.array([0.28, 0.27, 0.26])
    color = ground * (1 - np.clip(vein * 0.75 + fine * 0.35, 0, 1)[..., None]) + dark * np.clip(vein * 0.75 + fine * 0.35, 0, 1)[..., None]
    cloud = fbm(height, width, 81, 3)
    color *= 0.9 + 0.16 * cloud[..., None]
    save_rgb(OUT / 'marble-albedo.png', np.clip(color, 0, 1))
    rough = np.clip(0.16 + 0.18 * vein + 0.05 * (1 - cloud), 0.12, 0.45)
    save_linear(OUT / 'marble-roughness.png', rough)
    print('marble')


def paint_one(width: int, height: int, seed: int, kind: str) -> np.ndarray:
    rng = np.random.default_rng(seed)
    ys = np.linspace(0, 1, height)[:, None]
    xs = np.linspace(0, 1, width)[None, :]
    field = fbm(height, width, seed, 5, tile=False)
    field2 = fbm(height, width, seed + 9, 4, tile=False)
    if kind == 'landscape':
        horizon = 0.42 + 0.08 * np.sin(xs * np.pi * (1 + seed % 3))
        lift = (0.75 + 0.4 * (1 - ys))[:, :, None]
        sky_c = np.broadcast_to(lift * np.array([0.55, 0.62, 0.68]), (height, width, 3)).copy()
        sky_c += np.array([0.18, 0.1, 0.05]) * np.power(np.clip(field - 0.45, 0, 1), 1.3)[..., None]
        ground_c = np.array([0.22, 0.18, 0.1]) * (0.6 + field[..., None]) + np.array([0.28, 0.16, 0.08]) * field2[..., None]
        mask = np.clip((horizon - ys) * 10, 0, 1)[..., None]
        color = sky_c * mask + ground_c * (1 - mask)
        color = color + np.array([0.12, 0.08, 0.04]) * (field2 > 0.62)[..., None] * (1 - mask) * 0.5
    elif kind == 'portrait':
        bg = np.array([0.10, 0.07, 0.05]) * (0.7 + 0.5 * field[..., None])
        cx, cy = 0.5 + (seed % 5 - 2) * 0.02, 0.46
        rx, ry = 0.22, 0.30
        head = np.exp(-(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2))
        skin = np.array([0.55, 0.36, 0.24]) * (0.75 + 0.35 * field2[..., None])
        cloth = np.array([0.12, 0.08, 0.1]) * (0.8 + field[..., None])
        body = np.clip((0.72 - ys) * 3.5, 0, 1) * np.exp(-((xs - cx) / 0.34) ** 2)
        color = bg * (1 - np.clip(head + body, 0, 1)[..., None])
        color = color + skin * head[..., None] + cloth * body[..., None] * (1 - head[..., None])
    elif kind == 'still':
        color = np.array([0.16, 0.11, 0.08]) * (0.75 + 0.4 * field[..., None])
        for k in range(4):
            cx = 0.3 + (k * 0.17 + (seed % 7) * 0.01) % 0.55
            cy = 0.48 + ((k * 3 + seed) % 5) * 0.03
            blob = np.exp(-(((xs - cx) / 0.12) ** 2 + ((ys - cy) / 0.1) ** 2) * 4)
            tint = np.array([
                0.35 + 0.3 * ((k + seed) % 3) / 2,
                0.18 + 0.15 * ((k + 1) % 3) / 2,
                0.08
            ])
            color = color * (1 - blob[..., None] * 0.85) + tint * blob[..., None]
        table = np.clip((ys - 0.62) * 8, 0, 1)
        color = color * (1 - table[..., None]) + np.array([0.25, 0.16, 0.09]) * table[..., None]
    else:
        c1 = np.array([0.18 + rng.random() * 0.2, 0.1, 0.08])
        c2 = np.array([0.45, 0.32, 0.18]) * (0.6 + rng.random() * 0.5)
        color = c1 * (1 - field[..., None]) + c2 * field[..., None]
        color = color * (0.75 + 0.4 * field2[..., None])
    strokes = np.sin((xs * (18 + seed % 7) + field * 2.5) * np.pi)
    color *= 0.9 + 0.1 * strokes[..., None]
    weave = 0.94 + 0.06 * np.sin(xs * np.pi * 180) * np.sin(ys * np.pi * 180)
    color *= weave[..., None]
    vignette = np.clip(np.minimum(np.minimum(xs, 1 - xs), np.minimum(ys, 1 - ys)) / 0.18, 0, 1)
    color *= 0.72 + 0.28 * vignette[..., None]
    # A thin warm varnish, slightly uneven.
    color = np.clip(color * np.array([1.04, 0.98, 0.9]), 0, 1)
    return color.astype(np.float32)


def paintings(layout: dict) -> None:
    kinds = ['landscape', 'portrait', 'still', 'tonal']
    folder = OUT / 'paintings'
    folder.mkdir(exist_ok=True)
    for index, frame in enumerate(layout['frames']):
        kind = kinds[index % len(kinds)]
        long_side = 1024 if frame['hero'] else 640
        aspect = max(0.35, frame['artWidth'] / frame['artHeight'])
        if aspect >= 1:
            width, height = long_side, max(64, int(long_side / aspect))
        else:
            height, width = long_side, max(64, int(long_side * aspect))
        image = paint_one(width, height, 1000 + index * 13, kind)
        save_rgb(folder / f"{frame['id']}.webp", image)
    print('paintings', len(layout['frames']))


def main() -> None:
    import subprocess
    layout_path = ROOT / 'layout.json'
    subprocess.check_call(['node', '--input-type=module', '-e',
        "import {writeFileSync} from 'node:fs'; import {buildLayout} from './empty-museum/salle-temoin/room-layout.mjs';"
        "writeFileSync('empty-museum/salle-temoin/layout.json', JSON.stringify(buildLayout()));"],
        cwd=ROOT.parents[1])
    layout = json.loads(layout_path.read_text())
    oak()
    limestone()
    marble()
    paintings(layout)
    print('assets ready', OUT)


if __name__ == '__main__':
    main()
