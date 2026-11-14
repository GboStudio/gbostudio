#!/bin/bash
# Final delivery renders for the white sample room.
# The blend is already built. This does not rebuild the meshes.
# Pass 5 did not clear the barrier. Run these only if that decision changes.
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
export BLANC_EXPOSURE="${BLANC_EXPOSURE:--1.25}"
export BLANC_MIN_SAMPLES="${BLANC_MIN_SAMPLES:-12}"
if [[ ! -f "$BLEND" ]]; then
  echo "missing $BLEND — build it with: $BLENDER --background --python $ROOT/bake_musee_blanc.py -- --save-blend" >&2
  exit 1
fi
if [[ "$MODE" == "still" ]]; then
  export BLANC_THRESHOLD="${BLANC_THRESHOLD:-0.015}"
  export BLANC_STILL_W="${BLANC_STILL_W:-3840}"
  export BLANC_STILL_H="${BLANC_STILL_H:-2160}"
  export BLANC_STILL_SAMPLES="${BLANC_STILL_SAMPLES:-128}"
  export BLANC_STILL_NAME="${BLANC_STILL_NAME:-landing-4k.jpg}"
  exec "$BLENDER" --background "$BLEND" --python "$ROOT/render_prepared.py" -- --still
fi
if [[ "$MODE" == "pano" ]]; then
  export BLANC_THRESHOLD="${BLANC_THRESHOLD:-0.01}"
  export BLANC_PANO_W="${BLANC_PANO_W:-6144}"
  export BLANC_PANO_H="${BLANC_PANO_H:-3072}"
  export BLANC_PANO_SAMPLES="${BLANC_PANO_SAMPLES:-512}"
  export BLANC_PANO_NAME="${BLANC_PANO_NAME:-pano-360.jpg}"
  exec "$BLENDER" --background "$BLEND" --python "$ROOT/render_prepared.py" -- --pano
fi
echo "usage: $0 still|pano" >&2
exit 1
