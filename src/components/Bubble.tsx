import { Image } from "expo-image";
import { memo } from "react";
import { Text, View } from "react-native";

import { imageSource } from "@/api/client";
import type { IllustrationFailure } from "@/api/types";
import type { Row } from "@/lib/rows";

import { AttachedImage } from "./AttachedImage";
import { IllustrationNotes } from "./IllustrationNotes";
import { Reply } from "./Reply";
import { ThinkingStatus } from "./ThinkingStatus";

interface Props {
  row: Row;
  // Stored images are fetched from the chat they belong to.
  chatId: string | null;
  // Pictures that could not be generated for this turn; only the newest reply gets any.
  failures: readonly IllustrationFailure[];
  onHeight: (key: string, height: number) => void;
}

export const Bubble = memo(function Bubble({ row, chatId, failures, onHeight }: Props) {
  const report = (e: { nativeEvent: { layout: { height: number } } }) => onHeight(row.key, e.nativeEvent.layout.height);
  const stored = chatId ? row.images : [];

  if (row.role === "user") {
    return (
      <View className="items-end gap-2 px-4 py-2" onLayout={report}>
        {row.previews.length > 0 || stored.length > 0 ? (
          <View className="flex-row flex-wrap justify-end gap-2">
            {row.previews.map((uri) => (
              <Image key={uri} source={{ uri }} contentFit="cover" style={{ width: 140, height: 140, borderRadius: 12 }} />
            ))}
            {stored.map((image) => (
              <AttachedImage key={image.id} source={imageSource(chatId as string, image.id)} label="Attached image" />
            ))}
          </View>
        ) : null}
        {row.text ? (
          <View className="max-w-[85%] rounded-2xl bg-bubble px-4 py-3">
            <Text className="text-[17px] leading-7 text-text">{row.text}</Text>
          </View>
        ) : null}
      </View>
    );
  }
  if (row.state === "error") {
    return (
      <View className="px-4 py-2" onLayout={report}>
        <Text className={`text-[16px] leading-6 ${row.notice ? "text-muted" : "text-warn-bar"}`}>{row.text || "The reply failed."}</Text>
      </View>
    );
  }
  return (
    <View className="px-4 py-2" onLayout={report}>
      {/* No text yet: the status line stands in for the empty cursor, and gives way the moment text arrives. */}
      {row.state === "thinking" && row.text === "" ? (
        <ThinkingStatus />
      ) : (
        <Reply
          text={row.text}
          streaming={row.state === "thinking" || row.state === "streaming"}
          chatId={chatId}
          images={row.images}
        />
      )}
      <IllustrationNotes failures={failures} />
    </View>
  );
});
