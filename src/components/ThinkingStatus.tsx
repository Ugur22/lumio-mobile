import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { counterText, labelOf, orbStateOf, phaseOf, sourceDomains } from "@/lib/thinking";
import { usePalette } from "@/lib/theme";
import { useStream } from "@/store/stream";

import { ThinkingOrb } from "./ThinkingOrb";

const TICK_MS = 1000;

// Milliseconds since `startedAt`, re-read once a second by a timer that is cleared on unmount.
function useElapsed(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [startedAt]);
  return Math.max(0, now - startedAt);
}

const chip = "max-w-full rounded-full border border-border bg-panel px-2.5 py-0.5";

// The status line while no reply text has arrived: what the model is doing, and how long it has been. Only the label
// is announced; the counter ticks every second and stays out of the accessibility tree.
export function ThinkingStatus() {
  const palette = usePalette();
  const startedAt = useStream((s) => s.pending?.startedAt ?? 0);
  const reasoningSeen = useStream((s) => s.reasoningSeen);
  const query = useStream((s) => s.query);
  const sources = useStream((s) => s.sources);
  const elapsedMs = useElapsed(startedAt);
  const phase = phaseOf({ elapsedMs, reasoningSeen, query, sources, hasText: false });
  if (phase === "writing") return null;
  const label = labelOf(phase);
  const counter = counterText(elapsedMs);
  // Searching shows the query; reading shows the hosts. Hosts are only parsed in the phase that shows them.
  const chips = phase === "searching" ? [query?.trim() ?? ""].filter(Boolean) : phase === "reading" ? sourceDomains(sources) : [];

  return (
    // One line tall, like the reply text it makes way for, so the row does not jump when text starts.
    <View accessibilityLiveRegion="polite">
      <View className="min-h-7 flex-row items-center gap-2">
        <ThinkingOrb state={orbStateOf(phase)} color={palette.accent} />
        <Text accessibilityRole="text" accessibilityLabel={label} style={{ color: palette.muted, fontSize: 15 }}>
          {label}
        </Text>
        {counter ? (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ color: palette.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}
          >
            {counter}
          </Text>
        ) : null}
      </View>
      {chips.length > 0 ? (
        <View className="mt-1 flex-row flex-wrap gap-1.5">
          {chips.map((c) => (
            <View key={c} className={chip}>
              <Text numberOfLines={1} style={{ color: phase === "searching" ? palette.text : palette.muted, fontSize: 13 }}>
                {c}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
