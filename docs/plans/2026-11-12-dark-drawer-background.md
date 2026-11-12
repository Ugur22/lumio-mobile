# Dark drawer background

Status: draft (2026-11-12)

## Goal
In dark mode the open chat drawer shows a pale strip beside the sliding chat, and the status bar's white icons are barely readable on it. Give the navigation container the app's own colours, so whatever shows behind a screen follows the Lumio theme in light and dark.

Cause: the app sets no navigation theme, so React Navigation's `DefaultTheme` applies, whose `background` is `rgb(242, 242, 242)`: the strip's colour. Found by the visual check (`dark-drawer.png`).

## Steps
One commit per step.

1. **Colour mapping:** `src/lib/navTheme.ts` exports `navigationColors(palette)`, returning `background` (`bg`), `card` (`panel`), `text`, `border` and `primary` (`accent`) from the palette in `src/lib/theme.ts`; `navTheme.test.ts` covers the light and the dark palette.
   Verify: `npm test` (the test count goes up and `scripts/test-baseline.txt` is raised with it).
2. **Apply it:** in `src/app/_layout.tsx`, wrap the navigator in `ThemeProvider` from `expo-router` with `DefaultTheme` or `DarkTheme` as the base and `navigationColors(usePalette())` laid over its colors. The hook is called before the early `return` for the not-ready state. No new dependency: SDK 58's `expo-router` exports `ThemeProvider`, `DefaultTheme` and `DarkTheme`, and app code must not import `@react-navigation/*`.
   Verify: `npm run check`; then `scripts/visual-check.sh --force --flows drawer` (a layout change triggers it anyway) on the simulator. `dark-drawer.png` should show the app's dark background beside the chat and a readable battery icon, and `light-drawer.png` the warm background. The user gets a before/after image of both: the "before" shots were saved from the last full run, and the "after" shots are put next to them in one picture. The login, chat and sheet shots are then re-run once to confirm they are unchanged.

## Out of scope
- `src/app/(drawer)/index.tsx` still imports `DrawerActions` from `@react-navigation/native`, which the SDK 58 docs say app code should no longer do; it works today.
- The drawer animation itself and any other transition flashes beyond what the theme covers.

## Open questions
- None.
