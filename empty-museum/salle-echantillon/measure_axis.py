#!/usr/bin/env python3
"""Linear luma and CIE L* of an axis still, same regions as the white-room target.

Target numbers used by the barrier: mean linear luma 0.558 ±15%, wall L* 72–86,
sky L* above the walls. The reference crop is the left panel of
review/compare-axis-pass10.jpg (the cible-v3-02 picture kept in the compares).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

OFFICIAL_LUMA = 0.558
BAND = 0.15


def linear_srgb(rgb):
    c = rgb.astype(np.float32) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lightness(linear):
    y = 0.2126729 * linear[..., 0] + 0.7151522 * linear[..., 1] + 0.0721750 * linear[..., 2]
    delta = 6 / 29
    f = np.where(y > delta ** 3, np.cbrt(y), y / (3 * delta * delta) + 4 / 29)
    return 116 * f - 16


def region(pic, x0, x1, y0, y1):
    h, w = pic.shape[:2]
    return pic[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]


def measure(path):
    image = Image.open(path).convert('RGB')
    rgb = np.asarray(image.resize((400, 225), Image.Resampling.LANCZOS))
    linear = linear_srgb(rgb)
    luma = 0.2126 * linear[..., 0] + 0.7152 * linear[..., 1] + 0.0722 * linear[..., 2]
    lab = lightness(linear)
    wall = np.concatenate([
        region(lab, 0.02, 0.12, 0.18, 0.40).ravel(),
        region(lab, 0.88, 0.98, 0.18, 0.40).ravel(),
    ])
    sky = region(lab, 0.36, 0.64, 0.08, 0.30)
    end = region(lab, 0.42, 0.58, 0.36, 0.52)
    mean = float(luma.mean())
    return {
        'file': str(path),
        'size': list(image.size),
        'luma_mean': round(mean, 3),
        'luma_median': round(float(np.median(luma)), 3),
        'luma_vs_target': round(mean / OFFICIAL_LUMA - 1, 3),
        'luma_in_band': abs(mean - OFFICIAL_LUMA) <= OFFICIAL_LUMA * BAND,
        'wall_L': round(float(wall.mean()), 1),
        'wall_in_band': 72 <= float(wall.mean()) <= 86,
        'sky_L': round(float(sky.mean()), 1),
        'sky_std': round(float(sky.std()), 1),
        'sky_above_walls': float(sky.mean()) > float(wall.mean()),
        'end_L': round(float(end.mean()), 1),
        'end_std': round(float(end.std()), 1),
    }


def main():
    rows = [measure(Path(arg)) for arg in sys.argv[1:]]
    print(json.dumps(rows, indent=2))


if __name__ == '__main__':
    main()
