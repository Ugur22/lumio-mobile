#!/usr/bin/env bash
# Screenshot of the simulator window with the iPhone bezel: title bar and toolbar cropped off, background transparent
# (filters in framed-filters.sh). Put the app on the screen you want first (for the README login image: sign out), keep
# the window visible, and run from a normal terminal tab with Screen Recording allowed.
# Usage: scripts/screenshot-framed.sh [out.png]   (default docs/login.png)
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg > /dev/null || { echo "ffmpeg is not installed" >&2; exit 1; }
out=${1:-docs/login.png}

window_id=$(scripts/sim-window.sh)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/screenshot-framed.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
raw="$tmp/window.png"
screencapture -x -o -l "$window_id" "$raw"
[ -s "$raw" ] || { echo "screencapture wrote nothing; check Screen Recording permission for this terminal" >&2; exit 1; }

source scripts/framed-filters.sh
mkdir -p "$(dirname "$out")"
ffmpeg -y -loglevel error -i "$raw" -vf "$bezel_crop,$bezel_mask" -frames:v 1 "$out"
echo "wrote $out ($(du -h "$out" | cut -f1))"
