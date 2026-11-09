import { describe, expect, it } from "vitest";

import type { Profile, ProfileList } from "@/api/types";

import { emptyKind } from "./emptyProviders";
import { NO_TRIAL } from "./trial";

const profiles = (...managed: boolean[]) =>
  ({ active: null, profiles: managed.map((m, i) => ({ id: String(i), managed: m }) as Profile) }) as ProfileList;
const trial = (over = {}) => ({ enrolled: true, limit: 5, used: 5, remaining: 0, ended: true, ...over });

describe("emptyKind", () => {
  it("waits for both answers", () => {
    expect(emptyKind(undefined, NO_TRIAL, true)).toBeNull();
    expect(emptyKind(profiles(), NO_TRIAL, false)).toBeNull();
  });

  it("is new for an account that never had a provider or trial", () => {
    expect(emptyKind(profiles(), NO_TRIAL, true)).toBe("new");
    expect(emptyKind(profiles(), undefined, true)).toBe("new");
  });

  it("is ended once the trial is used up and no own provider exists", () => {
    expect(emptyKind(profiles(), trial(), true)).toBe("ended");
  });

  it("is not shown while the trial still runs", () => {
    expect(emptyKind(profiles(true), trial({ used: 2, remaining: 3, ended: false }), true)).toBeNull();
  });

  it("is not shown once the person has their own provider", () => {
    expect(emptyKind(profiles(false), trial(), true)).toBeNull();
    expect(emptyKind(profiles(false), NO_TRIAL, true)).toBeNull();
  });
});
