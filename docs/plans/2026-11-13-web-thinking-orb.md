# Use the web app's thinking orb

Status: approved

## Goal
The thinking status on the phone shows the same dotted orb as the web app (same nine-state engine, same geometry), instead of the 20px dot with a pulse that PR #24 added, which looks like the old indicator. The orb is bigger and visibly animated while a reply is pending.

## How
The author's own React Native port, `thinking-orbs-native` (MIT, v0.1.0, repo `Jakubantalik/Libraries.dev`, path `packages/thinking-orbs/ports/react-native/thinking-orbs-native`), does what the first version of this plan wanted, and does it better: it takes frames from `thinking-orbs/engine` (the same geometry code as the web) and draws them with Skia. Per its README, the frame is recorded into an `SkPicture` on the JS thread and handed to the UI thread as a Reanimated shared value; its first version used React state per frame and ran at single-digit fps, which is what an SVG-per-frame approach would have done here. So the plan now uses the Skia port instead of `react-native-svg`.

- It is not on npm and the repo has no built `lib/`, so it cannot be installed from git. The source is four files (about 260 lines: `ThinkingOrb.tsx`, `theme.ts`, `types.ts`, `index.ts`), so they are copied into the app (`src/components/orb/`) at commit `387b049`, with the MIT licence text kept alongside. Its only runtime dependency is `thinking-orbs` (npm, ^0.3.1).
- `displaySize` renders the tuned 20 or 64 geometry at any dp size, which answers the size question below.
- New native dependency: `@shopify/react-native-skia`. Expo SDK 58's own `bundledNativeModules.json` pins it at 2.14.0, so it should ship inside Expo Go, but that is not verified on the phone. Reanimated 4.7.1 is already installed. The port's README only reports a simulator run on SDK 53 / Skia 2.0.0-next.4; a physical device and Android are listed as unverified. The libraries.dev page says Expo "needs expo run:ios" because of native modules, which fits the Release build from Xcode (it needs a rebuild after the install) and may just be generic wording for Expo Go.

## Steps
One commit per step, each aiming under ~300 changed lines. Each step names how it is verified.

1. **Dependencies and vendored port:** `npx expo install @shopify/react-native-skia` (resolves 2.14.0) and `npm install thinking-orbs@0.3.2`; copy the four source files into `src/components/orb/` with the licence; adapt imports to the project's lint rules. Drop `OrbMotion`/`orbMotion` from `lib/thinking.ts` and import the `OrbState` type from the package.
   Verify: `npm run check`; `npx expo export --platform ios` bundles.

2. **Use it in the status line:** `ThinkingStatus` renders the vendored orb for the phase's state (`orbStateOf` already uses the web's state names), at 32 to 40 dp via `displaySize`, grayscale like the web, themed from the app's theme. Delete the `Animated` orb. The orb stays out of the accessibility tree, as now.
   Verify: `npm run check`, then on the phone in Expo Go: each phase shows its own orb, dark and light, reduce motion shows a still orb, and a long streaming reply does not stutter next to it. If Expo Go does not ship Skia, stop and tell the user: the fallback is the Release build from Xcode, or going back to the previous plan with `react-native-svg`.

## Out of scope
- The orb's `color` tint and `dots` props: the web app uses the stock grayscale orb, so mobile does too.
- Showing the reasoning text (`LiveThought`); mobile still does not keep it.
- Any change to the chips, the Stopped notice or the Stop button from PR #24.
- Android: not tested by the port's author and not by us.

## Open questions
- **Install.** `npx expo install` is blocked in Claude's sandbox and the project asks before installing a package: approve the two installs for Claude to run, or run them yourself with the `!` prefix.
- **Size.** Recommendation: the 64 geometry shown at about 40 dp. It is the tuned design, scaled as vectors, so it stays sharp. The 20 geometry at 20 dp is the web's phone look but small.
