import { describe, expect, it } from "vitest";
import { blankSpaceFor } from "./blankSpace";

describe("blankSpaceFor", () => {
  it("is what is left of the viewport after the turn", () => {
    expect(blankSpaceFor(800, 100, 300)).toBe(400);
  });
  it("is 0 when the turn fills the viewport", () => {
    expect(blankSpaceFor(800, 100, 700)).toBe(0);
    expect(blankSpaceFor(800, 100, 1500)).toBe(0);
  });
  it("is 0 when a height is missing", () => {
    expect(blankSpaceFor(800, undefined, 300)).toBe(0);
    expect(blankSpaceFor(800, 100, undefined)).toBe(0);
  });
});
