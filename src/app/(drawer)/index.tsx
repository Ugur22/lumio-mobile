import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { DrawerActions } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { ArrowDown, Menu, SquarePen } from "lucide-react-native";
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, type ScrollViewProps, Text, View } from "react-native";
import {
  KeyboardChatScrollView,
  type KeyboardChatScrollViewRef,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatModelBody, IllustrationFailure } from "@/api/types";
import { Bubble } from "@/components/Bubble";
import { Composer } from "@/components/Composer";
import { ProviderSwitcher } from "@/components/ProviderSwitcher";
import { useChat } from "@/hooks/useChats";
import { useProfiles } from "@/hooks/useProfiles";
import { useStreamingSend } from "@/hooks/useStreamingSend";
import type { Attachment } from "@/lib/images";
import { effectiveProfile } from "@/lib/providers";
import { buildRows, nextTurnKeys } from "@/lib/rows";
import { usePalette } from "@/lib/theme";
import { useCurrent } from "@/store/current";
import { useStream } from "@/store/stream";

// How far from the end of the real content (in px) the "jump to latest" arrow starts to show.
const JUMP_DISTANCE = 160;

const NO_FAILURES: IllustrationFailure[] = [];

const BlankSpaceContext = createContext<SharedValue<number> | undefined>(undefined);

// FlashList only forwards ScrollView props, so the lift mode is fixed here and the blank space comes by context.
// "persistent" is documented as the Claude app's behaviour and "whenAtEnd" as ChatGPT's.
const ChatScrollView = forwardRef<KeyboardChatScrollViewRef, ScrollViewProps>(function ChatScrollView(props, ref) {
  const blankSpace = useContext(BlankSpaceContext);
  return <KeyboardChatScrollView ref={ref} keyboardLiftBehavior="persistent" blankSpace={blankSpace} {...props} />;
});

export default function Chat() {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const navigation = useNavigation();
  const chatId = useCurrent((s) => s.chatId);
  const epoch = useCurrent((s) => s.epoch);
  const { data: chat, isError: loadFailed, refetch } = useChat(chatId);
  const storedPending = useStream((s) => s.pending);
  const failures = useStream((s) => s.failures);
  const failuresChatId = useStream((s) => s.failuresChatId);
  // A turn belongs to the chat it was sent in; opening another chat must not show it there.
  const pending = storedPending && storedPending.chatId === chatId ? storedPending : null;
  const { send: sendMessage, stop } = useStreamingSend();
  const { data: profiles } = useProfiles();
  const activeProfile = effectiveProfile(profiles, chatId ? chat?.profile_id : null).profile;
  const streaming = pending?.status === "thinking" || pending?.status === "streaming";

  const rows = useMemo(() => buildRows(chat?.messages, pending), [chat?.messages, pending]);

  const listRef = useRef<FlashListRef<(typeof rows)[number]>>(null);
  const [showJump, setShowJump] = useState(false);
  // A blank chat's unsent model pick; it is sent with the first message and dropped when another chat opens.
  const [modelPick, setModelPick] = useState<{ epoch: number; model: ChatModelBody } | null>(null);
  const pendingModel = modelPick?.epoch === epoch ? modelPick.model : null;
  const [composerHeight, setComposerHeight] = useState(0);

  // The blank space under the newest turn lets the sent message sit at the top of the screen while the reply streams
  // in below it, instead of the list chasing the reply. It shrinks as the turn fills the screen.
  const blankSpace = useSharedValue(0);
  const viewportHeight = useRef(0);
  const heights = useRef<Record<string, number>>({});
  const turn = useRef<{ userKey: string; replyKey: string } | null>(null);
  const pendingScroll = useRef(false);
  // The epoch whose opening scroll to the end is done (or not wanted, because the user already sent something).
  const scrolledEpoch = useRef(-1);

  const onItemHeight = useCallback(
    (key: string, height: number) => {
      heights.current[key] = height;
      const t = turn.current;
      if (!t || (key !== t.userKey && key !== t.replyKey)) return;
      const userHeight = heights.current[t.userKey];
      const replyHeight = heights.current[t.replyKey];
      blankSpace.set(Math.max(0, viewportHeight.current - (userHeight ?? 0) - (replyHeight ?? 0)));
      if (!pendingScroll.current || userHeight === undefined || replyHeight === undefined) return;
      pendingScroll.current = false;
      // scrollToIndex stops at the end of the list's own content, short of the blank space, so the message could not
      // reach the top. The scroll view's own end includes that space: with it sized to what is left of the screen after
      // this turn, the end puts the sent message at the top. Two frames let the new inset apply first.
      requestAnimationFrame(() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true })));
    },
    [blankSpace],
  );

  // Notes about pictures that failed belong to the turn just sent; opening another chat ends them.
  useEffect(() => useStream.getState().clearFailures(), [epoch]);

  // A chat opened from the drawer starts at its latest message, once its messages have arrived.
  useEffect(() => {
    if (scrolledEpoch.current === epoch || !chat || chat.messages.length === 0) return;
    scrolledEpoch.current = epoch;
    heights.current = {};
    blankSpace.set(0);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [chat, epoch, blankSpace]);

  const onSend = useCallback(
    (text: string, attachments: Attachment[], illustrate: boolean) => {
      const sentFrom = chatId;
      scrolledEpoch.current = epoch;
      const { userKey, replyKey } = nextTurnKeys(rows.length);
      turn.current = { userKey, replyKey };
      pendingScroll.current = true;
      // Room to scroll the new message to the top before its real height is measured.
      blankSpace.set(viewportHeight.current);
      sendMessage(
        sentFrom,
        text,
        attachments,
        false,
        illustrate,
        (saved) => {
        // Adopt the new chat's id only if the user is still on the screen it was sent from.
        if (useCurrent.getState().chatId === sentFrom) useCurrent.getState().adopt(saved.id);
        },
        sentFrom === null ? (pendingModel ?? undefined) : undefined,
      );
    },
    [chatId, epoch, rows.length, blankSpace, sendMessage, pendingModel],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    setShowJump(contentSize.height - (contentOffset.y + layoutMeasurement.height) > JUMP_DISTANCE);
  }, []);

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToIndex({ index: rows.length - 1, animated: true, viewPosition: 1 });
  }, [rows.length]);

  const openDrawer = () => navigation.dispatch(DrawerActions.openDrawer());

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="min-h-14 flex-row items-center justify-between px-4 py-1">
        <Pressable onPress={openDrawer} hitSlop={12} accessibilityLabel="Chats">
          <Menu size={24} color={palette.text} />
        </Pressable>
        <View className="mx-3 min-w-0 flex-1 items-center">
          <Text className="text-[16px] font-medium text-text" numberOfLines={1}>
            {chat?.title || "New chat"}
          </Text>
          <ProviderSwitcher
            chatId={chatId}
            pendingModel={pendingModel}
            onPendingModel={(model) => setModelPick(model ? { epoch, model } : null)}
            disabled={streaming}
          />
        </View>
        <Pressable onPress={() => useCurrent.getState().open(null)} hitSlop={12} accessibilityLabel="New chat">
          <SquarePen size={22} color={palette.text} />
        </Pressable>
      </View>

      <View className="flex-1" onLayout={(e) => (viewportHeight.current = e.nativeEvent.layout.height)}>
        {loadFailed ? (
          <Pressable onPress={() => refetch()} className="mx-6 mt-10">
            <Text className="text-center text-warn-bar">Could not load this chat. Tap to retry.</Text>
          </Pressable>
        ) : rows.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-2xl text-muted">{chatId ? "" : "What are we writing today?"}</Text>
          </View>
        ) : (
          <BlankSpaceContext.Provider value={blankSpace}>
            <FlashList
              key={epoch}
              ref={listRef}
              data={rows}
              extraData={[pending?.status, failures]}
              keyExtractor={(r) => r.key}
              renderItem={({ item, index }) => (
                <Bubble
                  row={item}
                  chatId={chatId}
                  failures={index === rows.length - 1 && failuresChatId === chatId ? failures : NO_FAILURES}
                  onHeight={onItemHeight}
                />
              )}
              renderScrollComponent={ChatScrollView}
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              // No autoscrollToBottomThreshold: the list must not follow the reply by itself.
              maintainVisibleContentPosition={{ startRenderingFromBottom: true }}
            />
          </BlankSpaceContext.Provider>
        )}
      </View>

      {showJump ? (
        <KeyboardStickyView
          pointerEvents="box-none"
          offset={{ closed: 0, opened: insets.bottom }}
          style={{ position: "absolute", left: 0, right: 0, bottom: composerHeight + 12, alignItems: "center" }}
        >
          <Pressable
            onPress={jumpToLatest}
            accessibilityLabel="Scroll to latest"
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
          >
            <ArrowDown size={20} color={palette.text} />
          </Pressable>
        </KeyboardStickyView>
      ) : null}

      <Composer
        streaming={streaming}
        onSend={onSend}
        onStop={stop}
        onHeight={setComposerHeight}
        canAttach={activeProfile?.vision ?? false}
        canIllustrate={Boolean(activeProfile?.image_model)}
        providerName={activeProfile?.name ?? null}
      />
    </View>
  );
}
