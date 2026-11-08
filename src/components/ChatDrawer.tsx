import { FlashList } from "@shopify/flash-list";
import { LogOut, MessageSquare, Monitor, MoreHorizontal, Moon, SquarePen, Sun } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatSummary } from "@/api/types";
import { useChatList, useDeleteChat, useRenameChat } from "@/hooks/useChats";
import { groupChats } from "@/lib/chatGroups";
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

function nextMode(mode: ThemeMode): ThemeMode {
  return MODES[(MODES.findIndex((m) => m.mode === mode) + 1) % MODES.length].mode;
}

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
  const rows = useMemo(() => groupChats(chats ?? []), [chats]);
  const current = MODES.find((m) => m.mode === themeMode) ?? MODES[0];

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
          data={rows}
          keyExtractor={(r) => r.key}
          getItemType={(r) => r.kind}
          ListEmptyComponent={
            <View className="mt-16 items-center gap-3">
              <MessageSquare size={28} color={palette.muted} />
              <Text className="text-muted">No chats yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return (
                <Text className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted">
                  {item.label}
                </Text>
              );
            }
            const chat = item.chat;
            const active = chat.id === chatId;
            return (
              <Pressable
                onPress={() => pick(chat.id)}
                onLongPress={() => actions(chat)}
                className={`mx-2 flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-bubble ${active ? "bg-bubble" : ""}`}
              >
                <View className={`h-5 w-[3px] rounded-full ${active ? "bg-accent" : "bg-transparent"}`} />
                <MessageSquare size={18} color={active ? palette.accent : palette.muted} />
                <Text className={`flex-1 text-[16px] text-text ${active ? "font-medium" : ""}`} numberOfLines={1}>
                  {chat.title || "New chat"}
                </Text>
                <Pressable onPress={() => actions(chat)} hitSlop={10} accessibilityLabel="Chat options">
                  <MoreHorizontal size={18} color={palette.muted} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <View className="flex-row items-center justify-between border-t border-border px-5 pt-3">
        <View className="flex-1 flex-row items-center gap-3">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-accent">
            <Text className="text-sm font-semibold uppercase text-on-accent">{user?.username?.[0] ?? "?"}</Text>
          </View>
          <Text className="flex-1 text-text" numberOfLines={1}>
            {user?.username}
          </Text>
        </View>
        <View className="flex-row items-center gap-5">
          <Pressable
            onPress={() => setThemeMode(nextMode(themeMode))}
            hitSlop={10}
            accessibilityLabel={`Appearance: ${current.label}. Tap to change`}
          >
            <current.Icon size={20} color={palette.muted} />
          </Pressable>
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
