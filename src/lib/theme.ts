import { useColorScheme } from "react-native";

// Hex copies of the CSS variables in src/global.css, for the places a className cannot reach (a library's style prop).
const light = {
  bg: "#f7f2e9",
  panel: "#efe8db",
  text: "#26221c",
  muted: "#6f675b",
  border: "#ded5c4",
  bubble: "#ebe3d3",
  accent: "#1f5a4a",
  surface: "#fcfaf5",
  codeBg: "#1f1b16",
  codeText: "#e7dfd0",
  dialogue: "#2b4f7d",
  keyBg: "#f1deaa",
  noteBg: "#e5e8ec",
  noteBar: "#5c7a99",
  warnBg: "#f4ddd3",
  warnBar: "#b4452c",
};

const dark: typeof light = {
  bg: "#1b1814",
  panel: "#221e19",
  text: "#ece4d6",
  muted: "#a0968a",
  border: "#332e26",
  bubble: "#2a251e",
  accent: "#7ec4ae",
  surface: "#25211b",
  codeBg: "#14110e",
  codeText: "#e7dfd0",
  dialogue: "#8fb4e3",
  keyBg: "#5b4a1a",
  noteBg: "#232a33",
  noteBar: "#7f9fc0",
  warnBg: "#3a221c",
  warnBar: "#e0705a",
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}
