#!/bin/bash
# Final delivery renders. Rebuilds the pass-8 scene, then renders.
# 4K: 3840×2160, 64 samples, threshold 0.02.
# 360: tiled, 6144×3072, 512 samples, threshold 0.01, via render_pano_tiles.sh.
#
# Measured on this machine, Blender 4.2.11 Cycles CPU, 14 November 2026:
#   800×450, 8 samples, OIDN, volumes on: 23.9 s (mean of four frames)
#   = 2.98 s/sample at 0.36 megapixel = 8.3 s/sample/megapixel
#   Adaptive threshold 0.08 did not stop early: every frame reached sample 8/8.
#   4K 3840×2160 is 23.0× the pixels → 69 s/sample.
#     128 samples, if they all run: about 2 h 30. OIDN adds about a minute.
#     Adaptive at 0.015 may shave some wall samples, not the sky volume. Plan on 2 h to 2 h 30.
#   360° 6144×3072 is 52.4× the pixels → 2.6 min/sample.
#     512 samples, if they all run: about 22 h. Threshold 0.01 will not turn a volume sky into a short render.
#     128 samples would be about 5 h 30. That is not what this script launches.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BLENDER="${BLENDER:-/tmp/downloads/blender-4.2.11-linux-x64/blender}"
BLEND="$ROOT/assets/musee-blanc-prepared.blend"
MODE="${1:-still}"
export BLANC_EXPOSURE="${BLANC_EXPOSURE:--1.6}"
export BLANC_SUN="${BLANC_SUN:-2}"
export BLANC_SKY_STRENGTH="${BLANC_SKY_STRENGTH:-0.35}"
export BLANC_SKY_VIEW="${BLANC_SKY_VIEW:-2.5}"
export BLANC_SKY_GAMMA="${BLANC_SKY_GAMMA:-1}"
export BLANC_SPOT="${BLANC_SPOT:-900}"
export BLANC_SPOT_TIGHT="${BLANC_SPOT_TIGHT:-1}"
export BLANC_SKY_ROT="${BLANC_SKY_ROT:-40}"
export BLANC_SKY_PITCH="${BLANC_SKY_PITCH:-0}"
export BLANC_HORIZON="${BLANC_HORIZON:-0}"
export BLANC_ROCK_MARBLE="${BLANC_ROCK_MARBLE:-1}"
export BLANC_ROCK_BRIGHT="${BLANC_ROCK_BRIGHT:--0.35}"
export BLANC_ROCK_SUN="${BLANC_ROCK_SUN:-40}"
export BLANC_ROCK_SHADE="${BLANC_ROCK_SHADE:-1}"
export BLANC_ROCK_SHADE_MIN="${BLANC_ROCK_SHADE_MIN:-0.20}"
export BLANC_ROCK_CAVITY="${BLANC_ROCK_CAVITY:-0.40}"
export BLANC_VEIN_CONTRAST="${BLANC_VEIN_CONTRAST:-14}"
export BLANC_CLOUD="${BLANC_CLOUD:-3.4}"
export BLANC_CLOUD_DOME="${BLANC_CLOUD_DOME:-1}"
export BLANC_CLOUD_GAMMA="${BLANC_CLOUD_GAMMA:-1.6}"
export BLANC_END_GLOW="${BLANC_END_GLOW:-0}"
export BLANC_MIRROR="${BLANC_MIRROR:-1}"
export BLANC_FLOOR_FLAT="${BLANC_FLOOR_FLAT:-1}"
export BLANC_FLOOR_ROUGH="${BLANC_FLOOR_ROUGH:-0.025}"
export BLANC_FLOOR_ROUGH_VAR="${BLANC_FLOOR_ROUGH_VAR:-0.008}"
export BLANC_FLOOR_NORMAL="${BLANC_FLOOR_NORMAL:-0.02}"
export BLANC_CLAMP="${BLANC_CLAMP:-8}"
export BLANC_ENTRY="${BLANC_ENTRY:-1}"
export BLANC_MIN_SAMPLES="${BLANC_MIN_SAMPLES:-12}"
if [[ "$MODE" == "still" ]]; then
  export BLANC_THRESHOLD="${BLANC_THRESHOLD:-0.02}"
  export BLANC_STILL_W="${BLANC_STILL_W:-3840}"
  export BLANC_STILL_H="${BLANC_STILL_H:-2160}"
  export BLANC_STILL_SAMPLES="${BLANC_STILL_SAMPLES:-64}"
  export BLANC_STILL_NAME="${BLANC_STILL_NAME:-landing-4k.jpg}"
  exec "$BLENDER" --background --python "$ROOT/bake_musee_blanc.py" -- --still
fi
if [[ "$MODE" == "pano" ]]; then
  export BLANC_THRESHOLD="${BLANC_THRESHOLD:-0.01}"
  export BLANC_PANO_W="${BLANC_PANO_W:-6144}"
  export BLANC_PANO_H="${BLANC_PANO_H:-3072}"
  export BLANC_PANO_SAMPLES="${BLANC_PANO_SAMPLES:-512}"
  exec "$ROOT/render_pano_tiles.sh"
fi
echo "usage: $0 still|pano" >&2
exit 1
