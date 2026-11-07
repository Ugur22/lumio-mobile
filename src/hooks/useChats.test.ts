import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, HandlerError, ReplyFailed, StreamInterrupted, api, newCursor } from "@/api/client";
import { PROBE_EVERY_MS, PROBE_WINDOW_MS, ReplyLost, probeForJob, resumable } from "./useChats";

vi.mock("expo/fetch", () => ({ fetch: vi.fn() }));
vi.mock("react-native", () => ({ AppState: { currentState: "active", addEventListener: () => ({ remove: () => undefined }) } }));


afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("resumable", () => {
  const started = { ...newCursor(), started: true };
  it("retries network breaks, cut streams and 5xx/429/408 once the reply started", () => {
    expect(resumable(new TypeError("Network request failed"), started, false)).toBe(true);
    expect(resumable(new StreamInterrupted(), started, false)).toBe(true);
    for (const s of [500, 502, 429, 408]) expect(resumable(new ApiError("x", s), started, false)).toBe(true);
  });

  it("does not retry refusals, server-reported failures, handler errors, lost replies or a stop", () => {
    for (const s of [401, 404, 409, 422]) expect(resumable(new ApiError("x", s), started, false)).toBe(false);
    expect(resumable(new ReplyFailed("x"), started, false)).toBe(false);
    expect(resumable(new HandlerError(new Error("boom")), started, false)).toBe(false);
    expect(resumable(new ReplyLost(true), started, false)).toBe(false);
    expect(resumable(new TypeError("net"), started, true)).toBe(false);
  });

  it("before the first byte, retries (by probing) a network error but not a refusal of the POST", () => {
    expect(resumable(new TypeError("net"), newCursor(), false)).toBe(true);
    expect(resumable(new ApiError("busy", 409), newCursor(), false)).toBe(false);
    expect(resumable(new ApiError("down", 503), newCursor(), false)).toBe(false);
  });
});

describe("probeForJob", () => {
  const handlers = () => ({ signal: new AbortController().signal, cursor: newCursor() }) as never;

  it("keeps asking until the job appears", async () => {
    vi.useFakeTimers();
    const resume = vi.spyOn(api, "resumeMessage").mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "c1" } as never);
    const p = probeForJob("c1", newCursor(), handlers());
    await vi.advanceTimersByTimeAsync(PROBE_EVERY_MS * 2);
    await expect(p).resolves.toEqual({ id: "c1" });
    expect(resume).toHaveBeenCalledTimes(3);
  });

  it("gives up with null once the window has passed", async () => {
    vi.useFakeTimers();
    const resume = vi.spyOn(api, "resumeMessage").mockResolvedValue(null);
    const p = probeForJob("c1", newCursor(), handlers());
    await vi.advanceTimersByTimeAsync(PROBE_WINDOW_MS + PROBE_EVERY_MS);
    await expect(p).resolves.toBeNull();
    expect(resume.mock.calls.length).toBeGreaterThan(5);
  });
});

describe("ReplyLost", () => {
  it("words the two cases", () => {
    expect(new ReplyLost(true).message).toBe("That reply was lost. Try again.");
    expect(new ReplyLost(false).message).toBe("Could not reach the server. Try again.");
  });
});
