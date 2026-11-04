import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { ImageSource } from "expo-image";

import { ImageLightbox } from "./ImageLightbox";

interface Props {
  source: ImageSource;
  label: string;
  size?: number;
}

// Images are pruned after a while; the server then answers 410 and the chat keeps a placeholder.
export function AttachedImage({ source, label, size = 140 }: Props) {
  const [expired, setExpired] = useState(false);
  const [open, setOpen] = useState(false);

  if (expired) {
    return (
      <View className="items-center justify-center rounded-xl border border-dashed border-border px-2" style={{ width: size, height: size }}>
        <Text className="text-center text-xs text-muted">Image no longer stored</Text>
      </View>
    );
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel={`View ${label.toLowerCase()} full size`}>
        <Image
          source={source}
          contentFit="cover"
          accessibilityLabel={label}
          onError={() => setExpired(true)}
          style={{ width: size, height: size, borderRadius: 12 }}
          className="border border-border"
        />
      </Pressable>
      {open ? <ImageLightbox source={source} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
