import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ArrowUp, ImagePlus, Sparkles, Square, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardController, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Attachment, MAX_IMAGES, prepareImage } from "@/lib/images";
import { usePalette } from "@/lib/theme";

interface Props {
  streaming: boolean;
  onSend: (text: string, attachments: Attachment[], illustrate: boolean) => void;
  onStop: () => void;
  onHeight: (height: number) => void;
  // Whether the chat's provider reads images, and its name for the explanation when it does not.
  canAttach: boolean;
  providerName: string | null;
  // Whether the provider has an image model, which is what makes the Illustrate toggle appear.
  canIllustrate: boolean;
  // The trial's provider: no photos, no illustrations.
  managed: boolean;
  // The trial chip text ("3 of 5 free messages left"), and whether sending would only bounce off a 402.
  trialText: string | null;
  blocked: boolean;
  onOpenProviders: () => void;
}

export function Composer({ streaming, onSend, onStop, onHeight, canAttach, providerName, canIllustrate, managed, trialText, blocked, onOpenProviders }: Props) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [illustrate, setIllustrate] = useState(false);
  // Once the draft runs to a second line the text moves above the buttons, as in ChatGPT, and stays there until it is
  // empty again: judging it by width would flip back and forth, since the wider layout can fit the same text on one line.
  const [expanded, setExpanded] = useState(false);
  const oneLine = useRef(0);
  const canSend = (text.trim().length > 0 || attachments.length > 0) && preparing === 0 && !blocked;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), attachments, canIllustrate && illustrate);
    setText("");
    setExpanded(false);
    setAttachments([]);
    // The reply is for reading: the keyboard goes away, as in ChatGPT, and the answer gets the whole screen.
    void KeyboardController.dismiss();
  };

  const addAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setPreparing((n) => n + assets.length);
    for (const asset of assets) {
      try {
        const attachment = await prepareImage(asset);
        setAttachments((list) => [...list, attachment]);
      } catch {
        Alert.alert("Could not read that image");
      } finally {
        setPreparing((n) => n - 1);
      }
    }
  };

  const room = MAX_IMAGES - attachments.length - preparing;
  // Where the text starts when the buttons share its row: past the 40px buttons (4px apart) and the 6px edge.
  const leftInset = 6 + ((managed ? 0 : 1) + (canIllustrate ? 1 : 0)) * 44;

  const fromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      quality: 1,
    });
    if (!result.canceled) await addAssets(result.assets);
  };

  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Camera access is off", "Allow the camera for this app in Settings to take photos.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    if (!result.canceled) await addAssets(result.assets);
  };

  const choose = () => {
    if (!canAttach) return Alert.alert(`${providerName ?? "This provider"} can't read images`);
    if (room <= 0) return Alert.alert(`You can attach up to ${MAX_IMAGES} images per message.`);
    Alert.alert("Add photos", undefined, [
      { text: "Photo library", onPress: () => void fromLibrary() },
      { text: "Take photo", onPress: () => void fromCamera() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    // Closed, the composer sits above the home indicator; open, the keyboard covers that inset, so the sticky view
    // moves it back down by the same amount instead of leaving a gap.
    <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
      <View
        className="border-t border-border bg-bg px-3 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      >
        {trialText ? (
          <Pressable
            onPress={onOpenProviders}
            accessibilityLabel={`${trialText}. Open providers`}
            className="mb-2 flex-row items-center self-start rounded-full bg-bubble px-2.5 py-1"
          >
            <Text className={`text-[13px] ${blocked ? "text-warn-bar" : "text-muted"}`}>{trialText}</Text>
            {blocked ? <Text className="text-[13px] text-accent">{" · Providers"}</Text> : null}
          </Pressable>
        ) : null}
        {canIllustrate && illustrate ? (
          <Pressable
            onPress={() => setIllustrate(false)}
            hitSlop={6}
            accessibilityLabel="Turn off illustrate"
            className="mb-2 flex-row items-center gap-1.5 self-start rounded-full bg-bubble py-1 pl-2.5 pr-2"
          >
            <Sparkles size={14} color={palette.accent} />
            <Text className="text-[13px] text-text">Illustrate on</Text>
            <X size={14} color={palette.muted} />
          </Pressable>
        ) : null}
        {attachments.length > 0 || preparing > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerClassName="gap-2 pt-2">
            {attachments.map((a) => (
              <View key={a.id}>
                <Image source={{ uri: a.preview }} style={{ width: 64, height: 64, borderRadius: 10 }} contentFit="cover" />
                <Pressable
                  onPress={() => setAttachments((list) => list.filter((x) => x.id !== a.id))}
                  hitSlop={8}
                  accessibilityLabel="Remove image"
                  className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-text"
                >
                  <X size={12} color={palette.bg} />
                </Pressable>
              </View>
            ))}
            {Array.from({ length: preparing }, (_, i) => (
              <View key={`p${i}`} className="h-16 w-16 items-center justify-center rounded-xl bg-bubble">
                <ActivityIndicator color={palette.muted} />
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View className="rounded-3xl border border-border bg-surface">
          {/* One input in a fixed place so it keeps focus when the layout changes: the buttons sit on the bottom edge,
              beside the text while it is one line and under it once it is not. */}
          <TextInput
            value={text}
            onChangeText={(value) => {
              setText(value);
              if (!value) setExpanded(false);
              else if (value.includes("\n")) setExpanded(true);
            }}
            onContentSizeChange={(e) => {
              const height = e.nativeEvent.contentSize.height;
              if (!text) oneLine.current = height;
              else if (oneLine.current > 0 && height > oneLine.current * 1.5) setExpanded(true);
            }}
            placeholder={blocked ? "Free trial ended" : "Message"}
            multiline
            // 16px or more stops iOS from zooming on focus; the cap keeps a long draft from eating the screen.
            // 22px line + 15px padding above and below is the 52px of one row of 40px buttons. iOS ignores line height
            // for the first line unless it is set explicitly, which is what sat the text above the icons.
            className="text-[17px] leading-[22px] text-text"
            style={
              expanded
                ? { minHeight: 52, maxHeight: 212, paddingTop: 15, paddingBottom: 52, paddingHorizontal: 16 }
                : { minHeight: 52, maxHeight: 160, paddingVertical: 15, paddingLeft: leftInset, paddingRight: 52 }
            }
            placeholderTextColor="#8a8070"
          />
          <View className="absolute bottom-1.5 left-1.5 flex-row gap-1">
            {managed ? null : (
              <Pressable
                onPress={choose}
                hitSlop={6}
                accessibilityLabel="Add photos"
                className="h-10 w-10 items-center justify-center rounded-full"
              >
                <ImagePlus size={22} color={canAttach ? palette.text : palette.muted} />
              </Pressable>
            )}
            {canIllustrate ? (
              <Pressable
                onPress={() => setIllustrate((on) => !on)}
                hitSlop={6}
                accessibilityLabel={illustrate ? "Turn off illustrate" : "Turn on illustrate"}
                accessibilityState={{ selected: illustrate }}
                // Always the same size: the state shows in the fill and in the chip above, so the input keeps its room.
                className={`h-10 w-10 items-center justify-center rounded-full ${illustrate ? "bg-accent" : ""}`}
              >
                <Sparkles size={20} color={illustrate ? "#fdfbf6" : palette.text} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={streaming ? onStop : submit}
            disabled={!streaming && !canSend}
            accessibilityLabel={streaming ? "Stop" : "Send"}
            className={`absolute bottom-1.5 right-1.5 h-10 w-10 items-center justify-center rounded-full ${streaming || canSend ? "bg-accent" : "bg-border"}`}
          >
            {streaming ? <Square size={16} color="#fdfbf6" fill="#fdfbf6" /> : <ArrowUp size={20} color="#fdfbf6" />}
          </Pressable>
        </View>
      </View>
    </KeyboardStickyView>
  );
}
