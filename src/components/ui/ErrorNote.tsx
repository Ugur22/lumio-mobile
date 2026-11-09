import { Text, View } from "react-native";

export function ErrorNote({ children }: { children: string }) {
  return (
    <View accessibilityRole="alert" className="rounded-[10px] border-l-[3px] border-warn-bar bg-warn-bg px-3 py-2.5">
      <Text className="text-[13px] text-text">{children}</Text>
    </View>
  );
}
