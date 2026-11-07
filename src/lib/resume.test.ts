import { describe, expect, it, vi } from "vitest";
import { runWithResume } from "./resume";

// The loop is given its own app-state hooks in these tests; the real module only needs to import.
vi.mock("react-native", () => ({ AppState: { currentState: "active", addEventListener: () => ({ remove: () => undefined }) } }));

const base = () => ({
  signal: new AbortController().signal,
  isActive: () => true,
  onForeground: () => () => undefined,
  sleep: vi.fn(() => Promise.resolve()),
  delays: [1, 2, 3],
});

describe("runWithResume", () => {
  it("resumes after a break and returns the result", async () => {
    const attempt = vi.fn().mockRejectedValueOnce(new Error("net")).mockResolvedValueOnce("chat");
    const out = await runWithResume({ ...base(), attempt, retryable: () => true, progress: () => 0 });
    expect(out).toBe("chat");
    expect(attempt.mock.calls.map((c) => c[0])).toEqual([0, 1]);
  });

  it("passes null through (the caller refetches)", async () => {
    const attempt = vi.fn().mockResolvedValue(null);
    expect(await runWithResume({ ...base(), attempt, retryable: () => true, progress: () => 0 })).toBeNull();
  });

  it("stops on errors the server meant", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("failed"));
    await expect(runWithResume({ ...base(), attempt, retryable: () => false, progress: () => 0 })).rejects.toThrow("failed");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget without progress", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("net"));
    await expect(runWithResume({ ...base(), attempt, retryable: () => true, progress: () => 0 })).rejects.toThrow("net");
    expect(attempt).toHaveBeenCalledTimes(4);
  });

  it("refills the budget when a connection made progress", async () => {
    let seen = 0;
    const attempt = vi.fn(async (n: number) => {
      seen += 1;
      if (n < 8) throw new Error("net");
      return "ok";
    });
    expect(await runWithResume({ ...base(), attempt, retryable: () => true, progress: () => seen })).toBe("ok");
  });

  it("waits for the app to be active before trying", async () => {
    let active = false;
    let wake: () => void = () => undefined;
    const attempt = vi.fn().mockResolvedValue("ok");
    const run = runWithResume({
      ...base(),
      isActive: () => active,
      onForeground: (cb) => {
        wake = () => {
          active = true;
          cb();
        };
        return () => undefined;
      },
      attempt,
      retryable: () => true,
      progress: () => 0,
    });
    await Promise.resolve();
    expect(attempt).not.toHaveBeenCalled();
    wake();
    expect(await run).toBe("ok");
  });

  it("drops a live connection when the app returns to the foreground and resumes without spending a retry", async () => {
    let fg: () => void = () => undefined;
    const attempt = vi.fn((n: number, signal: AbortSignal) => {
      if (n > 0) return Promise.resolve("ok");
      return new Promise<string>((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
        queueMicrotask(() => fg());
      });
    });
    const deps = { ...base(), delays: [], onForeground: (cb: () => void) => ((fg = cb), () => undefined) };
    expect(await runWithResume({ ...deps, attempt, retryable: () => true, progress: () => 0 })).toBe("ok");
  });

  it("throws an AbortError when stopped", async () => {
    const c = new AbortController();
    c.abort();
    await expect(runWithResume({ ...base(), signal: c.signal, attempt: vi.fn(), retryable: () => true, progress: () => 0 })).rejects.toThrow("Aborted");
  });
});
