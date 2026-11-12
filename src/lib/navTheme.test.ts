import { describe, expect, it } from "vitest";
import { navigationColors } from "./navTheme";
import type { Palette } from "./theme";

const dark = { bg: "#1b1814", panel: "#221e19", text: "#ece4d6", border: "#332e26", accent: "#7ec4ae" } as Palette;
const light = { bg: "#f7f2e9", panel: "#efe8db", text: "#26221c", border: "#ded5c4", accent: "#1f5a4a" } as Palette;

describe("navigationColors", () => {
  it("takes the screen, card, text, border and accent colours from the palette", () => {
    expect(navigationColors(dark)).toEqual({
      primary: "#7ec4ae",
      background: "#1b1814",
      card: "#221e19",
      text: "#ece4d6",
      border: "#332e26",
    });
    expect(navigationColors(light).background).toBe("#f7f2e9");
  });

  it("returns only the five keys it owns, so the router's other theme colours stay as they are", () => {
    expect(Object.keys(navigationColors(dark)).sort()).toEqual(["background", "border", "card", "primary", "text"]);
  });
});
