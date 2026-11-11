#!/bin/bash
# PostToolUse hook (Edit|Write): eslint on the edited file. Exit 2 sends the failure back to Claude. The project-wide
# typecheck and tests stay in the Stop hook (scripts/check.sh).
set -u

file=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)

case "$file" in
  */src/api/api.gen.ts) exit 0 ;; # generated; npm run sync:api owns it
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
[ -f "$file" ] || exit 0

if ! out=$(npx eslint --no-warn-ignored "$file" 2>&1); then
  echo "eslint failed after editing $file:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
