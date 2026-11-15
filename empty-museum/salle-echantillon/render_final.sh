#!/bin/bash
# Delivery renders for the grandiose nave. Rebuilds the scene, then renders.
# 4K: 3840×2160, 64 samples, threshold 0.02.
# 360: tiled, 6144×3072, 512 samples, threshold 0.01, via render_pano_tiles.sh.
# The 14 Nov grandiose pass did not launch either of those. See PROJECT_STATE.md.
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
# Visible sky: CC0 cumulus band on the shell, desaturated and lifted. World light is the 1K puresky.
export BLANC_HDRI="${BLANC_HDRI:-kloofendal_48d_partly_cloudy_puresky_1k.hdr}"
export BLANC_SKY_FULL="${BLANC_SKY_FULL:-1}"
export BLANC_SKY_SAT="${BLANC_SKY_SAT:-0}"
export BLANC_EXPOSURE="${BLANC_EXPOSURE:--1.94}"
export BLANC_LOOK="${BLANC_LOOK:-AgX - Medium High Contrast}"
export BLANC_SUN="${BLANC_SUN:-0.1}"
export BLANC_SUN_HIGH="${BLANC_SUN_HIGH:-1}"
export BLANC_SKY_STRENGTH="${BLANC_SKY_STRENGTH:-0.038}"
export BLANC_SKY_VIEW="${BLANC_SKY_VIEW:-8.4}"
export BLANC_SKY_RAW="${BLANC_SKY_RAW:-0}"
export BLANC_SKY_BAND="${BLANC_SKY_BAND:-1}"
export BLANC_SKY_WHITE="${BLANC_SKY_WHITE:-0}"
export BLANC_SKY_CONTRAST="${BLANC_SKY_CONTRAST:-40}"
export BLANC_SKY_BRIGHT="${BLANC_SKY_BRIGHT:-0.24}"
export BLANC_SKY_LIFT="${BLANC_SKY_LIFT:-0.85}"
export BLANC_SKY_WASH="${BLANC_SKY_WASH:-0.74}"
export BLANC_SKY_CORE="${BLANC_SKY_CORE:-0.42}"
export BLANC_SKY_END="${BLANC_SKY_END:-0.96}"
export BLANC_SKY_ANGULAR="${BLANC_SKY_ANGULAR:-1}"
export BLANC_SKY_ANG_Z0="${BLANC_SKY_ANG_Z0:--0.02}"
export BLANC_SKY_ANG_Z1="${BLANC_SKY_ANG_Z1:-0.75}"
export BLANC_SKY_ANG_V0="${BLANC_SKY_ANG_V0:-0.22}"
export BLANC_SKY_ANG_V1="${BLANC_SKY_ANG_V1:-0.72}"
export BLANC_SKY_FOLD_MUL="${BLANC_SKY_FOLD_MUL:-1.35}"
export BLANC_SKY_FOLD_ADD="${BLANC_SKY_FOLD_ADD:-0.06}"
export BLANC_SKY_GAMMA="${BLANC_SKY_GAMMA:-1}"
export BLANC_SKY_VIEW_CONTRAST="${BLANC_SKY_VIEW_CONTRAST:-8}"
export BLANC_SKY_SPHERE="${BLANC_SKY_SPHERE:-1}"
export BLANC_SKY_U="${BLANC_SKY_U:-0.32}"
export BLANC_SKY_V="${BLANC_SKY_V:-0}"
export BLANC_SPOT="${BLANC_SPOT:-160}"
export BLANC_SPOT_TIGHT="${BLANC_SPOT_TIGHT:-1}"
export BLANC_SPOT_DEG="${BLANC_SPOT_DEG:-40}"
export BLANC_SPOT_BLEND="${BLANC_SPOT_BLEND:-0.55}"
export BLANC_SKY_ROT="${BLANC_SKY_ROT:-0}"
export BLANC_SKY_PITCH="${BLANC_SKY_PITCH:-0}"
export BLANC_HORIZON="${BLANC_HORIZON:-0}"
export BLANC_ROCK_MARBLE="${BLANC_ROCK_MARBLE:-0}"
export BLANC_ROCK_BRIGHT="${BLANC_ROCK_BRIGHT:--0.02}"
export BLANC_ROCK_SUN="${BLANC_ROCK_SUN:-110}"
export BLANC_ROCK_SHADE="${BLANC_ROCK_SHADE:-1}"
export BLANC_ROCK_UP="${BLANC_ROCK_UP:-1}"
export BLANC_ROCK_SHADE_MIN="${BLANC_ROCK_SHADE_MIN:-0.50}"
export BLANC_ROCK_PALE="${BLANC_ROCK_PALE:-0.52}"
export BLANC_ROCK_NORMAL="${BLANC_ROCK_NORMAL:-1.7}"
export BLANC_ROCK_CAVITY="${BLANC_ROCK_CAVITY:-0.22}"
export BLANC_VEIN_CONTRAST="${BLANC_VEIN_CONTRAST:-32}"
export BLANC_WALL_BRIGHT="${BLANC_WALL_BRIGHT:--0.07}"
export BLANC_CLOUD="${BLANC_CLOUD:-0}"
export BLANC_PUFFS="${BLANC_PUFFS:-0}"
export BLANC_GODRAY="${BLANC_GODRAY:-0}"
export BLANC_HAZE="${BLANC_HAZE:-0}"
export BLANC_VOL_BOUNCES="${BLANC_VOL_BOUNCES:-0}"
export BLANC_END_BAY="${BLANC_END_BAY:-0}"
export BLANC_HEIGHT="${BLANC_HEIGHT:-6.8}"
export BLANC_HALL_END="${BLANC_HALL_END:-34}"
export BLANC_ROCK_FIELD="${BLANC_ROCK_FIELD:-1}"
export BLANC_ROCK_FACES="${BLANC_ROCK_FACES:-1800}"
export BLANC_ROCK_GREY="${BLANC_ROCK_GREY:-1.15}"
export BLANC_ROCK_STRETCH="${BLANC_ROCK_STRETCH:-1.05}"
export BLANC_HFOV="${BLANC_HFOV:-68}"
export BLANC_EYE="${BLANC_EYE:-1.5}"
export BLANC_CAM_Y="${BLANC_CAM_Y:-1.15}"
export BLANC_AIM_Y="${BLANC_AIM_Y:-28}"
export BLANC_AIM_Z="${BLANC_AIM_Z:-2.05}"
export BLANC_FLAT_WALLS="${BLANC_FLAT_WALLS:-0}"
export BLANC_MIST="${BLANC_MIST:-1}"
export BLANC_MIST_AMOUNT="${BLANC_MIST_AMOUNT:-0.52}"
export BLANC_BLOOM="${BLANC_BLOOM:-1}"
export BLANC_BLOOM_MIX="${BLANC_BLOOM_MIX:--0.45}"
export BLANC_SHAFT="${BLANC_SHAFT:-1}"
export BLANC_SHAFT_AMT="${BLANC_SHAFT_AMT:-0.38}"
export BLANC_SUN_ANGLE="${BLANC_SUN_ANGLE:-18}"
export BLANC_END_GLOW="${BLANC_END_GLOW:-0}"
export BLANC_MIRROR="${BLANC_MIRROR:-1}"
export BLANC_FLOOR_SOFT="${BLANC_FLOOR_SOFT:-1}"
export BLANC_FLOOR_FLAT="${BLANC_FLOOR_FLAT:-0}"
export BLANC_FLOOR_ROUGH="${BLANC_FLOOR_ROUGH:-0.12}"
export BLANC_FLOOR_SPEC="${BLANC_FLOOR_SPEC:-0.36}"
export BLANC_FLOOR_ROUGH_VAR="${BLANC_FLOOR_ROUGH_VAR:-0}"
export BLANC_FLOOR_NORMAL="${BLANC_FLOOR_NORMAL:-0.15}"
export BLANC_GOLD="${BLANC_GOLD:-0.52,0.37,0.16}"
export BLANC_GOLD_ROUGH="${BLANC_GOLD_ROUGH:-0.44}"
export BLANC_GOLD_AO="${BLANC_GOLD_AO:-0.55}"
export BLANC_CLAMP="${BLANC_CLAMP:-8}"
export BLANC_ENTRY="${BLANC_ENTRY:-1}"
export BLANC_MIN_SAMPLES="${BLANC_MIN_SAMPLES:-16}"
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
