import type { SourceRef } from "@/api/types";

// What the status line says while no reply text has been shown yet.
export type Phase = "waiting" | "still" | "thinking" | "searching" | "reading" | "writing";

// The counter stays hidden for the first seconds so a quick reply never flashes a number.
export const COUNTER_AFTER_MS = 3000;
// With no signal for this long the label changes, so a slow model never looks frozen.
export const STILL_AFTER_MS = 6000;

export interface PhaseInput {
  elapsedMs: number;
  // Reasoning has started streaming. Its text is never kept on the phone.
  reasoningSeen: boolean;
  query: string | null;
  sources: readonly SourceRef[];
  // Reply text has been shown.
  hasText: boolean;
}

// The later the stage, the more it wins: text over sources over a query over reasoning over silence.
export function phaseOf({ elapsedMs, reasoningSeen, query, sources, hasText }: PhaseInput): Phase {
  if (hasText) return "writing";
  if (sources.length > 0) return "reading";
  if (query?.trim()) return "searching";
  if (reasoningSeen) return "thinking";
  return elapsedMs >= STILL_AFTER_MS ? "still" : "waiting";
}

const LABEL: Record<Exclude<Phase, "writing">, string> = {
  waiting: "Thinking",
  still: "Still thinking",
  thinking: "Thinking",
  searching: "Searching the web",
  reading: "Reading sources",
};

export const labelOf = (phase: Exclude<Phase, "writing">) => LABEL[phase];

export const counterText = (elapsedMs: number) =>
  elapsedMs >= COUNTER_AFTER_MS ? `· ${Math.floor(elapsedMs / 1000)}s` : "";
