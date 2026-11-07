import { useCallback, useEffect, useRef } from "react";
import type { Chat, ChatModelBody, ImageUpload } from "@/api/types";
import { api } from "@/api/client";
import { trialFailure, type TrialFailure } from "@/lib/trial";
import { useStream } from "@/store/stream";

import { ReplyStopped, useSendMessage } from "./useChats";

// A picked photo: what is uploaded, and the local file shown as its thumbnail.
export interface Attachment {
  upload: ImageUpload;
  preview: string;
}

// How long Stop waits for the server's closing frame before dropping the connection itself.
const STOP_GRACE_MS = 8000;

interface Options {
  // The trial refused the send (used up, or full for today); the screen opens the providers sheet when it ended.
  onTrialRefused?: (failure: TrialFailure) => void;
}

export function useStreamingSend({ onTrialRefused }: Options = {}) {
  const refused = useRef(onTrialRefused);
  useEffect(() => {
    refused.current = onTrialRefused;
  });
  const { mutate, isPending } = useSendMessage();
  const abort = useRef<AbortController | null>(null);
  const streamed = useRef("");
  const activeChat = useRef<string | null>(null);
  const stopped = useRef(false);
  const detachTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef(0);

  const endStream = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    abort.current = null;
    if (detachTimer.current) clearTimeout(detachTimer.current);
    detachTimer.current = null;
  }, []);

  // Deltas arrive faster than frames; one store update per frame keeps markdown parsing cheap.
  const onDelta = useCallback((text: string) => {
    streamed.current += text;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      useStream.getState().setReply(streamed.current);
    });
  }, []);

  const send = useCallback(
    (chatId: string | null, content: string, attachments: Attachment[], web: boolean, illustrate: boolean, onSaved: (chat: Chat) => void, model?: ChatModelBody) => {
      const controller = new AbortController();
      abort.current = controller;
      streamed.current = "";
      activeChat.current = chatId;
      stopped.current = false;
      useStream.getState().start(
        chatId,
        content,
        attachments.map((a) => a.preview),
        illustrate,
      );
      mutate(
        {
          chatId,
          content,
          images: attachments.map((a) => a.upload),
          web,
          illustrate,
          model,
          signal: controller.signal,
          onDelta,
          onSources: useStream.getState().setSources,
          onIllustrationFailed: useStream.getState().addFailure,
          onImage: useStream.getState().addImage,
          onReasoning: useStream.getState().markReasoning,
          stopped: () => stopped.current,
          onChatId: (id) => {
            activeChat.current = id;
            useStream.getState().setCreatedChatId(id);
          },
        },
        {
          onSuccess: (saved) => {
            endStream();
            useStream.getState().settleFailures(saved.id);
            useStream.getState().clear();
            onSaved(saved);
          },
          onError: (err) => {
            endStream();
            // A user-initiated stop that left nothing to show just ends the turn; no error flash.
            if (err instanceof ReplyStopped) {
              useStream.getState().clear();
              return;
            }
            const trial = trialFailure(err);
            if (trial) {
              useStream.getState().fail(trial.message, true);
              refused.current?.(trial);
            } else useStream.getState().fail(err.message);
          },
        },
      );
    },
    [mutate, onDelta, endStream],
  );

  // The reply runs on the server and survives a dropped connection, so Stop has to tell the server. It then ends the
  // open stream with `done` (partial saved) or `error`; the stream is left open to receive that frame, so the saved
  // chat arrives the normal way. The local abort is only the fallback if the cancel fails or the frame never comes.
  const stop = useCallback(() => {
    const controller = abort.current;
    const id = activeChat.current;
    if (!controller || stopped.current) return;
    stopped.current = true;
    const detach = () => controller.abort();
    if (!id) return detach();
    void api.cancelMessage(id).then(() => {
      if (abort.current === controller) detachTimer.current = setTimeout(detach, STOP_GRACE_MS);
    }, detach);
  }, []);

  // Leaving the app (sign-out, a lost session) ends a stream in flight instead of letting it write into a store
  // that now belongs to the next screen.
  useEffect(
    () => () => {
      abort.current?.abort();
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  return { send, stop, isPending };
}
