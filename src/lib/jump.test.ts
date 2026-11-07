import { describe, expect, it } from "vitest";
import { JUMP_THRESHOLD, jumpVisible } from "./jump";

describe("jumpVisible", () => {
  it("shows when more than the threshold lies below", () => {
    expect(jumpVisible(2000, 0, 800)).toBe(true);
    expect(jumpVisible(2000, 1100, 800)).toBe(true);
  });

  it("hides at the end, and within the threshold of it", () => {
    expect(jumpVisible(2000, 1200, 800)).toBe(false);
    expect(jumpVisible(2000, 1200 - JUMP_THRESHOLD, 800)).toBe(false);
    expect(jumpVisible(2000, 1200 - JUMP_THRESHOLD - 1, 800)).toBe(true);
  });

  it("hides for content that fits, or when overscrolled past the end", () => {
    expect(jumpVisible(500, 0, 800)).toBe(false);
    expect(jumpVisible(2000, 1500, 800)).toBe(false);
  });

  it("appears as the content grows under a still reader", () => {
    expect(jumpVisible(900, 100, 800)).toBe(false);
    expect(jumpVisible(1400, 100, 800)).toBe(true);
  });

  it("ignores sizes that are not measured yet", () => {
    expect(jumpVisible(0, 0, 0)).toBe(false);
    expect(jumpVisible(1000, 0, 0)).toBe(false);
    expect(jumpVisible(Number.NaN, 0, 800)).toBe(false);
  });
});
