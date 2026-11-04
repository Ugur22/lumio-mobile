import { describe, expect, it, vi } from "vitest";

import { fitWithin, MAX_EDGE } from "./images";

// The native module cannot load under Node; only the pure sizing is tested here. vi.mock is hoisted above the imports.
vi.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: { JPEG: "jpeg" } }));

describe("fitWithin", () => {
  it("leaves small images alone", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("scales the long edge down and keeps the aspect ratio", () => {
    expect(fitWithin(3136, 1568)).toEqual({ width: MAX_EDGE, height: 784 });
    expect(fitWithin(1000, 4000, 2000)).toEqual({ width: 500, height: 2000 });
  });

  it("never collapses to zero", () => {
    expect(fitWithin(5000, 1, 100).height).toBe(1);
  });
});
