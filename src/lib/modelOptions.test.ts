import { describe, expect, it } from "vitest";
import { customCandidate, groupModels } from "./modelOptions";

const models = ["openai/gpt-4o", "moonshotai/kimi-k2", "anthropic/claude-3", "gpt-4", "anthropic/claude-2", "alpha"];

describe("groupModels", () => {
  it("groups by vendor, sorts groups and items, and puts ungrouped ids last", () => {
    expect(groupModels(models)).toEqual([
      { vendor: "anthropic", items: ["anthropic/claude-2", "anthropic/claude-3"] },
      { vendor: "moonshotai", items: ["moonshotai/kimi-k2"] },
      { vendor: "openai", items: ["openai/gpt-4o"] },
      { vendor: "Other", items: ["alpha", "gpt-4"] },
    ]);
  });

  it("filters by case-insensitive substring and drops empty groups", () => {
    expect(groupModels(models, "KIMI")).toEqual([{ vendor: "moonshotai", items: ["moonshotai/kimi-k2"] }]);
    expect(groupModels(models, "gpt").map((g) => g.vendor)).toEqual(["openai", "Other"]);
  });

  it("shows everything for a blank query and nothing for no models", () => {
    expect(groupModels(models, "  ").flatMap((g) => g.items)).toHaveLength(models.length);
    expect(groupModels([])).toEqual([]);
  });

  it("de-duplicates repeated ids", () => {
    expect(groupModels(["a/b", "a/b"])).toEqual([{ vendor: "a", items: ["a/b"] }]);
  });
});

describe("customCandidate", () => {
  it("offers typed text that no model matches", () => {
    expect(customCandidate(models, " my/private-model ")).toBe("my/private-model");
    expect(customCandidate([], "x")).toBe("x");
  });

  it("offers nothing for blank text or an exact listed id", () => {
    expect(customCandidate(models, "  ")).toBeNull();
    expect(customCandidate(models, "gpt-4")).toBeNull();
  });
});
