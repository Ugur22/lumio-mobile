import { Plug } from "lucide-react-native";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { EMPTY_COPY, type EmptyKind } from "@/lib/emptyProviders";
import { usePalette } from "@/lib/theme";
import { useSheets } from "@/store/sheets";

// Shown in place of a blank chat when there is no provider to send to.
export function EmptyProviders({ kind }: { kind: EmptyKind }) {
  const palette = usePalette();
  const { title, body } = EMPTY_COPY[kind];
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <View className="h-14 w-14 items-center justify-center rounded-2xl border border-border bg-panel">
        <Plug size={26} color={palette.accent} />
      </View>
      <Text accessibilityRole="header" className="text-center font-heading text-[26px] leading-8 text-text">
        {title}
      </Text>
      <Text className="text-center text-[15px] leading-[22px] text-muted">{body}</Text>
      <View className="w-full gap-1 pt-2">
        <Button label="Add a provider" onPress={() => useSheets.getState().setAddProvider(true)} />
        <Button label="Set up on the web instead" variant="ghost" onPress={() => useSheets.getState().setWebSetup(true)} />
      </View>
    </View>
  );
}
