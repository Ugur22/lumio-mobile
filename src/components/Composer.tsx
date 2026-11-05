import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ArrowUp, ImagePlus, Sparkles, Square, X } from "lucide-react-native";
import { useState } from "react";
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
}

export function Composer({ streaming, onSend, onStop, onHeight, canAttach, providerName, canIllustrate }: Props) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [illustrate, setIllustrate] = useState(false);
  const canSend = (text.trim().length > 0 || attachments.length > 0) && preparing === 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), attachments, canIllustrate && illustrate);
    setText("");
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
        <View className="flex-row items-end gap-1 rounded-3xl border border-border bg-surface py-1.5 pl-1.5 pr-1.5">
          <Pressable
            onPress={choose}
            hitSlop={6}
            accessibilityLabel="Add photos"
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <ImagePlus size={22} color={canAttach ? palette.text : palette.muted} />
          </Pressable>
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
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            multiline
            // 16px or more stops iOS from zooming on focus; the cap keeps a long draft from eating the screen.
            className="max-h-40 flex-1 py-2 text-[17px] text-text"
            placeholderTextColor="#8a8070"
          />
          <Pressable
            onPress={streaming ? onStop : submit}
            disabled={!streaming && !canSend}
            className={`h-10 w-10 items-center justify-center rounded-full ${streaming || canSend ? "bg-accent" : "bg-border"}`}
          >
            {streaming ? <Square size={16} color="#fdfbf6" fill="#fdfbf6" /> : <ArrowUp size={20} color="#fdfbf6" />}
          </Pressable>
        </View>
      </View>
    </KeyboardStickyView>
  );
}
