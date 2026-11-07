import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { ImageSource } from "expo-image";

import { retryDelay, retryUri } from "@/lib/imageRetry";

import { ImageLightbox } from "./ImageLightbox";

interface Props {
  source: ImageSource;
  label: string;
  size?: number;
}

// Images are pruned after a while; the server then answers 410 and the chat keeps a placeholder. A first failure is not
// proof of that (a live picture may not be fetchable yet), so it is retried a few times before the placeholder shows.
export function AttachedImage({ source, label, size = 140 }: Props) {
  const [expired, setExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  // Retries load a different uri; the lightbox opens the one that worked.
  const shown = useMemo<ImageSource>(
    () => (typeof source === "object" && source && "uri" in source && source.uri ? { ...source, uri: retryUri(source.uri, attempt) } : source),
    [source, attempt],
  );
  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => {
      setFailed(false);
      setAttempt(attempt + 1);
    }, retryDelay(attempt) ?? 0);
    return () => clearTimeout(t);
  }, [failed, attempt]);
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
          source={shown}
          contentFit="cover"
          accessibilityLabel={label}
          onError={() => (retryDelay(attempt) === null ? setExpired(true) : setFailed(true))}
          style={{ width: size, height: size, borderRadius: 12 }}
          className="border border-border"
        />
      </Pressable>
      {open ? <ImageLightbox source={shown} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
