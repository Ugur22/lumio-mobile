#!/usr/bin/env bash
# Regenerates src/api/api.gen.ts (or the path given as $1) from openapi.json in the lumio repo.
# Ref: LUMIO_API_REF or --ref <branch|tag|sha>, default main. Same openapi-typescript version and flags as the web app.
set -euo pipefail
cd "$(dirname "$0")/.."
ref=${LUMIO_API_REF:-main}
out=src/api/api.gen.ts
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) ref=${2:?--ref needs a value}; shift 2 ;;
    *) out=$1; shift ;;
  esac
done
tmp=$(mktemp -d "${TMPDIR:-/tmp}/lumio-api.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "https://raw.githubusercontent.com/Ugur22/lumio/$ref/openapi.json" -o "$tmp/openapi.json" \
  || { echo "could not download openapi.json at ref '$ref' from Ugur22/lumio" >&2; exit 1; }
./node_modules/.bin/openapi-typescript "$tmp/openapi.json" --default-non-nullable false -o "$out" > /dev/null
