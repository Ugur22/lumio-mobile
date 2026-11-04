import { describe, expect, it } from "vitest";

import type { Message } from "@/api/types";
import type { Pending } from "@/store/stream";

import { buildRows, nextTurnKeys } from "./rows";

const msg = (role: Message["role"], content: string): Message => ({
  role,
  content,
  created: "2026-01-01T00:00:00Z",
  images: [],
  query: null,
  sources: [],
});

const pending = (extra: object): Pending => ({ text: "hi", chatId: "c1", images: [], ...extra }) as unknown as Pending;

describe("buildRows", () => {
  it("is empty for a blank chat", () => {
    expect(buildRows(undefined, null)).toEqual([]);
  });

  it("maps saved messages by position", () => {
    const rows = buildRows([msg("user", "a"), msg("assistant", "b")], null);
    expect(rows.map((r) => [r.key, r.role, r.text])).toEqual([
      ["m-0", "user", "a"],
      ["m-1", "assistant", "b"],
    ]);
  });

  it("appends the turn in flight with an empty reply while thinking", () => {
    const rows = buildRows([msg("user", "a"), msg("assistant", "b")], pending({ status: "thinking" }));
    expect(rows.slice(2).map((r) => [r.key, r.role, r.text, r.state])).toEqual([
      ["m-2", "user", "hi", "done"],
      ["m-3", "assistant", "", "thinking"],
    ]);
  });

  it("shows the streamed reply, and the error text on failure", () => {
    expect(buildRows([], pending({ status: "streaming", reply: "Hel" }))[1]).toMatchObject({ text: "Hel", state: "streaming" });
    expect(buildRows([], pending({ status: "error", error: "boom" }))[1]).toMatchObject({ text: "boom", state: "error" });
  });

  it("gives the saved turn the keys the pending one had", () => {
    const during = buildRows([], pending({ status: "streaming", reply: "x" })).map((r) => r.key);
    const after = buildRows([msg("user", "hi"), msg("assistant", "x")], null).map((r) => r.key);
    expect(after).toEqual(during);
    expect(nextTurnKeys(0)).toEqual({ userKey: "m-0", replyKey: "m-1" });
  });
});
