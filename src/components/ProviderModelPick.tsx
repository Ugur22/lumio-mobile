import { Check } from "lucide-react-native";
import { useMemo } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { customCandidate, groupModels } from "@/lib/modelOptions";
import { usePalette } from "@/lib/theme";

interface Props {
  models: string[];
  query: string;
  picked: string | null;
  error: string | null;
  busy: boolean;
  onQuery: (v: string) => void;
  onPick: (model: string) => void;
  onDone: () => void;
}

// The key worked and the provider listed its models; the person picks the one to start with.
export function ProviderModelPick({ models, query, picked, error, busy, onQuery, onPick, onDone }: Props) {
  const palette = usePalette();
  const items = useMemo(() => {
    const listed = groupModels(models, query).flatMap((g) => g.items);
    const typed = customCandidate(models, query);
    return typed ? [typed, ...listed] : listed;
  }, [models, query]);

  return (
    <View className="flex-1 gap-3">
      <View className="mx-4 flex-row items-center gap-2 rounded-xl bg-bubble px-3 py-2.5">
        <View className="h-2 w-2 rounded-full bg-accent" />
        <Text className="text-[14px] font-medium text-text">
          Connected{models.length ? ` · ${models.length} model${models.length === 1 ? "" : "s"} found` : ""}
        </Text>
      </View>
      <Text className="px-5 text-xs font-semibold uppercase text-muted">Start with</Text>
      <TextInput
        className="mx-4 rounded-xl border border-border bg-surface px-4 py-3 text-[16px] text-text"
        value={query}
        onChangeText={onQuery}
        placeholder="Search or type a model ID"
        placeholderTextColor={palette.muted}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
      <FlatList
        className="flex-1"
        data={items}
        keyExtractor={(m) => m}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={<Text className="px-5 pt-2 text-muted">No models listed. Type a model ID.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPick(item)} accessibilityRole="button" className="flex-row items-center justify-between px-5 py-3">
            <Text className="flex-1 text-[16px] text-text" numberOfLines={1}>
              {!models.includes(item) ? `Use “${item}”` : item}
            </Text>
            {item === picked ? <Check size={18} color={palette.accent} /> : null}
          </Pressable>
        )}
      />
      <View className="gap-3 px-4 pb-2">
        {error ? (
          <View accessibilityRole="alert" className="rounded-[10px] border-l-[3px] border-warn-bar bg-warn-bg px-3 py-2.5">
            <Text className="text-[13px] text-text">{error}</Text>
          </View>
        ) : null}
        <Text className="px-1 text-[13px] text-muted">You can switch model any time from the chat header.</Text>
        <Button label="Start chatting" onPress={onDone} disabled={!picked} busy={busy} />
      </View>
    </View>
  );
}
