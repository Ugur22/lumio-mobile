import { describe, expect, it } from "vitest";

import { prepare } from "./prepare";

const kinds = (text: string, streaming = false) => prepare(text, streaming).segments.map((s) => s.kind);

describe("prepare", () => {
  it("passes plain Markdown through as one segment", () => {
    expect(prepare("Hello *there*").segments).toEqual([{ kind: "md", text: "Hello *there*" }]);
  });

  it("splits note and warn tags into callouts and keeps key inline", () => {
    const { segments } = prepare("before [[key]]k[[/key]]\n\n[[note]]n **b**[[/note]]\n\nafter");
    expect(segments.map((s) => s.kind)).toEqual(["md", "callout", "md"]);
    expect(segments[0]).toMatchObject({ text: expect.stringContaining("[[key]]k[[/key]]") });
    expect(segments[1]).toEqual({ kind: "callout", tone: "note", text: "n **b**" });
  });

  it("cuts a model-styled div block out of the surrounding text", () => {
    const text = 'Intro\n\n<div style="background:#fff;">\n<p>TAKE NOTICE</p>\n</div>\n\nOutro';
    const { segments } = prepare(text);
    expect(segments.map((s) => s.kind)).toEqual(["md", "html", "md"]);
    expect(segments[1]).toEqual({ kind: "html", html: '<div style="background:#fff;">\n<p>TAKE NOTICE</p>\n</div>' });
  });

  it("keeps nested divs in one block and drops blank lines inside it", () => {
    const text = '<div style="color:red">\n\n<div>\n  inner\n</div>\n\n</div>\nafter';
    const { segments } = prepare(text);
    expect(segments.map((s) => s.kind)).toEqual(["html", "md"]);
    expect(segments[0]).toMatchObject({ html: '<div style="color:red">\n<div>\ninner\n</div>\n</div>' });
  });

  it("leaves tags inside code fences and inline code literal", () => {
    const fenced = "```\n[[note]]x[[/note]]\n<div style=\"a:b\">\n```";
    expect(prepare(fenced).segments).toEqual([{ kind: "md", text: fenced }]);
    expect(kinds("use `[[note]]x[[/note]]` literally")).toEqual(["md"]);
  });

  it("unwraps a closed html fence that holds a styled div", () => {
    const text = '```html\n<div style="color:red">hi</div>\n```';
    expect(kinds(text)).toEqual(["html"]);
  });

  it("holds back an html fence that is still open while streaming", () => {
    const text = 'Before\n```html\n<div style="color:red">';
    const done = prepare(text, true);
    expect(done.drawing).toBe(true);
    expect(done.segments).toEqual([{ kind: "md", text: "Before\n" }]);
    expect(prepare(text, false).drawing).toBe(false);
  });

  it("hides half-typed markers and a cut-off tag while streaming, and closes open callouts", () => {
    expect(prepare("text [[ke", true).segments).toEqual([{ kind: "md", text: "text " }]);
    expect(prepare("text <div sty", true).segments).toEqual([{ kind: "md", text: "text " }]);
    expect(prepare("[[warn]]careful", true).segments).toEqual([{ kind: "callout", tone: "warn", text: "careful" }]);
  });

  it("strips the citation markup models echo back", () => {
    expect(prepare('see [[web_source url="https://x.test"]] done').segments).toEqual([{ kind: "md", text: "see  done" }]);
  });
});
