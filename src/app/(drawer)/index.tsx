import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { DrawerActions } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { Menu, SquarePen } from "lucide-react-native";
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
// From expo-router, not @react-navigation/drawer: expo-router bundles its own copy with its own contexts.
import { useDrawerProgress, useDrawerStatus } from "expo-router/drawer";
import * as Haptics from "expo-haptics";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  type ScrollViewProps,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  KeyboardChatScrollView,
  type KeyboardChatScrollViewRef,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatModelBody, IllustrationFailure } from "@/api/types";
import { Bubble } from "@/components/Bubble";
import { AddProviderSheet } from "@/components/AddProviderSheet";
import { Composer } from "@/components/Composer";
import { EmptyProviders } from "@/components/EmptyProviders";
import { FlashNotice } from "@/components/FlashNotice";
import { JumpToLatest } from "@/components/JumpToLatest";
import { ProviderSwitcher } from "@/components/ProviderSwitcher";
import { WebSetupSheet } from "@/components/WebSetupSheet";
import { useChat } from "@/hooks/useChats";
import { useProfiles } from "@/hooks/useProfiles";
import { useStreamingSend } from "@/hooks/useStreamingSend";
import { useTrial } from "@/hooks/useTrial";
import type { Attachment } from "@/lib/images";
import { blankSpaceFor } from "@/lib/blankSpace";
import { emptyKind } from "@/lib/emptyProviders";
import { jumpVisible } from "@/lib/jump";
import { effectiveProfile } from "@/lib/providers";
import { activePending, buildRows, nextTurnKeys } from "@/lib/rows";
import { usePalette } from "@/lib/theme";
import { bannerText, isManaged, sendBlocked, trialBanner } from "@/lib/trial";
import { useCurrent } from "@/store/current";
import { useSheets } from "@/store/sheets";
import { useStream } from "@/store/stream";

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
  const drawerProgress = useDrawerProgress();
  const drawerStatus = useDrawerStatus();
  const seenStatus = useRef(drawerStatus);
  useEffect(() => {
    if (seenStatus.current === drawerStatus) return;
    seenStatus.current = drawerStatus;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [drawerStatus]);
  // The chat shrinks and rounds as the drawer opens; the dim is drawn inside it so the rounded corners clip it.
  const sceneStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(drawerProgress.value, [0, 1], [0, 28], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(drawerProgress.value, [0, 1], [1, 0.94], Extrapolation.CLAMP) }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: drawerProgress.value * 0.2 }));
  const chatId = useCurrent((s) => s.chatId);
  const epoch = useCurrent((s) => s.epoch);
  const { data: chat, isError: loadFailed, refetch } = useChat(chatId);
  const storedPending = useStream((s) => s.pending);
  const failures = useStream((s) => s.failures);
  const failuresChatId = useStream((s) => s.failuresChatId);
  // A turn belongs to the chat it was sent in; opening another chat must not show it there.
  const pending = activePending(chat?.messages, storedPending && storedPending.chatId === chatId ? storedPending : null);
  const { send: sendMessage, stop } = useStreamingSend({
    onTrialRefused: (failure) => failure.kind === "ended" && useSheets.getState().setProviders(true),
  });
  const { data: profiles } = useProfiles();
  const { data: trial, isPending: trialPending } = useTrial();
  const activeProfile = effectiveProfile(profiles, chatId ? chat?.profile_id : null).profile;
  const managed = isManaged(activeProfile);
  const empty = emptyKind(profiles, trial, !trialPending);
  const providersOpen = useSheets((s) => s.providers);
  // With nothing to switch to, "open providers" (the trial chip, a notice) means adding one.
  useEffect(() => {
    if (!providersOpen || !profiles || activeProfile) return;
    useSheets.getState().setProviders(false);
    useSheets.getState().setAddProvider(true);
  }, [providersOpen, profiles, activeProfile]);
  const banner = trialBanner(trial);
  const streaming = pending?.status === "thinking" || pending?.status === "streaming";

  const rows = useMemo(() => buildRows(chat?.messages, pending), [chat?.messages, pending]);
  const showEmpty = rows.length === 0 && empty !== null;

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
  // The turn was saved (pending cleared); its rows have not reported their final height yet.
  const turnSaved = useRef(false);
  // The epoch whose opening scroll to the end is done (or not wanted, because the user already sent something).
  const scrolledEpoch = useRef(-1);

  const onItemHeight = useCallback(
    (key: string, height: number) => {
      heights.current[key] = height;
      const t = turn.current;
      if (!t || (key !== t.userKey && key !== t.replyKey)) return;
      const userHeight = heights.current[t.userKey];
      const replyHeight = heights.current[t.replyKey];
      if (turnSaved.current) {
        // First layout of the saved rows: these are the final heights. Only the reply's own measure ends the turn,
        // so a late pass cannot inflate the space again.
        blankSpace.set(blankSpaceFor(viewportHeight.current, userHeight, replyHeight));
        if (key === t.replyKey) {
          turn.current = null;
          turnSaved.current = false;
        }
        return;
      }
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

  // When the turn is saved, `pending` clears and the reply may have grown (pictures). The saved rows have not laid out
  // yet at this point, so the heights are still the live ones: keep the turn until the reply row reports again
  // (onItemHeight finalizes), rather than locking in stale numbers.
  const turnSeen = useRef(false);
  useEffect(() => {
    if (pending) {
      turnSeen.current = true;
      return;
    }
    if (!turn.current || !turnSeen.current) return;
    turnSeen.current = false;
    turnSaved.current = true;
    pendingScroll.current = false;
  }, [pending]);

  // A turn whose rows are gone (stopped before anything streamed, a lost reply) must not leave its space behind.
  useEffect(() => {
    const t = turn.current;
    if (!t || pending || rows.some((r) => r.key === t.replyKey)) return;
    delete heights.current[t.userKey];
    delete heights.current[t.replyKey];
    turn.current = null;
    turnSaved.current = false;
    turnSeen.current = false;
    pendingScroll.current = false;
    blankSpace.set(0);
  }, [rows, pending, blankSpace]);

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
      turnSeen.current = false;
      turnSaved.current = false;
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

  // The arrow depends on three numbers that change independently: the scroll position, the content height (it grows
  // under a reader who has not scrolled while the reply streams) and the viewport. Each source updates its own ref and
  // all of them recompute. Content height excludes the blank space, which is an inset.
  const scrollMetrics = useRef({ offset: 0, content: 0, viewport: 0 });
  const refreshJump = useCallback(() => {
    const m = scrollMetrics.current;
    setShowJump(jumpVisible(m.content, m.offset, m.viewport));
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      scrollMetrics.current = { offset: contentOffset.y, content: contentSize.height, viewport: layoutMeasurement.height };
      refreshJump();
    },
    [refreshJump],
  );

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      scrollMetrics.current.content = h;
      refreshJump();
    },
    [refreshJump],
  );

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToIndex({ index: rows.length - 1, animated: true, viewPosition: 1 });
  }, [rows.length]);

  const openDrawer = () => navigation.dispatch(DrawerActions.openDrawer());

  return (
    <Animated.View className="flex-1 bg-bg" style={[{ paddingTop: insets.top, overflow: "hidden" }, sceneStyle]}>
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

      <FlashNotice />

      <View className="flex-1" onLayout={(e) => {
          viewportHeight.current = e.nativeEvent.layout.height;
          scrollMetrics.current.viewport = e.nativeEvent.layout.height;
          refreshJump();
        }}
      >
        {loadFailed ? (
          <Pressable onPress={() => refetch()} className="mx-6 mt-10">
            <Text className="text-center text-warn-bar">Could not load this chat. Tap to retry.</Text>
          </Pressable>
        ) : showEmpty && empty ? (
          <EmptyProviders kind={empty} />
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
              onContentSizeChange={onContentSizeChange}
              scrollEventThrottle={16}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              // A short chat starts at the top, like ChatGPT; a long one is scrolled to its end when it opens (effect above).
              // No autoscrollToBottomThreshold either: the list must not follow the reply by itself.
              maintainVisibleContentPosition={{}}
            />
          </BlankSpaceContext.Provider>
        )}
      </View>

      <KeyboardStickyView
        pointerEvents="box-none"
        offset={{ closed: 0, opened: insets.bottom }}
        style={{ position: "absolute", left: 0, right: 0, bottom: composerHeight + 12, alignItems: "center" }}
      >
        <JumpToLatest visible={showJump} onPress={jumpToLatest} />
      </KeyboardStickyView>

      {showEmpty ? null : (
        <Composer
          streaming={streaming}
          onSend={onSend}
          onStop={stop}
          onHeight={setComposerHeight}
          canAttach={activeProfile?.vision ?? false}
          // The trial's provider takes no images, and illustrations are not part of it.
          canIllustrate={!managed && Boolean(activeProfile?.image_model)}
          managed={managed}
          trialText={managed && banner ? bannerText(banner) : null}
          blocked={sendBlocked(trial, activeProfile) || empty !== null}
          onOpenProviders={() => useSheets.getState().setProviders(true)}
          providerName={activeProfile?.name ?? null}
        />
      )}
      <AddProviderSheet />
      <WebSetupSheet />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, dimStyle]} />
    </Animated.View>
  );
}
