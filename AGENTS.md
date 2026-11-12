This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Project rules

Native client for the Lumio API (backend and web: Ugur22/lumio). The same rules as that repo's CLAUDE.md apply where they fit.

- No commits without explicit approval. `main` only takes changes through a PR, and `gh` fails inside Claude's sandbox, so never open one: after a push, end with a ready-to-run `gh pr create` command for the user.
- Anything non-trivial: save a plan in `docs/plans/<yyyy-mm-dd>-<slug>.md` (copy `docs/plans/TEMPLATE.md`: goal, steps, how each step is verified, out of scope), then wait for approval. Unless the user says otherwise, approving a plan is the explicit approval for one commit per step (aim for under ~300 changed lines, `api.gen.ts` excluded) and one push per branch; the permission prompt for commits and pushes still appears. Verify each step as the plan says before its commit.
- **Review before done:** after the last step's commit and before the final push, run the `reviewer` agent (`.claude/agents/reviewer.md`) and give it only the plan path and the base branch, never the conversation, so it judges the committed diff (`git diff main...HEAD`) against the plan. Fix confirmed findings; report suspicions and what it could not verify.
- **API contract:** `src/api/api.gen.ts` is generated from the backend's `openapi.json`. Never edit it by hand; run `npm run sync:api` (`LUMIO_API_REF=<tag|sha>` for another ref), then fix the type errors it causes in `src/`. `src/api/types.ts` gives the generated shapes their short names and holds the SSE payloads the schema cannot describe. The backend only adds fields, because older app versions stay installed, so never rely on a field being removed or renamed.
- **Done means green:** `npm run typecheck`, `npm test` and `npm run lint`, which `npm run check` runs together. The Stop hook (`scripts/check.sh`) runs it when a source file changed since the last green run, and blocks the stop up to 3 times before telling you to report the failure. A PostToolUse hook (`scripts/hooks/post-edit.sh`) runs eslint on each edited file. `npm run check:api` needs the network, so it runs in CI only (`.github/workflows/ci.yml`), not in the hook. Do not edit the hook or the CI workflow to loosen a check.
- **Permissions:** `.claude/settings.json` denies hand edits to `src/api/api.gen.ts`, opening PRs and pushing to `main`, and reading key files; it asks before commits, pushes, installing a package (it may need a development build) and edits to the hook scripts, the CI workflow, the baselines and `app.json`. Bash rules are best effort; GitHub branch protection is the real guard for `main`.
- Tokens and the API key live in `expo-secure-store`, never in AsyncStorage, logs or committed files.
- Reply text from the model is untrusted: it is always rendered through the Markdown and HTML renderers, never as raw markup.
- Develop and test in Expo Go. Do not add a library that needs a development build without telling the user first.

## Pull requests

After every push, end the reply with a ready-to-run command for the user (to run with the `!` prefix) in this shape. The title matches the commit's first line. Mention API or behaviour changes under What, and anything the user has to do by hand under Check.

```
! gh pr create --base main --head <branch> --title "<imperative, under 70 characters>" --body "$(cat <<'EOF'
## What
- <the change, one bullet per point>

## Why
<the problem it solves, one or two sentences; omit for trivial changes>

## Check
<what was run and what it showed, plus anything not verified, such as the UI on a device>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Visual check

Nothing else looks at the UI, and booting a simulator is slow, so this is decided once per task, at the end, and never in a hook (not in `npm run check`, not in CI).

- After the commits and the review step, run `scripts/visual-check.sh --needed`. It says needed for a new, removed or renamed route in `src/app`; navigation (`_layout.tsx`); shared building blocks (`src/components/ui/`, theme tokens in `tailwind.config.js`, `src/global.css`, `src/lib/theme.ts`); and a diff that touches keyboard, safe-area or window-size code. It says not needed for logic in `src/lib`, hooks, API and type changes, copy changes and small styling tweaks inside one component.
- The user can always ask for it ("run the visual check") or skip it ("skip the visual check"); that overrides the script.
- It runs against the Lumio stub backend (`make e2e-mobile-server` in the lumio repo, on `127.0.0.1:18766`), never the real API, so replies are instant and screenshots are the same every run. The script starts Expo with `EXPO_PUBLIC_LUMIO_SERVER` pointing at the stub.
- Claude's sandbox cannot reach the simulator. When the check is needed, give the user `! scripts/visual-check.sh` to run and wait for it; never report it as passed without having seen the screenshots.
- Look at the PNGs in `.maestro/screenshots/` (the changed screens, light and dark): fix what is clearly broken (clipped or overlapping text, unreadable contrast, content under the notch or keyboard), re-run once, and list anything you are unsure about instead of guessing.

## Components

- Before writing UI, look in `src/components` and `src/hooks`. Reuse or extend a component with a prop instead of copying it.
- Extract a component when the same markup appears in two places. Generic building blocks (button, dialog, sheet) go in `src/components/ui/` the first time one is needed; feature components stay in `src/components/`.
- One component per file, PascalCase. Files in `src/app` only compose components and handle navigation.
- Keep logic out of components: pure logic in `src/lib` with a `.test.ts` next to it, hooks in `src/hooks`, shared state in `src/store`.
- Style with NativeWind classes and the theme tokens from `tailwind.config.js` (`bg`, `panel`, `text`, `muted`, `accent`, …), which match the web app's names. No hardcoded colors and no `StyleSheet.create`, so light and dark mode keep working.
- A `.ts`/`.tsx` file over 400 lines (`api.gen.ts` excluded) fails `npm run check`: split by responsibility before adding more. `scripts/size-baseline.txt` may only shrink; never raise an entry, lower it with `scripts/check-file-size.sh --update` after a split. `scripts/test-baseline.txt` holds the Vitest test count, which may not drop: after an intentional removal run `scripts/check-test-count.sh --update` and have the change reviewed.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
