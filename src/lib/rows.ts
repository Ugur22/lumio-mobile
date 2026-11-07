import type { Message } from "@/api/types";
import type { Pending } from "@/store/stream";

export interface Row {
  // By position, not chat: the saved reply then keeps the key of the pending one and the list does not remount it.
  key: string;
  role: "user" | "assistant";
  text: string;
  state: "done" | "thinking" | "streaming" | "error";
  // Stored pictures (attached to a saved message, or generated for a reply).
  images: Message["images"];
  // Local files of the photos in a turn that is still being sent.
  previews: string[];
  // An error row that is the trial speaking (ended, full) rather than a fault.
  notice?: boolean;
}

const rowKey = (index: number) => `m-${index}`;

// The saved messages, then the turn in flight (the sent text and the reply so far). Once the server has saved the turn
// `pending` is cleared and the same positions come from `messages`.
export function buildRows(messages: readonly Message[] | undefined, pending: Pending | null): Row[] {
  const rows: Row[] = (messages ?? []).map((m, i) => ({
    key: rowKey(i),
    role: m.role,
    text: m.content,
    state: "done",
    images: m.images,
    previews: [],
  }));
  if (!pending) return rows;
  const at = rows.length;
  rows.push({ key: rowKey(at), role: "user", text: pending.text, state: "done", images: [], previews: pending.images });
  rows.push({
    key: rowKey(at + 1),
    role: "assistant",
    text: pending.status === "streaming" ? pending.reply : pending.status === "error" ? pending.error : "",
    state: pending.status,
    images: [],
    previews: [],
    ...(pending.status === "error" && pending.notice && { notice: true }),
  });
  return rows;
}

// The row keys the next sent turn will use, so the screen can follow it before the rows exist.
export const nextTurnKeys = (rowCount: number) => ({ userKey: rowKey(rowCount), replyKey: rowKey(rowCount + 1) });
