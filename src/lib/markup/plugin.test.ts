import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";

import { lumioMarkup } from "./plugin";

function inline(source: string): string[] {
  const md = new MarkdownIt({ typographer: true });
  lumioMarkup(md as never);
  const inlineToken = md.parse(source, {}).find((t) => t.type === "inline");
  return (inlineToken?.children ?? []).map((t) => (t.type === "text" ? `text:${t.content}` : t.type));
}

describe("lumioMarkup", () => {
  it("wraps quoted speech and leaves the narration alone", () => {
    expect(inline('She said "stay here" and left.')).toEqual([
      "text:She said ",
      "dialogue_open",
      "text:“stay here”",
      "dialogue_close",
      "text: and left.",
    ]);
  });

  it("handles quotes already curly", () => {
    expect(inline("“Run.” He ran.")).toContain("dialogue_open");
  });

  it("turns [[key]] markers into mark tokens, around inline formatting too", () => {
    expect(inline("a [[key]]b **c** d[[/key]] e")).toEqual([
      "text:a ",
      "mark_open",
      "text:b ",
      "strong_open",
      "text:c",
      "strong_close",
      "text: d",
      "mark_close",
      "text: e",
    ]);
  });

  it("does not touch code spans", () => {
    expect(inline('use `"x"` here')).toEqual(["text:use ", "code_inline", "text: here"]);
  });
});
