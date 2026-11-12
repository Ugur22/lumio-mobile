#!/bin/bash
# Visual check: runs the Maestro flows in .maestro/visual against the Lumio stub backend in light and dark mode and saves
# screenshots in .maestro/screenshots/ (git-ignored) for review. Booting a simulator is slow, so run it once at the end of
# a task and only when the diff needs it; never from a hook. See "Visual check" in AGENTS.md.
#
#   scripts/visual-check.sh --needed   say whether the diff needs it and which flows (exit 0 = yes, 1 = no)
#   scripts/visual-check.sh            run it when the diff needs it
#   scripts/visual-check.sh --force    run it anyway (same as VISUAL_CHECK=force); VISUAL_CHECK=skip does nothing
#   scripts/visual-check.sh --flows login,chat   run only these flows (login chat provider-sheet drawer)
#
# Needs the stub backend (make e2e-mobile-server in the lumio repo, on VISUAL_STUB_URL, default http://127.0.0.1:18766),
# maestro, and a simulator with Expo Go. Run it from a normal terminal: Claude's sandbox cannot reach the simulator.
set -euo pipefail
cd "$(dirname "$0")/.."

STUB=${VISUAL_STUB_URL:-http://127.0.0.1:18766}
OUT=.maestro/screenshots
ALL_FLOWS="login chat provider-sheet drawer"

die() { echo "visual-check: $*" >&2; exit 1; }

mode=${VISUAL_CHECK:-auto}
only=""
want_decision=0
while [ $# -gt 0 ]; do
  case "$1" in
    --needed) want_decision=1 ;;
    --force) mode=force ;;
    --flows) [ $# -ge 2 ] || die "--flows needs a comma-separated list ($ALL_FLOWS)"; only=$2; shift ;;
    *) die "unknown option $1" ;;
  esac
  shift
done

base=${VISUAL_BASE:-origin/main}
git rev-parse --verify -q "$base" >/dev/null || base=main
fork=$(git merge-base "$base" HEAD)

# Committed and uncommitted tracked changes against the fork point, plus untracked files as additions.
untracked=$(git ls-files --others --exclude-standard)
changes=$(git diff --name-status "$fork"; awk 'NF {print "A\t" $0}' <<< "$untracked")

needed=0 all=0 reason="" flows=""
trigger() { needed=1; reason="${reason:+$reason; }$1"; }
add_flow() { case " $flows " in *" $1 "*) ;; *) flows="$flows $1" ;; esac; }

while IFS=$'\t' read -r status a b; do
  [ -n "$status" ] || continue
  path=${b:-$a}
  case "$path" in
    src/app/*)
      case "$status" in A*|D*|R*) trigger "route added, removed or renamed ($path)"; all=1 ;; esac
      case "$path" in */_layout.tsx) trigger "navigation ($path)"; all=1 ;; esac ;;
    src/components/ui/*|tailwind.config.js|src/global.css|src/lib/theme.ts)
      trigger "shared building block or theme token ($path)"; all=1 ;;
  esac
  # Which flows show the files that changed; only used to narrow a run that something above or below triggered.
  case "$path" in
    src/app/login.tsx) add_flow login ;;
    "src/app/(drawer)/index.tsx"|src/components/Composer.tsx|src/components/Bubble.tsx|src/components/Reply.tsx|src/components/ThinkingStatus.tsx|src/components/JumpToLatest.tsx|src/components/FlashNotice.tsx|src/components/AttachedImage.tsx|src/components/ImageLightbox.tsx|src/components/IllustrationNotes.tsx) add_flow chat ;;
    src/components/Provider*.tsx|src/components/AddProviderSheet.tsx|src/components/EmptyProviders.tsx|src/components/WebSetupSheet.tsx) add_flow provider-sheet ;;
    src/components/ChatDrawer.tsx|src/components/RenameDialog.tsx) add_flow drawer ;;
  esac
done <<< "$changes"

# Added or removed lines count, and so does the content of untracked files. Captured first: grep -q closing the pipe
# early would make a piped git diff fail under pipefail.
touched=$(git diff -U0 "$fork" -- src | grep -E '^[+-]' | grep -Ev '^(\+\+\+|---)' || true)
while IFS= read -r f; do
  case "$f" in src/*) touched="$touched"$'\n'$(cat "$f") ;; esac
done <<< "$untracked"
if grep -Eq 'Keyboard|SafeArea|useSafeAreaInsets|useWindowDimensions|Dimensions\.' <<< "$touched"; then
  trigger "keyboard, safe area or screen size code in the diff"
fi

if [ "$all" -eq 1 ] || [ -z "$flows" ]; then flows=$ALL_FLOWS; fi
if [ -n "$only" ]; then
  flows=${only//,/ }
  for f in $flows; do
    case " $ALL_FLOWS " in *" $f "*) ;; *) die "unknown flow $f (flows: $ALL_FLOWS)" ;; esac
  done
fi

if [ "$want_decision" -eq 1 ]; then
  if [ "$needed" -eq 1 ]; then echo "needed: $reason. Flows:$(printf ' %s' $flows)"; exit 0; fi
  echo "not needed: no new route, navigation, shared UI, theme, keyboard or safe-area change in the diff"
  exit 1
fi

if [ "$mode" = skip ]; then echo "visual check skipped (VISUAL_CHECK=skip)"; exit 0; fi
if [ "$needed" -eq 0 ] && [ "$mode" != force ]; then
  echo "visual check not needed: no new route, navigation, shared UI, theme, keyboard or safe-area change in the diff (--force runs it anyway)"
  exit 0
fi
[ "$needed" -eq 1 ] && echo "visual check needed: $reason"

command -v maestro >/dev/null || die "maestro is not installed (brew install mobile-dev-inc/tap/maestro)"
curl -s -o /dev/null --max-time 3 "$STUB" || die "no stub backend at $STUB; start it in the lumio repo with: make e2e-mobile-server"
if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
  die "port 8081 is in use, probably a dev server pointing at the real backend; stop it first"
fi

if ! xcrun simctl list devices booted | grep -q '(Booted)'; then
  udid=${VISUAL_DEVICE:-}
  if [ -z "$udid" ]; then
    # An iPhone simulator that already has Expo Go; the last one listed otherwise. (A shut-down device cannot be asked
    # with simctl, so look for the app in its data folder.)
    for u in $(xcrun simctl list devices available | grep 'iPhone' | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}'); do
      fallback=$u
      if grep -qs host.exp.Exponent "$HOME/Library/Developer/CoreSimulator/Devices/$u/data/Containers/Bundle/Application/"*/*.app/Info.plist; then
        udid=$u; break
      fi
    done
    udid=${udid:-${fallback:-}}
  fi
  [ -n "$udid" ] || die "no iPhone simulator available (set VISUAL_DEVICE to a simulator id)"
  xcrun simctl boot "$udid"
  # Newer Xcode shows simulators in "Device Hub" instead of "Simulator".
  open -a Simulator 2>/dev/null || open -a "Device Hub" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
fi
xcrun simctl get_app_container booted host.exp.Exponent >/dev/null 2>&1 \
  || die "Expo Go is not installed in the booted simulator. Shut it down (xcrun simctl shutdown all) so the script can pick one that has it, set VISUAL_DEVICE to one, or install it (npx expo start, then press i)"

orig=$(xcrun simctl ui booted appearance 2>/dev/null || echo light)
log=$(mktemp "${TMPDIR:-/tmp}/visual-metro.XXXXXX")
# Job control gives Metro its own process group, so cleanup can stop npx and the node process under it. --clear drops
# the bundle cache: the stub address is inlined at bundle time and a cached bundle may still point at the real server.
set -m
EXPO_PUBLIC_LUMIO_SERVER=$STUB npx expo start --port 8081 --clear </dev/null >"$log" 2>&1 &
metro=$!
set +m
cleanup() {
  kill -TERM -- "-$metro" 2>/dev/null || kill "$metro" 2>/dev/null || true
  xcrun simctl ui booted appearance "$orig" 2>/dev/null || true
  rm -f "$log"
}
trap cleanup EXIT

for i in $(seq 1 60); do
  curl -fs http://127.0.0.1:8081/status 2>/dev/null | grep -q running && break
  sleep 1
  if [ "$i" -eq 60 ]; then tail -20 "$log" >&2; die "the dev server did not start"; fi
done

export MAESTRO_DEMO_USER=${VISUAL_STUB_USER:-demo} MAESTRO_DEMO_PASS=${VISUAL_STUB_PASS:-demo-visual-pass-1}
rm -rf "$OUT"; mkdir -p "$OUT"
failed=0
for appearance in light dark; do
  xcrun simctl ui booted appearance "$appearance"
  for flow in $flows; do
    echo "== $appearance / $flow"
    # Maestro only lets takeScreenshot write inside the run's own output folder, so each run gets one and the PNGs are
    # copied from there, with the appearance in the name.
    run_dir=$(mktemp -d "${TMPDIR:-/tmp}/visual-run.XXXXXX")
    maestro test --test-output-dir "$run_dir" ".maestro/visual/$flow.yaml" \
      || { echo "flow failed: $appearance/$flow" >&2; failed=1; }
    while IFS= read -r -d '' png; do
      cp "$png" "$OUT/$appearance-$(basename "$png")"
    done < <(find "$run_dir" -name '*.png' -print0)
    rm -rf "$run_dir"
  done
done

echo; echo "Screenshots in $OUT:"; ls "$OUT"
exit "$failed"
