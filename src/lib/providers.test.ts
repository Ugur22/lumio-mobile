import { describe, expect, it } from "vitest";

import type { Profile, ProfileList } from "@/api/types";

import { effectiveProfile } from "./providers";

describe("effectiveProfile", () => {
  const p = (id: string) => ({ id }) as Profile;
  const list: ProfileList = { active: "a", profiles: [p("a"), p("b")] };

  it("prefers the chat's own provider", () => {
    expect(effectiveProfile(list, "b")).toEqual({ profile: p("b"), fellBack: false });
  });

  it("follows the default when the chat has none", () => {
    expect(effectiveProfile(list, null)).toEqual({ profile: p("a"), fellBack: false });
  });

  it("falls back and flags it when the chat's provider was deleted", () => {
    expect(effectiveProfile(list, "gone")).toEqual({ profile: p("a"), fellBack: true });
  });

  it("does not flag a fallback before profiles load", () => {
    expect(effectiveProfile(undefined, "b")).toEqual({ profile: undefined, fellBack: false });
  });
});
