import { describe, expect, it } from "vitest";

import type { Message } from "@/api/types";
import type { Pending } from "@/store/stream";

import { activePending, buildRows, nextTurnKeys } from "./rows";

const msg = (role: Message["role"], content: string): Message => ({
  role,
  content,
  created: "2026-01-01T00:00:00Z",
  images: [],
  query: null,
  sources: [],
});

// `baseCount`: the saved messages the chat had when the turn started (two here, as in most tests below).
const pending = (extra: object): Pending => ({ text: "hi", chatId: "c1", images: [], baseCount: 2, ...extra }) as unknown as Pending;

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

  // The saved chat reaches the screen a render before `pending` is cleared (the send mutation waits on a refetch in
  // between), so for that moment the turn is in both and used to be drawn twice.
  it("draws the turn once while the saved chat already has it and pending is not cleared yet", () => {
    const saved = [msg("user", "a"), msg("assistant", "b"), msg("user", "hi"), msg("assistant", "answer")];
    const rows = buildRows(saved, pending({ status: "streaming", reply: "ans" }));
    expect(rows.map((r) => [r.key, r.role, r.text, r.state])).toEqual([
      ["m-0", "user", "a", "done"],
      ["m-1", "assistant", "b", "done"],
      ["m-2", "user", "hi", "done"],
      ["m-3", "assistant", "answer", "done"],
    ]);
  });

  describe("activePending", () => {
    const saved = (n: number) => Array.from({ length: n }, (_, i) => msg(i % 2 ? "assistant" : "user", `m${i}`));

    it("keeps the turn while the saved chat does not have it yet", () => {
      const p = pending({ status: "streaming", reply: "x" });
      expect(activePending(saved(2), p)).toBe(p);
      expect(activePending(saved(3), p)).toBe(p);
    });

    it("drops the turn once the saved chat has it", () => {
      expect(activePending(saved(4), pending({ status: "streaming", reply: "x" }))).toBeNull();
      expect(activePending(saved(4), pending({ status: "thinking" }))).toBeNull();
    });

    it("keeps an error, because nothing was saved for it", () => {
      const p = pending({ status: "error", error: "boom" });
      expect(activePending(saved(6), p)).toBe(p);
    });

    it("counts from zero for a chat the first message creates", () => {
      const p = pending({ status: "streaming", reply: "x", baseCount: 0 });
      expect(activePending(undefined, p)).toBe(p);
      expect(activePending(saved(2), p)).toBeNull();
    });

    it("passes null through", () => {
      expect(activePending(saved(4), null)).toBeNull();
    });
  });

  it("does not hide a turn that is still in flight when the saved chat is shorter", () => {
    const rows = buildRows([msg("user", "a"), msg("assistant", "b")], pending({ status: "streaming", reply: "ans" }));
    expect(rows.map((r) => r.key)).toEqual(["m-0", "m-1", "m-2", "m-3"]);
    expect(rows[3]).toMatchObject({ text: "ans", state: "streaming" });
  });
});
