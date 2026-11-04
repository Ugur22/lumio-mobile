import type { MarkdownItPlugin } from "@ronradtke/react-native-markdown-display";

type MarkdownIt = Parameters<MarkdownItPlugin>[0];
type Token = InstanceType<MarkdownIt["core"]["State"]>["tokens"][number];
type TokenCtor = new (type: string, tag: string, nesting: 0 | 1 | -1) => Token;

// A straight or curly quoted run on one line. Matches the web app's dialogue styling; markdown-it's typographer has
// already turned straight quotes curly by the time this runs, so both forms are handled.
const QUOTE = /("[^"\n]+"|“[^”\n]+”)/;
const KEY_MARKER = /(\[\[\/?key\]\])/;

// Splits a text token into text, `dialogue` spans and `mark` (the [[key]] highlight) open/close tokens. The markers are
// tokens of their own, so a highlight can span bold or italic text in between.
function transformText(token: Token, TokenClass: TokenCtor): Token[] {
  const out: Token[] = [];
  const push = (type: string, nesting: 0 | 1 | -1, content = "") => {
    const t = new TokenClass(type, "", nesting);
    t.content = content;
    out.push(t);
  };
  const pushText = (content: string, level: number) => {
    const t = new TokenClass("text", "", 0);
    t.content = content;
    t.level = level;
    out.push(t);
  };

  for (const piece of token.content.split(KEY_MARKER)) {
    if (piece === "[[key]]") push("mark_open", 1);
    else if (piece === "[[/key]]") push("mark_close", -1);
    else {
      piece.split(QUOTE).forEach((part, i) => {
        if (part === "") return;
        if (i % 2 === 1) {
          push("dialogue_open", 1);
          pushText(part, token.level);
          push("dialogue_close", -1);
        } else pushText(part, token.level);
      });
    }
  }
  return out;
}

// Code spans and fences are other token types, so their text is never touched.
export const lumioMarkup: MarkdownItPlugin = (md) => {
  md.core.ruler.push("lumio_markup", (state) => {
    for (const block of state.tokens) {
      if (block.type !== "inline" || !block.children) continue;
      block.children = block.children.flatMap((child) =>
        child.type === "text" ? transformText(child, state.Token as unknown as TokenCtor) : [child],
      );
    }
  });
};
