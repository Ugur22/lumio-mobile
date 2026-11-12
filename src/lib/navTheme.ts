import type { Palette } from "./theme";

// The colours React Navigation draws behind and around screens: the gap beside a sliding drawer, transitions, a header
// card. Its built-in themes are the iOS system greys and ignore the Lumio theme, which showed as a pale strip in dark mode.
export function navigationColors(p: Palette) {
  return { primary: p.accent, background: p.bg, card: p.panel, text: p.text, border: p.border };
}
