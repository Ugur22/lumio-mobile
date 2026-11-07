import { describe, expect, it } from "vitest";

import { FALLBACK_AUTH_ERROR, authErrorText, isSignedInNotice, oauthStartUrl, parseAuthRedirect } from "./oauth";

describe("oauthStartUrl", () => {
  it("asks for the app flow with an encoded redirect and the challenge", () => {
    const url = oauthStartUrl("https://chat.example.com", "google", "exp://192.168.1.5:8081/--/auth", "abc-_123");
    expect(url).toBe(
      "https://chat.example.com/api/auth/oauth/google/start?client=app&redirect=exp%3A%2F%2F192.168.1.5%3A8081%2F--%2Fauth&challenge=abc-_123",
    );
  });
});

describe("parseAuthRedirect", () => {
  it("reads a code", () => {
    expect(parseAuthRedirect("lumio://auth?code=abc123")).toEqual({ code: "abc123", error: null });
  });

  it("reads a code together with trial_used", () => {
    expect(parseAuthRedirect("exp://192.168.1.5:8081/--/auth?code=abc&auth_error=trial_used")).toEqual({
      code: "abc",
      error: "trial_used",
    });
  });

  it("reads an error alone and ignores a fragment", () => {
    expect(parseAuthRedirect("lumio://auth?auth_error=denied#x=1")).toEqual({ code: null, error: "denied" });
  });

  it("returns nothing for a URL without a query or with empty or broken values", () => {
    expect(parseAuthRedirect("lumio://auth")).toEqual({ code: null, error: null });
    expect(parseAuthRedirect("lumio://auth?code=&auth_error=%E0%A4%A")).toEqual({ code: null, error: null });
  });

  it("takes the first of a repeated key", () => {
    expect(parseAuthRedirect("lumio://auth?code=one&code=two").code).toBe("one");
  });
});

describe("authErrorText", () => {
  it("words every code the server can send", () => {
    for (const code of ["unavailable", "state", "denied", "provider", "unverified", "too_new", "disposable", "throttled", "disabled", "trial_used"]) {
      expect(authErrorText(code)).not.toBe(FALLBACK_AUTH_ERROR);
    }
  });

  it("never shows the URL's own text", () => {
    expect(authErrorText("<script>alert(1)</script>")).toBe(FALLBACK_AUTH_ERROR);
    expect(authErrorText("constructor")).toBe(FALLBACK_AUTH_ERROR);
    expect(authErrorText("__proto__")).toBe(FALLBACK_AUTH_ERROR);
    expect(authErrorText("")).toBe(FALLBACK_AUTH_ERROR);
  });

  it("treats only trial_used as a signed-in notice", () => {
    expect(isSignedInNotice("trial_used")).toBe(true);
    expect(isSignedInNotice("denied")).toBe(false);
  });
});
