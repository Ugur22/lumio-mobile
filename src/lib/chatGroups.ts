import type { ChatSummary } from "@/api/types";

export type ChatRow = { kind: "header"; key: string; label: string } | { kind: "chat"; key: string; chat: ChatSummary };

const DAY = 24 * 60 * 60 * 1000;

function bucket(updated: number, startOfToday: number): string {
  if (updated >= startOfToday) return "Today";
  if (updated >= startOfToday - DAY) return "Yesterday";
  if (updated >= startOfToday - 7 * DAY) return "Previous 7 days";
  return "Older";
}

// Calendar days in the phone's timezone, so a chat from 23:50 is still "Yesterday" at 00:10.
export function groupChats(chats: ChatSummary[], now: Date = new Date()): ChatRow[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sorted = [...chats].sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
  const rows: ChatRow[] = [];
  let current = "";
  for (const chat of sorted) {
    const label = bucket(Date.parse(chat.updated), startOfToday);
    if (label !== current) {
      current = label;
      rows.push({ kind: "header", key: `h:${label}`, label });
    }
    rows.push({ kind: "chat", key: chat.id, chat });
  }
  return rows;
}
