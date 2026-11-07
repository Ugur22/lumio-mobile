import { ArrowDown } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable } from "react-native";

import { usePalette } from "@/lib/theme";

interface Props {
  visible: boolean;
  onPress: () => void;
}

const FADE_MS = 150;

// The round "scroll to latest" arrow. Fades in and out lightly; with reduce motion it just appears and disappears.
export function JumpToLatest({ visible, onPress }: Props) {
  const palette = usePalette();
  const [opacity] = useState(() => new Animated.Value(0));
  // Stays true until the fade-out has finished. Only set from animation callbacks, never synchronously in an effect.
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => (reduceMotion.current = v));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const to = visible ? 1 : 0;
    if (reduceMotion.current) {
      opacity.setValue(to);
      queueMicrotask(() => setMounted(visible));
      return;
    }
    const anim = Animated.timing(opacity, { toValue: to, duration: FADE_MS, useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished) setMounted(visible);
    });
    return () => anim.stop();
  }, [visible, opacity]);

  if (!visible && !mounted) return null;
  return (
    <Animated.View style={{ opacity }} pointerEvents={visible ? "auto" : "none"}>
      <Pressable
        onPress={onPress}
        accessibilityLabel="Scroll to latest"
        className="h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
      >
        <ArrowDown size={20} color={palette.text} />
      </Pressable>
    </Animated.View>
  );
}
