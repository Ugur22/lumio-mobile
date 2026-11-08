#!/bin/bash
# Stop hook: block "done" while types or tests fail. Exit 2 sends the output back to Claude.
cd "$(dirname "$0")/.." || exit 0
# A second stop in the same turn means Claude already had its chance to fix it; don't loop.
grep -q '"stop_hook_active": *true' && exit 0
out=$( (npx tsc --noEmit && npx vitest run) 2>&1 ) || { echo "$out" | tail -40 >&2; exit 2; }
