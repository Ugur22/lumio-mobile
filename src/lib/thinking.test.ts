import { describe, expect, it } from "vitest";

import type { SourceRef } from "@/api/types";

import { counterText, labelOf, phaseOf, type PhaseInput } from "./thinking";

const base: PhaseInput = { elapsedMs: 0, reasoningSeen: false, query: null, sources: [], hasText: false };
const src = { url: "https://a.test", title: "A" } as unknown as SourceRef;

describe("phaseOf", () => {
  it("waits, then admits it is still thinking after 6 s of silence", () => {
    expect(phaseOf(base)).toBe("waiting");
    expect(phaseOf({ ...base, elapsedMs: 5999 })).toBe("waiting");
    expect(phaseOf({ ...base, elapsedMs: 6000 })).toBe("still");
  });

  it("any signal beats the silence label", () => {
    expect(phaseOf({ ...base, elapsedMs: 20000, reasoningSeen: true })).toBe("thinking");
  });

  it("ranks searching over thinking, reading over searching, text over everything", () => {
    expect(phaseOf({ ...base, reasoningSeen: true, query: "weather" })).toBe("searching");
    expect(phaseOf({ ...base, query: "weather", sources: [src] })).toBe("reading");
    expect(phaseOf({ ...base, query: "weather", sources: [src], hasText: true })).toBe("writing");
  });

  it("ignores a blank query", () => {
    expect(phaseOf({ ...base, query: "   " })).toBe("waiting");
  });
});

describe("labels and counter", () => {
  it("words each phase", () => {
    expect(labelOf("waiting")).toBe("Thinking");
    expect(labelOf("still")).toBe("Still thinking");
    expect(labelOf("thinking")).toBe("Thinking");
    expect(labelOf("searching")).toBe("Searching the web");
    expect(labelOf("reading")).toBe("Reading sources");
  });

  it("shows seconds only after 3 s", () => {
    expect(counterText(2999)).toBe("");
    expect(counterText(3000)).toBe("· 3s");
    expect(counterText(12900)).toBe("· 12s");
  });
});
