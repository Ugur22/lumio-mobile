import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { BehaviorBody, Chat } from "@/api/types";

import { chatKey } from "./useChats";

// The behavior route resets any omitted field, so the chat's current values travel with the new provider.
export function useSwitchChatProfile(chat: Chat | undefined) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: BehaviorBody) => api.saveBehavior(chat?.id ?? "", body),
    onSuccess: (saved) => {
      qc.setQueryData(chatKey(saved.id), saved);
      // The server drops the model override with the old provider; re-read so the header shows the new profile's model.
      void qc.invalidateQueries({ queryKey: chatKey(saved.id) });
      void qc.invalidateQueries({ queryKey: ["context", saved.id] });
    },
  });
  return {
    switchTo: (profileId: string) => {
      if (!chat) return;
      save.mutate({
        system_prompt: chat.system_prompt,
        temperature: chat.temperature,
        top_p: chat.top_p,
        frequency_penalty: chat.frequency_penalty,
        max_tokens: chat.max_tokens,
        profile_id: profileId,
      });
    },
    isPending: save.isPending,
    error: save.error,
  };
}
