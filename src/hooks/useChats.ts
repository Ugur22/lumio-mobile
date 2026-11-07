import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, HandlerError, ReplyFailed, api, newCursor, type Handlers, type StreamCursor } from "@/api/client";
import { runWithResume, sleepMs } from "@/lib/resume";
import { trialFailure } from "@/lib/trial";
import { profilesKey } from "./useProfiles";
import { trialKey } from "./useTrial";
import type { Chat, ChatModelBody, ContextInfo, DoneChat, IllustrationFailure, ImageUpload, SourceRef } from "@/api/types";

export const chatsKey = ["chats"] as const;
export const chatKey = (id: string) => ["chat", id] as const;
export const contextKey = (id: string) => ["context", id] as const;

export function useChatList() {
  return useQuery({ queryKey: chatsKey, queryFn: api.listChats });
}

export function useChat(id: string | null) {
  return useQuery({
    queryKey: chatKey(id ?? ""),
    queryFn: () => api.getChat(id as string),
    enabled: id !== null,
  });
}

// staleTime 0 so opening a chat re-measures it; the global default would keep the first answer forever.
export function useChatContext(id: string | null) {
  return useQuery({
    queryKey: contextKey(id ?? ""),
    queryFn: () => api.getContext(id as string),
    enabled: id !== null,
    staleTime: 0,
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createChat,
    onSuccess: (chat) => {
      qc.setQueryData(chatKey(chat.id), chat);
      return qc.invalidateQueries({ queryKey: chatsKey });
    },
  });
}

// A model change moves the context window with it, so the meter is re-measured as well.
export function useSetChatModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ChatModelBody }) => api.setChatModel(id, body),
    onSuccess: (chat) => {
      qc.setQueryData(chatKey(chat.id), chat);
      void qc.invalidateQueries({ queryKey: chatKey(chat.id) });
      void qc.invalidateQueries({ queryKey: contextKey(chat.id) });
    },
  });
}

export function useRenameChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.renameChat(id, title),
    onSuccess: (chat) => {
      qc.setQueryData(chatKey(chat.id), chat);
      return qc.invalidateQueries({ queryKey: chatsKey });
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteChat(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: chatKey(id) });
      return qc.invalidateQueries({ queryKey: chatsKey });
    },
  });
}

// `context` comes from the `done` event; the stop path has none and refetches instead.
export type SentChat = Chat & { context?: ContextInfo; trial?: { remaining: number } };

interface SendVars {
  chatId: string | null;
  content: string;
  images: ImageUpload[];
  web: boolean;
  illustrate: boolean;
  model?: ChatModelBody;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onSources: (sources: SourceRef[], notes: string[], query: string | null) => void;
  onIllustrationFailed: (failure: IllustrationFailure) => void;
  onImage: (image: { id: string; prompt: string }) => void;
  // The chat the reply streams into, once it exists (a first message creates it inside the mutation).
  onChatId?: (id: string) => void;
  // True once the user pressed Stop: the server then ends the stream with a terminal frame, which is not a failure.
  stopped?: () => boolean;
}

// The user pressed Stop and nothing had streamed yet, so there is no partial to show. Not a failure to display.
export class ReplyStopped extends Error {
  constructor() {
    super("Stopped");
    this.name = "ReplyStopped";
  }
}

// The reply is gone from the server and not in the chat: nothing was saved, and the user's text is kept to resend.
export class ReplyLost extends Error {
  constructor(sent: boolean) {
    super(sent ? "That reply was lost. Try again." : "Could not reach the server. Try again.");
    this.name = "ReplyLost";
  }
}

// A break worth reconnecting for: the network, a cut stream, or a 5xx/429/408. Not an `error` event, a handler that
// threw, or a refusal (401/404/422...). A refusal of the POST itself (no job yet) is also final.
export function resumable(err: unknown, cursor: StreamCursor, stopped: boolean): boolean {
  if (stopped || err instanceof ReplyFailed || err instanceof HandlerError || err instanceof ReplyLost) return false;
  if (err instanceof ApiError) return cursor.started && (err.status >= 500 || err.status === 429 || err.status === 408);
  return true;
}

// Before the first byte the server may still be preparing the reply (web search...), so no headers have come back and
// the job may not be registered yet. Never re-POST; ask for the job until it appears or the window ends (null).
export const PROBE_WINDOW_MS = 20_000;
export const PROBE_EVERY_MS = 1_000;
export async function probeForJob(id: string, cursor: StreamCursor, handlers: Handlers): Promise<DoneChat | null> {
  const until = Date.now() + PROBE_WINDOW_MS;
  for (;;) {
    const done = await api.resumeMessage(id, cursor.lastId, handlers);
    if (done) return done;
    if (Date.now() >= until) return null;
    await sleepMs(PROBE_EVERY_MS, handlers.signal);
    if (handlers.signal.aborted) throw new DOMException("Aborted", "AbortError");
  }
}

// After Stop the server saves the partial reply on its own schedule, so poll briefly for it.
async function savedAfterStop(id: string, knownCount: number): Promise<Chat> {
  let chat = await api.getChat(id);
  for (let i = 0; i < 10 && chat.messages.length <= knownCount; i++) {
    await new Promise((r) => setTimeout(r, 100));
    chat = await api.getChat(id);
  }
  return chat;
}

// The chat file is created lazily so "New chat" never leaves empty files behind.
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<SentChat, Error, SendVars>({
    mutationFn: async ({ chatId, content, images, web, illustrate, model, signal, onDelta, onSources, onIllustrationFailed, onImage, onChatId, stopped }) => {
      const id = chatId ?? (await api.createChat()).id;
      onChatId?.(id);
      // Chats are created before the first message, so the pick is stored with its own call.
      if (chatId === null && model) {
        try {
          await api.setChatModel(id, model);
        } catch (err) {
          await api.deleteChat(id).catch(() => undefined);
          throw err;
        }
      }
      const knownCount = chatId === null ? 0 : (qc.getQueryData<Chat>(chatKey(id))?.messages.length ?? 0);
      let received = false;
      const cursor = newCursor();
      const handlers = {
        cursor,
        onSources,
        onIllustrationFailed,
        onImage,
        onDelta: (text: string) => {
          received = true;
          onDelta(text);
        },
      };
      try {
        // A break without `done` is not a failure: the reply keeps running on the server, so reconnect after the last
        // event seen. Only a 204 (nothing buffered any more) means the reply is already saved.
        const done = await runWithResume({
          signal,
          progress: () => cursor.lastId,
          retryable: (err) => resumable(err, cursor, stopped?.() ?? false),
          attempt: (n, conn) => {
            if (n === 0) return api.sendMessage(id, content, { ...handlers, images, web, illustrate, signal: conn });
            if (!cursor.started) return probeForJob(id, cursor, { ...handlers, signal: conn });
            return api.resumeMessage(id, cursor.lastId, { ...handlers, signal: conn });
          },
        });
        if (done) return done;
        void qc.invalidateQueries({ queryKey: trialKey });
        // No job on the server. Believe it only if the turn really is in the chat (a restart or an expired job leaves
        // nothing behind, and a stale answer must not look like success).
        const saved = await api.getChat(id);
        if (saved.messages.length < knownCount + 2) throw new ReplyLost(cursor.started);
        return saved;
      } catch (err) {
        // Stopped before any text arrived: nothing was saved, same as a failure.
        const stop = signal.aborted || (stopped?.() ?? false);
        if (stop && received) return await savedAfterStop(id, knownCount);
        // Drop the chat we just created only when nothing can still be written into it: the server refused the message,
        // or the reply failed or is gone. A lost connection or a Stop leaves it, since the job may still be saving.
        const refused = !cursor.started && err instanceof ApiError;
        if (chatId === null && (refused || (!stop && (err instanceof ReplyFailed || err instanceof ReplyLost)))) {
          await api.deleteChat(id).catch(() => undefined);
        }
        throw stop ? new ReplyStopped() : err;
      }
    },
    onSuccess: ({ context, trial, ...chat }) => {
      // A reply the trial paid for moves the count; the last one also ends the trial, which changes what the providers sheet allows.
      if (trial) {
        void qc.invalidateQueries({ queryKey: trialKey });
        void qc.invalidateQueries({ queryKey: profilesKey });
      }
      qc.setQueryData(chatKey(chat.id), chat);
      if (context) qc.setQueryData(contextKey(chat.id), context);
      else void qc.invalidateQueries({ queryKey: contextKey(chat.id) });
      return qc.invalidateQueries({ queryKey: chatsKey });
    },
    onError: (err) => {
      if (trialFailure(err)?.kind === "ended") {
        void qc.invalidateQueries({ queryKey: trialKey });
        void qc.invalidateQueries({ queryKey: profilesKey });
      }
      return qc.invalidateQueries({ queryKey: chatsKey });
    },
  });
}
