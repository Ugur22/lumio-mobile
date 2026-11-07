import { X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { usePalette } from "@/lib/theme";
import { useSession } from "@/store/session";
import { useSheets } from "@/store/sheets";

// What the sign-in left for the app to say once (the account had already used its free trial).
export function FlashNotice() {
  const palette = usePalette();
  const flash = useSession((s) => s.flash);
  if (!flash) return null;
  return (
    <View accessibilityRole="alert" className="flex-row items-center gap-3 bg-bubble px-4 py-2">
      <Text className="min-w-0 flex-1 text-[13px] text-text">{flash}</Text>
      <Pressable onPress={() => useSheets.getState().setProviders(true)} hitSlop={8}>
        <Text className="text-[13px] font-medium text-accent">Providers</Text>
      </Pressable>
      <Pressable onPress={() => useSession.getState().dismissFlash()} hitSlop={10} accessibilityLabel="Dismiss">
        <X size={16} color={palette.muted} />
      </Pressable>
    </View>
  );
}
