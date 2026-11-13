import { memo, useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { orbMotion, type OrbState } from "@/lib/thinking";

const SIZE = 20;
const CORE = SIZE * 0.55;
const dot = { width: CORE, height: CORE, borderRadius: SIZE } as const;

// A small orb whose beat follows the phase. Under reduce motion it stays a still core. Memoised because the status
// line around it re-renders every second for its counter.
export const ThinkingOrb = memo(function ThinkingOrb({ state, color }: { state: OrbState; color: string }) {
  const [beat] = useState(() => new Animated.Value(0));
  const reduceMotion = useReduceMotion();
  const { period, low, high, halo } = orbMotion(state);

  useEffect(() => {
    if (reduceMotion) return;
    beat.setValue(0);
    const step = (toValue: number) =>
      Animated.timing(beat, { toValue, duration: period / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([step(1), step(0)]));
    loop.start();
    return () => loop.stop();
  }, [beat, period, reduceMotion]);

  const showHalo = halo && !reduceMotion;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}
    >
      {showHalo ? (
        <Animated.View
          style={[
            dot,
            {
              position: "absolute",
              borderWidth: 1.5,
              borderColor: color,
              opacity: beat.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
            },
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          dot,
          {
            backgroundColor: color,
            transform: [{ scale: reduceMotion ? 1 : beat.interpolate({ inputRange: [0, 1], outputRange: [low, high] }) }],
          },
        ]}
      />
    </View>
  );
});
