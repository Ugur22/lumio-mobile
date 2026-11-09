import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { PRESETS, hostOf, type Preset } from "@/lib/providerPresets";
import { usePalette } from "@/lib/theme";

interface Props {
  onPreset: (preset: Preset) => void;
  onCustom: () => void;
}

function Row({ mark, title, detail, divider, onPress }: { mark: string; title: string; detail: string; divider: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={`flex-row items-center gap-3 px-4 py-3 ${divider ? "border-t border-border" : ""}`}>
      <View className="h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-panel">
        <Text className="text-[14px] font-semibold text-accent">{mark}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[16px] font-medium text-text">{title}</Text>
        <Text className="text-[12px] text-muted" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={18} color={palette.muted} />
    </Pressable>
  );
}

export function ProviderPicker({ onPreset, onCustom }: Props) {
  return (
    <View className="gap-3 px-4">
      <View className="overflow-hidden rounded-xl border border-border bg-surface">
        {PRESETS.map((p, i) => (
          <Row key={p.id} mark={p.name.charAt(0)} title={p.name} detail={hostOf(p.baseUrl)} divider={i > 0} onPress={() => onPreset(p)} />
        ))}
        <Row mark="+" title="Other" detail="Ollama, LM Studio, or your own server" divider onPress={onCustom} />
      </View>
      <Text className="px-1 text-[13px] text-muted">Any service that speaks the OpenAI API works.</Text>
    </View>
  );
}
