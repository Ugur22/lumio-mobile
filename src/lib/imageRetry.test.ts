import { describe, expect, it } from "vitest";
import { IMAGE_RETRY_DELAYS, retryDelay, retryUri } from "./imageRetry";

describe("image retry", () => {
  it("backs off 1s, 2s, 4s and then gives up", () => {
    expect(IMAGE_RETRY_DELAYS.map((_, i) => retryDelay(i))).toEqual([1000, 2000, 4000]);
    expect(retryDelay(3)).toBeNull();
  });

  it("leaves the first uri alone and busts the cache on retries", () => {
    expect(retryUri("https://x/api/chats/c/images/i", 0)).toBe("https://x/api/chats/c/images/i");
    expect(retryUri("https://x/i", 2)).toBe("https://x/i?r=2");
    expect(retryUri("https://x/i?a=1", 1)).toBe("https://x/i?a=1&r=1");
  });
});
