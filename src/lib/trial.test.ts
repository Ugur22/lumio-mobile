import { describe, expect, it } from "vitest";

import type { Profile, ProfileList } from "@/api/types";

import {
  NO_TRIAL,
  TRIAL_ENDED,
  TRIAL_FULL,
  bannerText,
  hasOwnProvider,
  normalizeTrial,
  sendBlocked,
  trialActive,
  trialBanner,
  trialFailure,
} from "./trial";

const status = (over: Partial<typeof NO_TRIAL> = {}) => ({ enrolled: true, limit: 5, used: 2, remaining: 3, ended: false, ...over });
const profile = (managed: boolean) => ({ id: managed ? "m" : "p", managed }) as Profile;

describe("normalizeTrial", () => {
  it("reads malformed answers as no trial", () => {
    expect(normalizeTrial(undefined)).toBe(NO_TRIAL);
    expect(normalizeTrial("x")).toBe(NO_TRIAL);
    expect(normalizeTrial({ enrolled: false, limit: 5 })).toBe(NO_TRIAL);
  });

  it("clamps counts", () => {
    expect(normalizeTrial({ enrolled: true, limit: 5, used: -1, remaining: 99, ended: false })).toEqual(
      status({ used: 0, remaining: 5 }),
    );
    expect(normalizeTrial({ enrolled: true, limit: "5", remaining: NaN })).toEqual(status({ limit: 0, used: 0, remaining: 0 }));
  });
});

describe("banner", () => {
  it("counts down, then says last, then ended", () => {
    expect(bannerText(trialBanner(status())!)).toBe("3 of 5 free messages left");
    expect(bannerText(trialBanner(status({ remaining: 1 }))!)).toBe("Last free message");
    expect(bannerText(trialBanner(status({ remaining: 0 }))!)).toBe("Free trial ended");
    expect(trialBanner(status({ ended: true }))).toEqual({ kind: "ended" });
  });

  it("is absent without a trial", () => {
    expect(trialBanner(undefined)).toBeNull();
    expect(trialBanner(NO_TRIAL)).toBeNull();
  });

  it("is active only while messages remain", () => {
    expect(trialActive(status())).toBe(true);
    expect(trialActive(status({ remaining: 0 }))).toBe(false);
    expect(trialActive(status({ ended: true }))).toBe(false);
    expect(trialActive(undefined)).toBe(false);
  });
});

describe("trialFailure", () => {
  it("treats 402 as ended and a trial 503 as full", () => {
    expect(trialFailure({ status: 402, message: "x" })).toEqual({ kind: "ended", message: TRIAL_ENDED });
    expect(trialFailure({ status: 503, message: "Free trials are full today, try tomorrow" })).toEqual({
      kind: "full",
      message: TRIAL_FULL,
    });
  });

  it("leaves other failures alone", () => {
    expect(trialFailure({ status: 503, message: "Bad gateway" })).toBeNull();
    expect(trialFailure({ status: 500, message: "Free trial" })).toBeNull();
    expect(trialFailure(new Error("x"))).toBeNull();
    expect(trialFailure(null)).toBeNull();
  });
});

describe("sendBlocked", () => {
  it("blocks only an ended trial on the managed profile", () => {
    const ended = status({ remaining: 0, ended: true });
    expect(sendBlocked(ended, profile(true))).toBe(true);
    expect(sendBlocked(ended, profile(false))).toBe(false);
    expect(sendBlocked(status(), profile(true))).toBe(false);
    expect(sendBlocked(undefined, profile(true))).toBe(false);
  });

  it("knows whether the person has a provider of their own", () => {
    expect(hasOwnProvider({ profiles: [profile(true)] } as ProfileList)).toBe(false);
    expect(hasOwnProvider({ profiles: [profile(true), profile(false)] } as ProfileList)).toBe(true);
    expect(hasOwnProvider(undefined)).toBe(false);
  });
});
