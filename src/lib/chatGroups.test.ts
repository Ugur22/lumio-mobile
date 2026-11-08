import { describe, expect, it } from "vitest";

import type { ChatSummary } from "@/api/types";
import { groupChats } from "./chatGroups";

const chat = (id: string, updated: string): ChatSummary => ({ id, title: id, message_count: 1, updated });
const now = new Date(2026, 10, 7, 12, 0);
const at = (daysAgo: number, hour = 10) => new Date(2026, 10, 7 - daysAgo, hour).toISOString();

describe("groupChats", () => {
  it("returns nothing for no chats", () => {
    expect(groupChats([], now)).toEqual([]);
  });

  it("buckets by calendar day and puts a header before each bucket", () => {
    const rows = groupChats(
      [chat("old", at(30)), chat("today", at(0)), chat("week", at(5)), chat("yday", at(1, 23))],
      now,
    );
    expect(rows.map((r) => (r.kind === "header" ? r.label : r.key))).toEqual([
      "Today",
      "today",
      "Yesterday",
      "yday",
      "Previous 7 days",
      "week",
      "Older",
      "old",
    ]);
  });

  it("sorts newest first within a bucket", () => {
    const rows = groupChats([chat("a", at(0, 8)), chat("b", at(0, 11))], now);
    expect(rows.filter((r) => r.kind === "chat").map((r) => r.key)).toEqual(["b", "a"]);
  });
});
