#!/bin/bash
# Fails when fewer tests are collected than scripts/test-baseline.txt records, so removing tests cannot turn a run green.
# Intentional removals: run with --update and have the baseline change reviewed.
set -eu

cd "$(dirname "$0")/.."
baseline=scripts/test-baseline.txt

vitest_count=$(npx vitest list 2>/dev/null | grep -c ' > ' || true)

if [ "${1:-}" = "--update" ]; then
  printf 'vitest=%s\n' "$vitest_count" > "$baseline"
  echo "baseline updated: vitest=$vitest_count"
  exit 0
fi

want=$(grep '^vitest=' "$baseline" | cut -d= -f2)
if [ "$vitest_count" -lt "$want" ]; then
  echo "vitest: $vitest_count tests, baseline $want" >&2
  echo "test count dropped below scripts/test-baseline.txt; if intentional, run scripts/check-test-count.sh --update and have the change reviewed" >&2
  exit 1
fi
