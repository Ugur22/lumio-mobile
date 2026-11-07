import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";

import { counterText, labelOf, phaseOf } from "@/lib/thinking";
import { usePalette } from "@/lib/theme";
import { useStream } from "@/store/stream";

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

function PulseDot({ color }: { color: string }) {
  const [pulse] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: pulse }} />;
}

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

  return (
    // One line tall, like the reply text it makes way for, so the row does not jump when text starts.
    <View className="min-h-7 flex-row items-center gap-2" accessibilityLiveRegion="polite">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <PulseDot color={palette.accent} />
      </View>
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
  );
}
