import { describe, expect, it } from "vitest";

import { sanitizeBlockHtml } from "./sanitizeHtml";

describe("sanitizeBlockHtml", () => {
  it("keeps allowed tags with their filtered style and nothing else", () => {
    expect(sanitizeBlockHtml('<div style="background:#fff;position:fixed" class="x" onclick="evil()"><p style="margin:0">Hi</p></div>')).toBe(
      '<div style="background:#fff"><p style="margin:0">Hi</p></div>',
    );
  });

  it("removes scripts, styles and frames with their content", () => {
    expect(sanitizeBlockHtml('<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe><p>b</p>')).toBe("<p>a</p><p>b</p>");
    expect(sanitizeBlockHtml("<p>a</p><script>never closed")).toBe("<p>a</p>");
  });

  it("drops images and links (no remote loads, no tap-through) but keeps the link text", () => {
    expect(sanitizeBlockHtml('<p>see <a href="https://x.test">here</a><img src="https://x.test/p.png"></p>')).toBe("<p>see here</p>");
  });

  it("drops comments and unknown tags", () => {
    expect(sanitizeBlockHtml("<!-- hi --><blink>x</blink><custom-tag>y</custom-tag>")).toBe("xy");
  });

  it("cannot be escaped through a quote in a single-quoted style", () => {
    const out = sanitizeBlockHtml("<div style='color:red;font-family:\"serif\" onload=\"x\"'>t</div>");
    expect(out).not.toMatch(/onload/);
    expect(out.match(/"/g)?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it("drops a style whose values are not on the list", () => {
    expect(sanitizeBlockHtml('<div style="background:url(http://x/y.png)">t</div>')).toBe("<div>t</div>");
  });

  it("lowercases tag names and keeps a partial block readable", () => {
    expect(sanitizeBlockHtml("<DIV><P>open")).toBe("<div><p>open");
  });
});
