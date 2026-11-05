import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { IllustrationFailure } from "@/api/types";
import { describeIllustrationFailure } from "@/lib/illustrationError";

function Note({ failure }: { failure: IllustrationFailure }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const { headline, providerSays } = describeIllustrationFailure(failure);
  return (
    <View className="border-l-2 border-warn-bar pl-3">
      <Text className="text-[13px] leading-5 text-muted">{headline}</Text>
      {providerSays ? <Text className="mt-0.5 text-[13px] leading-5 text-muted">Provider says: {providerSays}</Text> : null}
      {failure.prompt ? (
        <Pressable onPress={() => setShowPrompt((v) => !v)} hitSlop={6}>
          <Text className="text-[13px] text-accent">{showPrompt ? "Hide prompt" : "Prompt"}</Text>
          {showPrompt ? <Text className="mt-0.5 text-[13px] italic leading-5 text-muted">{failure.prompt}</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

// Everything here is untrusted (it can echo model text or provider errors), so it is only ever rendered as plain text.
export function IllustrationNotes({ failures }: { failures: readonly IllustrationFailure[] }) {
  if (failures.length === 0) return null;
  return (
    <View className="mt-3 gap-2">
      {failures.map((f, i) => (
        <Note key={i} failure={f} />
      ))}
    </View>
  );
}
