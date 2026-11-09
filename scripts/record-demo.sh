#!/usr/bin/env bash
# Records docs/demo.gif by driving the app in the iOS Simulator with Maestro.
# Before running: boot a simulator with Expo Go installed, start `npx expo start` in another terminal, and export
# MAESTRO_DEMO_USER and MAESTRO_DEMO_PASS for a demo account (never a real one with private chats, never committed).
# With a video as $1, skips the recording and only converts it.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg > /dev/null || { echo "ffmpeg is not installed" >&2; exit 1; }

if [ $# -ge 1 ]; then
  raw=$1
else
  command -v maestro > /dev/null || { echo "maestro is not installed" >&2; exit 1; }
  : "${MAESTRO_DEMO_USER:?set MAESTRO_DEMO_USER}" "${MAESTRO_DEMO_PASS:?set MAESTRO_DEMO_PASS}"
  marker=$(mktemp "${TMPDIR:-/tmp}/demo-marker.XXXXXX")
  trap 'rm -f "$marker"' EXIT
  maestro test .maestro/demo.yaml
  # Maestro saves recordings in its own output folder (~/.maestro/tests/<run>/...), not at the path given in the flow.
  raw=$(find "$HOME/.maestro/tests" -name 'demo-raw.mp4' -newer "$marker" -print0 | xargs -0 ls -t 2> /dev/null | head -1)
  [ -n "$raw" ] || { echo "no recording found under ~/.maestro/tests" >&2; exit 1; }
fi

mkdir -p docs
# Two passes so the GIF gets its own palette; 12 fps and 360px wide keep it small enough for a README.
palette="${TMPDIR:-/tmp}/demo-palette.png"
ffmpeg -y -loglevel error -i "$raw" -vf "fps=12,scale=360:-1:flags=lanczos,palettegen" "$palette"
ffmpeg -y -loglevel error -i "$raw" -i "$palette" -lavfi "fps=12,scale=360:-1:flags=lanczos[x];[x][1:v]paletteuse" docs/demo.gif
rm -f "$palette"
echo "wrote docs/demo.gif ($(du -h docs/demo.gif | cut -f1))"
