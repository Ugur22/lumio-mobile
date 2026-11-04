import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ImageSource } from "expo-image";

// Full-screen view with pinch-to-zoom on iOS. A tap outside the picture, or the close button, dismisses it.
export function ImageLightbox({ source, label, onClose }: { source: ImageSource; label: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black">
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width, height, justifyContent: "center" }}
        >
          <Pressable onPress={onClose} accessibilityLabel="Close image">
            <Image source={source} contentFit="contain" accessibilityLabel={label} style={{ width, height }} />
          </Pressable>
        </ScrollView>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="Close"
          className="absolute right-4 h-10 w-10 items-center justify-center rounded-full bg-black/60"
          style={{ top: insets.top + 8 }}
        >
          <X size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
