import { fetch as streamingFetch } from "expo/fetch";

import { createSseParser } from "@/lib/sse";

import { parseIllustrationFailure } from "./parse";

import type {
  Chat,
  ChatSummary,
  BehaviorBody,
  ChatModelBody,
  ContextInfo,
  DoneChat,
  ImageUpload,
  LoginBody,
  ModelsQuery,
  ModelsResult,
  ProfileList,
  SourceRef,
  TokenLogin,
  UserView,
} from "./types";

interface ValidationIssue {
  msg?: string;
}

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = (detail as ValidationIssue[]).map((d) => d.msg).filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  }
  return detail == null ? fallback : JSON.stringify(detail);
}

// `status` lets callers word 409/422/502 for the action that failed.
export class ApiError extends Error {
  status: number;
  // Seconds from a 429's Retry-After header, when it sent a usable one.
  retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// Where the server is and who we are. The session store sets these; this module stays free of app state.
let baseUrl = "";
let token: string | null = null;
export function configureApi(config: { baseUrl?: string; token?: string | null }) {
  if (config.baseUrl !== undefined) baseUrl = config.baseUrl;
  if (config.token !== undefined) token = config.token;
}

// A 401 on any request after sign-in means the session is gone.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function headers(extra?: HeadersInit): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (token) base.Authorization = `Bearer ${token}`;
  return { ...base, ...(extra as Record<string, string> | undefined) };
}

function retryAfterSeconds(res: Response): number | undefined {
  const n = Number(res.headers.get("Retry-After"));
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : undefined;
}

async function apiFailure(res: Response, announce: boolean): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
  // The sign-in request shows its own 401, so it does not end the session.
  if (res.status === 401 && announce) onUnauthorized?.();
  return new ApiError(errorMessage(body.detail, res.statusText || `HTTP ${res.status}`), res.status, retryAfterSeconds(res));
}

async function request<T>(path: string, init: RequestInit = {}, announce = true): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, { ...init, headers: headers(init.headers) });
  if (!res.ok) throw await apiFailure(res, announce);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface StreamOptions {
  images: ImageUpload[];
  web: boolean;
  illustrate: boolean;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onSources: (sources: SourceRef[], notes: string[], query: string | null) => void;
  onIllustrationFailed: (failure: { prompt: string; status: number | null; detail: string }) => void;
}

// Resolves with the saved chat once the server sends `done`. Aborting rejects with an AbortError; the server then
// saves whatever text it had already streamed. React Native's own fetch cannot stream a body, so this uses Expo's.
async function streamMessage(id: string, content: string, opts: StreamOptions): Promise<DoneChat> {
  const { images, web, illustrate, signal, onDelta, onSources, onIllustrationFailed } = opts;
  const res = await streamingFetch(`${baseUrl}/api/chats/${id}/messages`, {
    method: "POST",
    headers: { ...headers(), Accept: "text/event-stream" },
    body: JSON.stringify({ content, images, web, illustrate }),
    signal,
  });
  if (!res.ok) throw await apiFailure(res as unknown as Response, true);
  if (!res.body) throw new Error(res.statusText || `HTTP ${res.status}`);

  let chat: DoneChat | null = null;
  let failure: string | null = null;
  const feed = createSseParser(({ event, data }) => {
    const payload = JSON.parse(data) as Record<string, unknown>;
    if (event === "delta") onDelta(payload.text as string);
    else if (event === "sources")
      onSources(
        (payload.sources as SourceRef[] | undefined) ?? [],
        (payload.notes as string[] | undefined) ?? [],
        typeof payload.query === "string" ? payload.query : null,
      );
    // Images are delivered with `done` (stored on the saved message), so the live event needs no handling.
    else if (event === "image") return;
    else if (event === "illustration_failed") onIllustrationFailed(parseIllustrationFailure(payload));
    else if (event === "done") chat = payload as unknown as DoneChat;
    else if (event === "error") failure = errorMessage(payload.detail, "Stream failed");
  });

  // `stream: true` keeps a multi-byte character that a network chunk split in two from turning into garbage.
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    feed(decoder.decode(value, { stream: true }));
  }

  if (failure !== null) throw new Error(failure);
  if (chat === null) throw new Error("Connection closed before the reply finished");
  return chat;
}

// Images need the token too, so the picture component sends this header along with the URL.
export const imageSource = (chatId: string, imageId: string) => ({
  uri: `${baseUrl}/api/chats/${chatId}/images/${imageId}`,
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});

export const api = {
  me: () => request<UserView>("/auth/me", {}, false),
  login: (body: LoginBody) => request<TokenLogin>("/auth/token", { method: "POST", body: JSON.stringify(body) }, false),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  listChats: () => request<ChatSummary[]>("/chats"),
  createChat: () => request<Chat>("/chats", { method: "POST" }),
  getChat: (id: string) => request<Chat>(`/chats/${id}`),
  renameChat: (id: string, title: string) =>
    request<Chat>(`/chats/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteChat: (id: string) => request<void>(`/chats/${id}`, { method: "DELETE" }),
  sendMessage: streamMessage,
  saveBehavior: (id: string, body: BehaviorBody) =>
    request<Chat>(`/chats/${id}/behavior`, { method: "PUT", body: JSON.stringify(body) }),
  setChatModel: (id: string, body: ChatModelBody) =>
    request<Chat>(`/chats/${id}/model`, { method: "PUT", body: JSON.stringify(body) }),
  getContext: (id: string) => request<ContextInfo>(`/chats/${id}/context`),
  listProfiles: () => request<ProfileList>("/profiles"),
  listModels: (body: ModelsQuery) =>
    request<ModelsResult>("/profiles/models", { method: "POST", body: JSON.stringify(body) }),
  activateProfile: (id: string) => request<ProfileList>(`/profiles/${id}/activate`, { method: "POST" }),
};
