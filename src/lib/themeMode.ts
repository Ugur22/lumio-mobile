export type ThemeMode = "system" | "light" | "dark";

export const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"];

// What storage hands back is only trusted when it is one of the three modes.
export function parseThemeMode(raw: string | null | undefined): ThemeMode {
  return THEME_MODES.find((m) => m === raw) ?? "system";
}
