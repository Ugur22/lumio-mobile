import { describe, expect, it } from "vitest";
import { copyText, splitReply, type Illustration } from "./illustrations";

const ID = "0123456789abcdef0123456789abcdef";
const pic: Illustration = { id: ID, prompt: "a harbour at dusk" };

describe("splitReply", () => {
  it("interleaves text and a known image", () => {
    const out = splitReply(`One.\n\n[[img:${ID}]]\n\nTwo.`, [pic], false);
    expect(out.map((s) => s.kind)).toEqual(["text", "image", "text"]);
  });

  it("ignores an id that is not in the message's images", () => {
    const out = splitReply(`One.\n[[img:${ID}]]\nTwo.`, [], false);
    expect(out.every((s) => s.kind === "text")).toBe(true);
    expect(JSON.stringify(out)).not.toContain("img:");
  });

  it("leaves ordinary brackets alone", () => {
    expect(splitReply("see [[note]] and [x]", [], true)).toEqual([{ kind: "text", text: "see [[note]] and [x]" }]);
  });

  it("shows a placeholder for a complete directive while streaming", () => {
    const out = splitReply("Intro.\n\n[[image: a lighthouse]]\n\nMore", [], true);
    expect(out.map((s) => s.kind)).toEqual(["text", "pending", "text"]);
  });

  it("drops a stale directive once streaming is over", () => {
    const out = splitReply("Intro.\n[[image: a lighthouse]]\nMore", [], false);
    expect(out.map((s) => s.kind)).toEqual(["text", "text"]);
  });

  it.each(["[", "[[", "[[ima", "[[image:", "[[image: a light", "[[img:0123"])("hides the partial tail %j while streaming", (tail) => {
    expect(splitReply(`Intro.${tail}`, [], true)).toEqual([{ kind: "text", text: "Intro." }]);
  });

  it("keeps a partial tail visible when not streaming", () => {
    expect(splitReply("Intro.[[ima", [], false)).toEqual([{ kind: "text", text: "Intro.[[ima" }]);
  });
});

describe("copyText", () => {
  it("removes markers and directives", () => {
    expect(copyText(`One.\n\n[[img:${ID}]]\n\nTwo.`)).toBe("One.\n\nTwo.");
  });
});

describe("splitReply with pictures that arrived mid-stream", () => {
  const A: Illustration = { id: "a".repeat(32), prompt: "a lighthouse" };
  const B: Illustration = { id: "b".repeat(32), prompt: "a harbour" };
  const text = "Intro.\n[[image: a lighthouse]]\nMid.\n[[image: a harbour]]\nEnd";
  const kinds = (segs: ReturnType<typeof splitReply>) => segs.map((s) => (s.kind === "image" ? `image:${s.illustration.id[0]}` : s.kind));

  it("maps the n-th directive to the n-th arrived picture", () => {
    expect(kinds(splitReply(text, [], true, [A, B]))).toEqual(["text", "image:a", "text", "image:b", "text"]);
  });

  it("keeps a placeholder for directives whose picture has not arrived", () => {
    expect(kinds(splitReply(text, [], true, [A]))).toEqual(["text", "image:a", "text", "pending", "text"]);
  });

  it("matches by prompt when pictures finish out of order", () => {
    expect(kinds(splitReply(text, [], true, [B]))).toEqual(["text", "pending", "text", "image:b", "text"]);
  });

  it("falls back to order when the prompt was altered", () => {
    const odd: Illustration = { id: "c".repeat(32), prompt: "something else" };
    expect(kinds(splitReply(text, [], true, [odd]))).toEqual(["text", "image:c", "text", "pending", "text"]);
  });

  it("prefers an exact prompt over a prefix match", () => {
    const mat: Illustration = { id: "d".repeat(32), prompt: "a cat on a mat" };
    const cat: Illustration = { id: "e".repeat(32), prompt: "a cat" };
    expect(kinds(splitReply("[[image: a cat on a mat]]\n[[image: a cat]]", [], true, [cat, mat]))).toEqual(["image:d", "image:e"]);
  });

  it("uses a picture once, and ignores arrivals when the reply is saved", () => {
    expect(kinds(splitReply("[[image: a lighthouse]][[image: a lighthouse]]", [], true, [A]))).toEqual(["image:a", "pending"]);
    expect(kinds(splitReply(text, [], false, [A, B]))).toEqual(["text", "text", "text"]);
  });

  it("still resolves saved [[img:id]] markers from the message's own images", () => {
    expect(kinds(splitReply(`x [[img:${A.id}]] y`, [A], false, [B]))).toEqual(["text", "image:a", "text"]);
  });
});
