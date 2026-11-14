#!/bin/bash
# Resume-safe tiled 360. Skips a tile whose .ok stamp and EXR are already there.
# Does not denoise. Assembly is a separate step after every tile exists.
#
# Final render. Default 8 tiles: the 14 Nov probe scales to about 3 h 40, ~28 min each.
#   ./render_pano_tiles.sh
# If the first tile runs past 45 min, stop and relaunch with BLANC_TILES=32
# only before any .ok stamp exists.
# Resume after a kill: run the same command again.
#
# Short pipeline test:
#   BLANC_PANO_W=1536 BLANC_PANO_H=768 BLANC_PANO_SAMPLES=16 BLANC_TILES=4 \
#   BLANC_TILE_DIR="$PWD/assets/pano-test-tiles" BLANC_COMMIT=0 \
#   BLANC_HEARTBEAT_SEC=20 ./render_pano_tiles.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
BLENDER="${BLENDER:-/tmp/downloads/blender-4.2.11-linux-x64/blender}"
# BLANC_TILES is the count (default 8). A range such as 1-4 or 5-8 renders
# only those 1-based tiles of an 8-tile frame, so two agents can split the 360.
# TILES is the same range when the other name is unset (TILES=5-8).
RAW_TILES="${TILES:-${BLANC_TILES:-8}}"
TILE_FROM=0
if [[ "$RAW_TILES" =~ ^([0-9]+)-([0-9]+)$ ]]; then
  RANGE_LO="${BASH_REMATCH[1]}"
  RANGE_HI="${BASH_REMATCH[2]}"
  if (( RANGE_LO < 1 || RANGE_HI < RANGE_LO )); then
    echo "BLANC_TILES range must look like 1-4" >&2
    exit 1
  fi
  TILE_FROM=$((RANGE_LO - 1))
  TILE_TO=$((RANGE_HI - 1))
  TILES="${BLANC_TILE_COUNT:-8}"
  if (( TILE_TO + 1 > TILES )); then
    TILES=$((TILE_TO + 1))
  fi
else
  TILES="$RAW_TILES"
  TILE_FROM=0
  TILE_TO=$((TILES - 1))
fi
TILE_DIR="${BLANC_TILE_DIR:-$ROOT/assets/pano-tiles}"
HEARTBEAT="${BLANC_HEARTBEAT_SEC:-600}"
COMMIT="${BLANC_COMMIT:-1}"
LOG="$ROOT/render-progress.log"
STATE_FILE="$(cd "$ROOT/../.." && pwd)/empty-museum/PROJECT_STATE.md"
if [[ ! -f "$STATE_FILE" ]]; then
  STATE_FILE="$ROOT/../PROJECT_STATE.md"
fi
mkdir -p "$TILE_DIR"
export BLANC_PANO_W="${BLANC_PANO_W:-6144}"
export BLANC_PANO_H="${BLANC_PANO_H:-3072}"
export BLANC_PANO_SAMPLES="${BLANC_PANO_SAMPLES:-512}"
export BLANC_THRESHOLD="${BLANC_THRESHOLD:-0.01}"
export BLANC_TILES="$TILES"
export BLANC_TILE_DIR="$TILE_DIR"
# Pass 10 look: cloud dome, shaded rocks, mirror floor at roughness 0.025.
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

echo "$(date -u +'%Y-%m-%d %H:%M:%S UTC') démarrage tuiles=$TILES ${BLANC_PANO_W}x${BLANC_PANO_H} échantillons=$BLANC_PANO_SAMPLES seuil=$BLANC_THRESHOLD" >> "$LOG"

sync_push() {
  local message="$1"
  shift
  git -C "$REPO" add "$@"
  git -C "$REPO" commit -m "$message" || return 0
  local attempt
  for attempt in 1 2 3 4 5 6; do
    if git -C "$REPO" pull --rebase origin feat/musee-blanc-nolimit && git -C "$REPO" push origin HEAD; then
      return 0
    fi
    local conflicted
    conflicted=$(git -C "$REPO" diff --name-only --diff-filter=U || true)
    if [[ -z "$conflicted" ]]; then
      sleep $((attempt * 3))
      continue
    fi
    local bad=0
    local f
    for f in $conflicted; do
      case "$f" in
        *render-progress.log|*PROJECT_STATE.md)
          python3 - "$REPO/$f" << 'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text(errors='replace')
kept = []
for line in text.splitlines(True):
    if line.startswith('<<<<<<<') or line.startswith('=======') or line.startswith('>>>>>>>'):
        continue
    kept.append(line)
path.write_text(''.join(kept))
PY
          git -C "$REPO" add "$f"
          ;;
        *)
          bad=1
          ;;
      esac
    done
    if [[ "$bad" != "0" ]]; then
      echo "rebase conflict outside the log: $conflicted" >&2
      return 1
    fi
    GIT_EDITOR=true git -C "$REPO" rebase --continue || return 1
  done
  echo "push failed after retries" >&2
  return 1
}

for ((k = TILE_FROM; k <= TILE_TO; k++)); do
  stamp=$(printf '%s/tile-%03d.ok' "$TILE_DIR" "$k")
  exr=$(printf '%s/tile-%03d.exr' "$TILE_DIR" "$k")
  if [[ -f "$stamp" && -f "$exr" ]]; then
    echo "SKIP tile $((k + 1))/$TILES"
    continue
  fi
  tile_log=$(printf '%s/tile-%03d.log' "$TILE_DIR" "$k")
  start_s=$(date +%s)
  "$BLENDER" --background --python "$ROOT/render_pano_tiles.py" -- --tile "$k" > "$tile_log" 2>&1 &
  pid=$!
  (
    while kill -0 "$pid" 2>/dev/null; do
      sleep "$HEARTBEAT"
      kill -0 "$pid" 2>/dev/null || break
      sample=$(grep -o 'Sample [0-9][0-9]*/[0-9][0-9]*' "$tile_log" | tail -1 || true)
      now=$(date -u +'%Y-%m-%d %H:%M:%S UTC')
      elapsed=$(( $(date +%s) - start_s ))
      echo "$now tuile $((k + 1))/$TILES, ${sample:-échantillon en cours}, écoulé ${elapsed}s" >> "$LOG"
      if [[ "$COMMIT" == "1" ]]; then
        sync_push "pano heartbeat tile $((k + 1))/$TILES" "$LOG" || true
      fi
    done
  ) &
  beat=$!
  wait "$pid" || status=$?
  kill "$beat" 2>/dev/null || true
  wait "$beat" 2>/dev/null || true
  if [[ "${status:-0}" != "0" ]]; then
    echo "tile $((k + 1)) failed, see $tile_log" >&2
    exit "${status:-1}"
  fi
  unset status
  end_s=$(date +%s)
  dur=$((end_s - start_s))
  if [[ "$COMMIT" == "1" ]]; then
    sync_push "pano tile $((k + 1))/$TILES" "$exr" "$stamp" "$LOG"
    sha=$(git -C "$REPO" rev-parse --short HEAD)
  else
    sha="local"
  fi
  line="$(date -u +'%Y-%m-%d %H:%M:%S UTC'). Tuile $((k + 1))/$TILES terminée, durée ${dur}s, SHA ${sha}."
  echo "$line" >> "$LOG"
  if [[ "$COMMIT" == "1" && -f "$STATE_FILE" ]]; then
    printf '\n- %s\n' "$line" >> "$STATE_FILE"
    sync_push "Record pano tile $((k + 1))/$TILES" "$STATE_FILE" "$LOG" || true
  fi
done
echo "$(date -u +'%Y-%m-%d %H:%M:%S UTC') toutes les tuiles présentes ($TILES)" >> "$LOG"
