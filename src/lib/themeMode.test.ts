import { describe, expect, it } from "vitest";

import { parseThemeMode } from "./themeMode";

describe("parseThemeMode", () => {
  it("accepts the three modes", () => {
    expect(parseThemeMode("light")).toBe("light");
    expect(parseThemeMode("dark")).toBe("dark");
    expect(parseThemeMode("system")).toBe("system");
  });

  it("falls back to following the phone for anything else", () => {
    expect(parseThemeMode(null)).toBe("system");
    expect(parseThemeMode(undefined)).toBe("system");
    expect(parseThemeMode("blue")).toBe("system");
  });
});
