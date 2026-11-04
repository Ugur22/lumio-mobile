import { FlashList } from "@shopify/flash-list";
import { LogOut, Monitor, Moon, Sun, SquarePen } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatSummary } from "@/api/types";
import { useChatList, useDeleteChat, useRenameChat } from "@/hooks/useChats";
import { usePalette } from "@/lib/theme";
import type { ThemeMode } from "@/lib/themeMode";
import { useCurrent } from "@/store/current";
import { useSession } from "@/store/session";
import { useTheme } from "@/store/theme";

import { RenameDialog } from "./RenameDialog";

const MODES: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "system", label: "Match phone", Icon: Monitor },
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
];

// The drawer hands its own navigator to its content; useNavigation here would return the parent stack's.
export function ChatDrawer({ navigation }: { navigation: { closeDrawer: () => void } }) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const { data: chats, isPending, isError, refetch } = useChatList();
  const chatId = useCurrent((s) => s.chatId);
  const open = useCurrent((s) => s.open);
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.set);
  const rename = useRenameChat();
  const remove = useDeleteChat();
  const [renaming, setRenaming] = useState<ChatSummary | null>(null);

  const close = () => navigation.closeDrawer();
  const pick = (id: string | null) => {
    open(id);
    close();
  };

  const actions = (chat: ChatSummary) =>
    Alert.alert(chat.title || "Chat", undefined, [
      { text: "Rename", onPress: () => setRenaming(chat) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert("Delete this chat?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () =>
                remove.mutate(chat.id, {
                  onSuccess: () => {
                    if (useCurrent.getState().chatId === chat.id) open(null);
                  },
                  onError: () => Alert.alert("Could not delete the chat"),
                }),
            },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <View className="flex-1 bg-panel" style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-3">
        <Text className="text-2xl font-semibold text-text">Lumio</Text>
        <Pressable onPress={() => pick(null)} hitSlop={10} accessibilityLabel="New chat">
          <SquarePen size={22} color={palette.text} />
        </Pressable>
      </View>

      {isPending ? (
        <ActivityIndicator className="mt-8" color={palette.muted} />
      ) : isError ? (
        <Pressable onPress={() => refetch()} className="mx-5 mt-6">
          <Text className="text-warn-bar">Could not load your chats. Tap to retry.</Text>
        </Pressable>
      ) : (
        <FlashList
          data={chats}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<Text className="mx-5 mt-6 text-muted">No chats yet.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pick(item.id)}
              onLongPress={() => actions(item)}
              className={`mx-2 rounded-xl px-3 py-3 ${item.id === chatId ? "bg-bubble" : ""}`}
            >
              <Text className="text-[16px] text-text" numberOfLines={1}>
                {item.title || "New chat"}
              </Text>
            </Pressable>
          )}
        />
      )}

      <View className="mx-5 mb-3 flex-row rounded-xl bg-bubble p-1">
        {MODES.map(({ mode, label, Icon }) => (
          <Pressable
            key={mode}
            onPress={() => setThemeMode(mode)}
            accessibilityLabel={`Appearance: ${label}`}
            accessibilityState={{ selected: themeMode === mode }}
            className={`h-9 flex-1 items-center justify-center rounded-lg ${themeMode === mode ? "bg-surface" : ""}`}
          >
            <Icon size={18} color={themeMode === mode ? palette.text : palette.muted} />
          </Pressable>
        ))}
      </View>

      <View className="flex-row items-center justify-between border-t border-border px-5 pt-3">
        <Text className="flex-1 text-muted" numberOfLines={1}>
          {user?.username}
        </Text>
        <Pressable
          onPress={() => void signOut()}
          hitSlop={10}
          accessibilityLabel="Sign out"
          className="flex-row items-center gap-2"
        >
          <LogOut size={18} color={palette.muted} />
          <Text className="text-muted">Sign out</Text>
        </Pressable>
      </View>

      {renaming ? (
        <RenameDialog
          key={renaming.id}
          title={renaming.title}
          onCancel={() => setRenaming(null)}
          onSave={(title) => {
            rename.mutate({ id: renaming.id, title }, { onError: () => Alert.alert("Could not rename the chat") });
            setRenaming(null);
          }}
        />
      ) : null}
    </View>
  );
}
