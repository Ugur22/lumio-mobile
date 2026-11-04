import type { MarkdownStyleMap } from "@ronradtke/react-native-markdown-display";
import { Platform } from "react-native";

import type { Palette } from "./theme";

const mono = Platform.select({ ios: "Menlo", default: "monospace" });
const heading = { flexDirection: "row", fontWeight: "600", letterSpacing: -0.3 } as const;

// Mirrors the web reply styling (frontend/tailwind.config.ts typography): text tokens, bubble-coloured inline code,
// a dark fence regardless of theme.
export function markdownStyles(c: Palette): MarkdownStyleMap {
  return {
    body: { color: c.text, fontSize: 17, lineHeight: 28 },
    text: { color: c.text },
    heading1: { ...heading, fontSize: 28, lineHeight: 34 },
    heading2: { ...heading, fontSize: 22, lineHeight: 28 },
    heading3: { ...heading, fontSize: 19, lineHeight: 25 },
    link: { color: c.accent, textDecorationLine: "underline" },
    blockquote: {
      backgroundColor: "transparent",
      borderColor: c.border,
      borderLeftWidth: 3,
      marginLeft: 0,
      paddingHorizontal: 12,
    },
    code_inline: {
      backgroundColor: c.bubble,
      borderWidth: 0,
      color: c.text,
      fontFamily: mono,
      fontSize: 15,
      padding: 0,
      paddingHorizontal: 4,
    },
    hr: { backgroundColor: c.border },
    bullet_list_icon: { color: c.muted, marginLeft: 4, marginRight: 8 },
    ordered_list_icon: { color: c.muted, marginLeft: 4, marginRight: 8 },
    fence: { borderColor: c.border, borderRadius: 8, borderWidth: 1 },
    fence_header: { backgroundColor: c.codeBg, borderBottomColor: "#3a342b" },
    fence_language_label: { color: "#a0968a" },
    fence_copy_text: { color: "#a0968a" },
    fence_code: { backgroundColor: c.codeBg },
    fence_token: { color: c.codeText, fontFamily: mono, fontSize: 13 },
    table: { borderColor: c.border, borderRadius: 6 },
    tr: { borderColor: c.border },
    th: { fontWeight: "600" },
    // Spans made by lib/markup/plugin.ts: quoted speech and the [[key]] highlight.
    dialogue: { color: c.dialogue },
    mark: { backgroundColor: c.keyBg, fontWeight: "600" },
  } as MarkdownStyleMap;
}
