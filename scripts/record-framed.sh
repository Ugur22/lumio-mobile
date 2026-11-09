#!/usr/bin/env bash
# Records the demo with the iPhone bezel: films the simulator window (which draws the device frame) with screencapture
# while Maestro drives the app, then crops and masks it into docs/demo.gif (filters in framed-filters.sh).
# Before running: boot a simulator with Expo Go (window visible, bezel shown), start `npx expo start`, give your terminal
# Screen Recording permission, and export MAESTRO_DEMO_USER and MAESTRO_DEMO_PASS.
# The still lead-in is cut automatically; set TRIM_START=<seconds> to choose the cut yourself.
# With a .mov as $1, skips the recording and only converts it.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg > /dev/null || { echo "ffmpeg is not installed" >&2; exit 1; }

if [ $# -ge 1 ]; then
  raw=$1
else
  command -v maestro > /dev/null || { echo "maestro is not installed" >&2; exit 1; }
  : "${MAESTRO_DEMO_USER:?set MAESTRO_DEMO_USER}" "${MAESTRO_DEMO_PASS:?set MAESTRO_DEMO_PASS}"
  window_id=$(scripts/sim-window.sh)

  raw="${TMPDIR:-/tmp}/demo-framed-raw.mov"
  rm -f "$raw"
  # Sign in before filming so the video opens on an empty chat.
  maestro test .maestro/subflows/signed-in.yaml
  screencapture -v -o -l "$window_id" "$raw" &
  rec=$!
  # SIGINT is what makes screencapture finalize the file; also stop it when the flow fails.
  stop_rec() { kill -INT "$rec" 2> /dev/null || true; wait "$rec" 2> /dev/null || true; }
  trap stop_rec EXIT
  sleep 2
  kill -0 "$rec" 2> /dev/null || { echo "screencapture exited at once; check Screen Recording permission for this terminal" >&2; exit 1; }
  maestro test .maestro/subflows/demo-chat.yaml
  stop_rec
  [ -s "$raw" ] || { echo "screencapture wrote no video; check Screen Recording permission" >&2; exit 1; }
fi

mkdir -p docs
source scripts/framed-filters.sh
# Maestro needs a few seconds to start before the first tap, so the video opens on a still chat. Cut that idle lead-in
# (keeping half a second) unless TRIM_START says otherwise. Detection runs on tiny frames: it only needs to see change.
start=${TRIM_START:-$(ffmpeg -hide_banner -i "$raw" -vf "fps=4,scale=iw/4:-1,freezedetect=n=-50dB:d=1" -an -f null - 2>&1 |
  LC_ALL=C awk '/freeze_start: 0$/ {f=1} f && /freeze_end/ {s = $NF - 0.5; print (s > 0 ? s : 0); exit}')}
# The palette is built from the same clip in one pass. GIF transparency is on or off per pixel, so the phone's edge is
# slightly jagged; reserve_transparent / alpha_threshold keep the area outside the bezel see-through.
ffmpeg -y -loglevel error -ss "${start:-0}" -i "$raw" \
  -vf "$bezel_crop,fps=12,scale=420:-1:flags=lanczos,$bezel_mask,split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128" \
  docs/demo.gif
# ffmpeg writes every frame in full while the GIF has transparency; gifsicle stores only what changes between frames.
if command -v gifsicle > /dev/null; then
  gifsicle -O3 --batch docs/demo.gif
else
  echo "gifsicle not installed (brew install gifsicle): the GIF stays large" >&2
fi
echo "wrote docs/demo.gif ($(du -h docs/demo.gif | cut -f1))"
