import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// The system "reduce motion" setting, kept current while the component is mounted.
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);
  return reduceMotion;
}
