#!/bin/bash
# Stop hook: block "done" while `npm run check` (typecheck, tests, lint) is red. Exit 2 sends the output back to Claude.
set -u
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

session=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null)
session=${session//[^A-Za-z0-9_-]/}

# Skip the check when no source file changed since the last green run (mtime, so edits made through Bash count too).
stamp=".claude/.check-stamp"
if [ -f "$stamp" ] && [ -z "$(find . \
    \( -path ./node_modules -o -path ./.git -o -path ./.expo -o -path ./.claude -o -path ./ios -o -path ./android -o -path ./docs \) -prune -o \
    -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' -o -name '*.css' -o -name '*.sh' \) \
    -newer "$stamp" -print -quit)" ]; then
  exit 0
fi

# Cap consecutive blocks per session so a failure Claude cannot fix never traps it.
counter="${TMPDIR:-/tmp}/lumio-mobile-stop-blocks-${session:-default}"
blocks=$(cat "$counter" 2>/dev/null || echo 0)

if out=$(npm run --silent check 2>&1); then
  rm -f "$counter"
  touch "$stamp"
  exit 0
fi

if [ "$blocks" -ge 3 ]; then
  rm -f "$counter"
  echo "npm run check still failing after 3 blocked stops; letting the session end. Report the failure to the user." >&2
  exit 0
fi

echo $((blocks + 1)) > "$counter"
echo "npm run check failed; fix before finishing:" >&2
echo "$out" | tail -40 >&2
exit 2
