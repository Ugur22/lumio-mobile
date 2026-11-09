import { describe, expect, it } from "vitest";

import type { Profile, ProfileList } from "@/api/types";

import { PRESETS, addedProfile, cleanKey, hostOf, newProfileBody, validBaseUrl } from "./providerPresets";

const list = (ids: string[]) => ({ active: ids[0] ?? null, profiles: ids.map((id) => ({ id }) as Profile) }) as ProfileList;

describe("presets", () => {
  it("point at https base URLs the server accepts", () => {
    for (const p of PRESETS) {
      expect(p.baseUrl.startsWith("https://")).toBe(true);
      expect(validBaseUrl(p.baseUrl)).toBe(true);
      expect(p.keyUrl.startsWith("https://")).toBe(true);
    }
  });
});

describe("hostOf", () => {
  it("drops the scheme and trailing slash", () => {
    expect(hostOf("https://openrouter.ai/api/v1/")).toBe("openrouter.ai/api/v1");
  });
});

describe("cleanKey", () => {
  it("removes whitespace a paste can bring along", () => {
    expect(cleanKey("  sk-abc\n")).toBe("sk-abc");
    expect(cleanKey("sk-a bc\t")).toBe("sk-abc");
  });
});

describe("validBaseUrl", () => {
  it("wants a scheme and a host", () => {
    expect(validBaseUrl("http://localhost:11434/v1")).toBe(true);
    expect(validBaseUrl("  https://api.example.com/v1 ")).toBe(true);
    expect(validBaseUrl("api.example.com")).toBe(false);
    expect(validBaseUrl("https://")).toBe(false);
    expect(validBaseUrl("")).toBe(false);
  });
});

describe("newProfileBody", () => {
  it("trims, cleans the key and marks it needed", () => {
    expect(newProfileBody({ name: " OpenRouter ", baseUrl: " https://openrouter.ai/api/v1 ", model: "m", key: " sk-1\n" })).toEqual({
      name: "OpenRouter",
      base_url: "https://openrouter.ai/api/v1",
      model: "m",
      needs_key: true,
      key: "sk-1",
    });
  });

  it("sends no key for a server that needs none", () => {
    const body = newProfileBody({ name: "Ollama", baseUrl: "http://localhost:11434/v1", model: "m", key: "  " });
    expect(body.needs_key).toBe(false);
    expect(body.key).toBeNull();
  });

  it("keeps the name within the server's limit", () => {
    expect(newProfileBody({ name: "x".repeat(80), baseUrl: "https://a.b", model: "m", key: "k" }).name).toHaveLength(60);
  });
});

describe("addedProfile", () => {
  it("finds the profile that was not in the list before", () => {
    expect(addedProfile(list(["a"]), list(["a", "b"]))?.id).toBe("b");
  });

  it("takes the only profile when there was no list", () => {
    expect(addedProfile(undefined, list(["a"]))?.id).toBe("a");
  });

  it("returns nothing when nothing was added", () => {
    expect(addedProfile(list(["a"]), list(["a"]))).toBeUndefined();
  });
});
