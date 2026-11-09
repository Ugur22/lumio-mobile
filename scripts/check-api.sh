#!/usr/bin/env bash
# Fails when src/api/api.gen.ts differs from what the backend's openapi.json generates. Needs the network, so it is not in the Stop hook.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp "${TMPDIR:-/tmp}/api-gen.XXXXXX")
trap 'rm -f "$tmp"' EXIT
scripts/sync-api.sh "$tmp"
cmp -s "$tmp" src/api/api.gen.ts || { echo "src/api/api.gen.ts is out of date with the lumio API. Run: npm run sync:api" >&2; exit 1; }
echo "api types match the backend"
