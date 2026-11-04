import { Check, ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, SectionList, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatModelBody } from "@/api/types";
import { useChat, useSetChatModel } from "@/hooks/useChats";
import { useActivateProfile, useProfiles } from "@/hooks/useProfiles";
import { useProviderModels } from "@/hooks/useProviderModels";
import { useSwitchChatProfile } from "@/hooks/useSwitchChatProfile";
import { modelBody, overrideModel, shownModel, showDefaultItem } from "@/lib/chatModel";
import { customCandidate, groupModels } from "@/lib/modelOptions";
import { effectiveProfile } from "@/lib/providers";
import { usePalette } from "@/lib/theme";

interface Props {
  // The open chat; null means a blank chat, where the picker sets the default for new chats.
  chatId: string | null;
  // A blank chat's unsent model pick, held by the screen and sent with the first message.
  pendingModel: ChatModelBody | null;
  onPendingModel: (pick: ChatModelBody | null) => void;
  disabled?: boolean;
}

type Item = { kind: "default"; label: string } | { kind: "model"; model: string };

// The chip under the title and the sheet it opens: provider on top, then the model list for that provider.
export function ProviderSwitcher({ chatId, pendingModel, onPendingModel, disabled }: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { data: profiles, isError } = useProfiles();
  const chat = useChat(chatId).data;
  const activate = useActivateProfile();
  const chatSwitch = useSwitchChatProfile(chat);
  const setModel = useSetChatModel();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { profile: active, fellBack } = effectiveProfile(profiles, chatId ? chat?.profile_id : null);
  const blank = chatId === null;
  const { models, windows, error: modelsError, isPending: modelsLoading } = useProviderModels(active?.id ?? "", open && !!active);
  const groups = useMemo(() => groupModels(models, query), [models, query]);
  const custom = customCandidate(models, query);

  if (isError) return <Text className="text-center text-xs text-warn-bar">Providers unavailable</Text>;
  if (!profiles) return null;
  if (!active) return <Text className="text-center text-xs text-muted">Add a provider on the website</Text>;

  const current = shownModel({ chatModel: chat?.model, pending: pendingModel, profileModel: active.model, blank });
  const override = overrideModel(chat?.model, pendingModel, blank);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActionError(null);
  };

  const changeProvider = (id: string) => {
    if (id === active.id) return;
    setActionError(null);
    if (chatId) chatSwitch.switchTo(id);
    else {
      // The pick was made against the old provider's model list.
      onPendingModel(null);
      activate(id).catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Could not switch provider"));
    }
  };

  const pickModel = async (model: string | null) => {
    setActionError(null);
    const body = modelBody(model, windows);
    if (chatId === null) {
      onPendingModel(model === null ? null : body);
      return close();
    }
    try {
      await setModel.mutateAsync({ id: chatId, body });
      close();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not change the model");
    }
  };

  const sections = [
    ...(showDefaultItem(override)
      ? [{ title: "", data: [{ kind: "default", label: `Use provider default (${active.model})` } as Item] }]
      : []),
    ...groups.map((g) => ({ title: g.vendor, data: g.items.map((model): Item => ({ kind: "model", model })) })),
    ...(custom ? [{ title: "", data: [{ kind: "model", model: custom } as Item] }] : []),
  ];

  const error = actionError ?? chatSwitch.error?.message ?? (modelsError ? `Couldn't load models: ${modelsError.message}` : null);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled || (chatId !== null && !chat)}
        accessibilityLabel={`Provider and model: ${active.name}, ${current}`}
        className="flex-row items-center justify-center gap-1 self-center rounded-full px-2 py-0.5 disabled:opacity-60"
        hitSlop={8}
      >
        <Text className="shrink text-xs text-muted" numberOfLines={1}>
          {active.name} · {current}
        </Text>
        <ChevronDown size={12} color={palette.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View className="flex-1 bg-bg" style={{ paddingBottom: insets.bottom }}>
          <View className="flex-row items-center justify-between px-5 pb-3 pt-4">
            <Text className="text-lg font-semibold text-text">Provider and model</Text>
            <Pressable onPress={close} hitSlop={10}>
              <Text className="text-[17px] font-medium text-accent">Done</Text>
            </Pressable>
          </View>

          {fellBack ? (
            <Text className="px-5 pb-2 text-[13px] text-muted">This chat&apos;s provider was removed. Using the default provider.</Text>
          ) : null}

          <Text className="px-5 pb-1 text-xs font-semibold uppercase text-muted">
            {blank ? "Provider for new chats" : "Provider for this chat"}
          </Text>
          <View className="mx-4 overflow-hidden rounded-xl border border-border bg-surface">
            {profiles.profiles.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => changeProvider(p.id)}
                className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <Text className="text-[16px] text-text">{p.name}</Text>
                {p.id === active.id ? <Check size={18} color={palette.accent} /> : null}
              </Pressable>
            ))}
          </View>

          <Text className="px-5 pb-1 pt-5 text-xs font-semibold uppercase text-muted">
            {blank ? "Model for the next chat" : "Model for this chat"}
          </Text>
          <TextInput
            className="mx-4 mb-2 rounded-xl border border-border bg-surface px-4 py-3 text-[16px] text-text"
            value={query}
            onChangeText={setQuery}
            placeholder="Search or type a model ID"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
          {error ? <Text className="px-5 pb-2 text-[13px] text-warn-bar">{error}</Text> : null}
          {modelsLoading ? <ActivityIndicator className="mt-4" color={palette.muted} /> : null}

          <SectionList
            sections={sections}
            keyExtractor={(item) => (item.kind === "default" ? "default" : item.model)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              modelsLoading || modelsError ? undefined : <Text className="px-5 pt-3 text-muted">No models listed. Type a model ID.</Text>
            }
            renderSectionHeader={({ section }) =>
              section.title ? <Text className="px-5 pb-1 pt-3 text-xs font-medium text-muted">{section.title}</Text> : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => void pickModel(item.kind === "default" ? null : item.model)}
                className="flex-row items-center justify-between px-5 py-3"
              >
                <Text className="flex-1 text-[16px] text-text" numberOfLines={1}>
                  {item.kind === "default" ? item.label : item.model === custom && !models.includes(item.model) ? `Use “${item.model}”` : item.model}
                </Text>
                {item.kind === "model" && item.model === current ? <Check size={18} color={palette.accent} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
