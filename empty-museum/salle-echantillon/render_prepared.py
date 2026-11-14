#!/usr/bin/env python3
"""Render the already-built white room. Does not rebuild the scene.

    blender --background assets/musee-blanc-prepared.blend --python render_prepared.py -- --still
    blender --background assets/musee-blanc-prepared.blend --python render_prepared.py -- --pano
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from bake_musee_blanc import pano, still


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if '--pano' in args:
        pano()
        return
    still()


if __name__ == '__main__':
    main()
