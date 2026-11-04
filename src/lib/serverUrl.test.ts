import { describe, expect, it } from "vitest";

import { normalizeServerUrl } from "./serverUrl";

describe("normalizeServerUrl", () => {
  it("adds https and drops trailing slashes", () => {
    expect(normalizeServerUrl("chat.example.com/")).toEqual({ ok: true, url: "https://chat.example.com" });
    expect(normalizeServerUrl("  https://chat.example.com//  ")).toEqual({ ok: true, url: "https://chat.example.com" });
  });

  it("keeps a path prefix and a port", () => {
    expect(normalizeServerUrl("https://example.com:8443/lumio/")).toEqual({ ok: true, url: "https://example.com:8443/lumio" });
  });

  it("allows plain http only on the machine itself or a private network", () => {
    for (const host of ["localhost:8000", "192.168.1.20:8000", "10.0.0.5", "172.20.1.1", "mac.local:8000"]) {
      expect(normalizeServerUrl(`http://${host}`).ok).toBe(true);
    }
    expect(normalizeServerUrl("http://example.com").ok).toBe(false);
    expect(normalizeServerUrl("http://172.40.0.1").ok).toBe(false);
  });

  it("rejects other schemes, credentials and empty input", () => {
    expect(normalizeServerUrl("ftp://example.com").ok).toBe(false);
    expect(normalizeServerUrl("https://user:pw@example.com").ok).toBe(false);
    expect(normalizeServerUrl("   ").ok).toBe(false);
  });
});
