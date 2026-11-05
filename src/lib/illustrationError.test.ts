import { describe, expect, it } from "vitest";

import { describeIllustrationFailure } from "./illustrationError";

describe("describeIllustrationFailure", () => {
  it("explains a 400 in words and passes the provider's message along", () => {
    const view = describeIllustrationFailure({ status: 400, detail: "Content violates usage guidelines" });
    expect(view.headline).toMatch(/rejected the request/);
    expect(view.providerSays).toBe("Content violates usage guidelines");
  });

  it("explains a rate limit as a limit or cooldown", () => {
    expect(describeIllustrationFailure({ status: 429, detail: "" }).headline).toMatch(/limit|cooldown/i);
  });

  it("covers key, model and server problems", () => {
    expect(describeIllustrationFailure({ status: 401, detail: "" }).headline).toMatch(/API key/);
    expect(describeIllustrationFailure({ status: 404, detail: "" }).headline).toMatch(/not found/);
    expect(describeIllustrationFailure({ status: 503, detail: "" }).headline).toMatch(/problem/);
  });

  it("keeps the code for statuses it has no wording for, and works without one", () => {
    expect(describeIllustrationFailure({ status: 418, detail: "" }).headline).toContain("418");
    expect(describeIllustrationFailure({ status: null, detail: "" }).headline).toBe("Couldn't generate an image");
  });

  it("treats a blank message as none", () => {
    expect(describeIllustrationFailure({ status: 400, detail: "   " }).providerSays).toBeNull();
  });
});
