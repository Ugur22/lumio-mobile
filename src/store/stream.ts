import { create } from "zustand";
import type { IllustrationFailure, SourceRef } from "@/api/types";
import type { Illustration } from "@/lib/illustrations";

// A discriminated union, so consumers can match it exhaustively. "Succeeded" is `pending: null`:
// the saved chat then supplies the reply.
// `images` are the local file URIs of the thumbnails.
export type Pending = { text: string; chatId: string | null; images: string[] } & (
  | { status: "thinking" }
  | { status: "streaming"; reply: string }
  // `notice`: the trial refused the send, which is said calmly rather than as a failure.
  | { status: "error"; error: string; notice?: boolean }
);

interface StreamState {
  pending: Pending | null;
  // What the server read for the turn in flight; the saved message takes over once it is done.
  sources: SourceRef[];
  notes: string[];
  query: string | null;
  // Failed illustrations of the turn just sent. They outlive `clear` (the saved chat replaces the
  // pending turn) and go away on the next send or when the chat changes. `failuresChatId` is null
  // until the chat is known.
  failures: IllustrationFailure[];
  // Pictures stored for the turn in flight, in arrival order. The saved message replaces them.
  images: Illustration[];
  // The chat a first message created, which the pictures belong to while `pending.chatId` is still null.
  createdChatId: string | null;
  addImage: (image: Illustration) => void;
  setCreatedChatId: (id: string) => void;
  failuresChatId: string | null;
  addFailure: (failure: IllustrationFailure) => void;
  settleFailures: (chatId: string) => void;
  clearFailures: () => void;
  start: (chatId: string | null, text: string, images?: string[]) => void;
  setReply: (reply: string) => void;
  setSources: (sources: SourceRef[], notes: string[], query?: string | null) => void;
  fail: (error: string, notice?: boolean) => void;
  clear: () => void;
}

// Lives outside the screens so per-frame reply updates re-render only the components that select `pending`.
export const useStream = create<StreamState>((set) => ({
  pending: null,
  sources: [],
  notes: [],
  query: null,
  failures: [],
  images: [],
  createdChatId: null,
  addImage: (image) =>
    set((s) => {
      // Ids come from the stream: only a plain 32-hex id may ever become part of an image URL.
      if (!s.pending || !/^[0-9a-f]{32}$/.test(image.id) || s.images.some((i) => i.id === image.id)) return s;
      return { images: [...s.images, { id: image.id, prompt: image.prompt }] };
    }),
  setCreatedChatId: (id) => set((s) => (s.pending ? { createdChatId: id } : s)),
  failuresChatId: null,
  addFailure: (failure) => set((s) => (s.pending ? { failures: [...s.failures, failure] } : s)),
  settleFailures: (chatId) => set((s) => (s.failures.length ? { failuresChatId: chatId } : s)),
  clearFailures: () => set({ failures: [], failuresChatId: null }),
  start: (chatId, text, images = []) => {
    set({
      pending: { text, chatId, images, status: "thinking" },
      sources: [],
      notes: [],
      query: null,
      failures: [],
      images: [],
      createdChatId: null,
      failuresChatId: chatId,
    });
  },
  setSources: (sources, notes, query = null) => set((s) => (s.pending ? { sources, notes, query } : s)),
  // A failed turn keeps showing its error; a late frame must not turn it back into a reply.
  setReply: (reply) =>
    set((s) =>
      s.pending && s.pending.status !== "error"
        ? { pending: { ...s.pending, status: "streaming", reply } }
        : s,
    ),
  fail: (error, notice = false) =>
    set((s) =>
      s.pending
        ? {
            pending: {
              text: s.pending.text,
              chatId: s.pending.chatId,
              images: s.pending.images,
              status: "error",
              error,
              ...(notice && { notice }),
            },
          }
        : s,
    ),
  clear: () => {
    set({ pending: null, sources: [], notes: [], query: null, images: [], createdChatId: null });
  },
}));
