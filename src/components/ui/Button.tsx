import { ActivityIndicator, Pressable, Text } from "react-native";

import { usePalette } from "@/lib/theme";

interface Props {
  label: string;
  onPress: () => void;
  // "primary" is the one main action of a screen; "ghost" is a quiet way out.
  variant?: "primary" | "ghost";
  disabled?: boolean;
  busy?: boolean;
}

export function Button({ label, onPress, variant = "primary", disabled, busy }: Props) {
  const palette = usePalette();
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      className={`h-12 items-center justify-center rounded-xl ${primary ? "bg-accent" : ""} ${disabled ? "opacity-50" : ""}`}
    >
      {busy ? (
        <ActivityIndicator color={primary ? palette.bg : palette.accent} />
      ) : (
        <Text className={`text-[16px] font-medium ${primary ? "text-on-accent" : "text-accent"}`}>{label}</Text>
      )}
    </Pressable>
  );
}
