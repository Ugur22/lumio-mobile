import { fetch as streamingFetch } from "expo/fetch";

import { createSseParser } from "@/lib/sse";
import { normalizeTrial } from "@/lib/trial";

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
  OAuthExchangeBody,
  ProfileList,
  SourceRef,
  TokenLogin,
  TrialStatus,
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

// Where a reply stands across reconnects. `lastId` is the last SSE event id applied, so a resume asks for what follows
// it and an event replayed twice is ignored. `started` is true once the server accepted the message (a job exists).
export interface StreamCursor {
  lastId: number;
  started: boolean;
  // `X-Job-Id` of the reply, so a resume can never attach to a newer reply in the same chat.
  jobId: string | null;
}
export const newCursor = (): StreamCursor => ({ lastId: -1, started: false, jobId: null });

// The header is untrusted: keep it only if it is a plain token that is safe in a query string.
function rememberJob(res: { headers: { get(name: string): string | null } }, cursor: StreamCursor) {
  const id = res.headers.get("X-Job-Id");
  if (id && /^[A-Za-z0-9_-]{1,64}$/.test(id)) cursor.jobId = id;
}

// The server ended the reply with an `error` event: a real failure, not a dropped connection.
export class ReplyFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplyFailed";
  }
}

// A handler passed to the stream threw. Not a network problem, so never worth a reconnect.
export class HandlerError extends Error {
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : "Reply handler failed");
    this.name = "HandlerError";
  }
}

// The connection ended before `done`. The reply is still running on the server; resume.
export class StreamInterrupted extends Error {
  constructor() {
    super("Connection closed before the reply finished");
    this.name = "StreamInterrupted";
  }
}

export interface Handlers {
  signal: AbortSignal;
  cursor: StreamCursor;
  onDelta: (text: string) => void;
  onSources: (sources: SourceRef[], notes: string[], query: string | null) => void;
  onIllustrationFailed: (failure: { prompt: string; status: number | null; detail: string }) => void;
  // A picture was stored. Only the id and prompt are used; the id is checked by the caller before it becomes a URL.
  onImage: (image: { id: string; prompt: string }) => void;
}

export interface StreamOptions extends Handlers {
  images: ImageUpload[];
  web: boolean;
  illustrate: boolean;
}

// Reads one SSE response to its end. Resolves with the saved chat on `done`.
async function consume(res: Awaited<ReturnType<typeof streamingFetch>>, h: Handlers): Promise<DoneChat> {
  if (!res.body) throw new Error(res.statusText || `HTTP ${res.status}`);
  const { cursor } = h;
  let chat: DoneChat | null = null;
  let failure: string | null = null;
  const feed = createSseParser(({ event, data, id }) => {
    // Replays after a resume start right after `lastId`, but an id we already applied is never applied twice.
    if (id !== undefined) {
      if (id <= cursor.lastId) return;
      cursor.lastId = id;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }
    try {
      if (event === "delta") {
        if (typeof payload.text === "string") h.onDelta(payload.text);
      } else if (event === "sources")
        h.onSources(
          (payload.sources as SourceRef[] | undefined) ?? [],
          (payload.notes as string[] | undefined) ?? [],
          typeof payload.query === "string" ? payload.query : null,
        );
      else if (event === "image") {
        if (typeof payload.id === "string") h.onImage({ id: payload.id, prompt: typeof payload.prompt === "string" ? payload.prompt : "" });
      } else if (event === "illustration_failed") h.onIllustrationFailed(parseIllustrationFailure(payload));
      else if (event === "done") chat = payload as unknown as DoneChat;
      else if (event === "error") failure = errorMessage(payload.detail, "Stream failed");
    } catch (e) {
      throw new HandlerError(e);
    }
  });

  // `stream: true` keeps a multi-byte character that a network chunk split in two from turning into garbage.
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    feed(decoder.decode(value, { stream: true }));
  }

  if (failure !== null) throw new ReplyFailed(failure);
  if (chat === null) throw new StreamInterrupted();
  return chat;
}

// Resolves with the saved chat once the server sends `done`. A stop (see cancelMessage) ends the reply on the server,
// which saves the partial text; aborting only drops this connection. React Native's own fetch cannot stream a body,
// so this uses Expo's.
async function streamMessage(id: string, content: string, opts: StreamOptions): Promise<DoneChat> {
  const { images, web, illustrate, signal } = opts;
  const res = await streamingFetch(`${baseUrl}/api/chats/${id}/messages`, {
    method: "POST",
    headers: { ...headers(), Accept: "text/event-stream" },
    body: JSON.stringify({ content, images, web, illustrate }),
    signal,
  });
  if (!res.ok) throw await apiFailure(res as unknown as Response, true);
  opts.cursor.started = true;
  rememberJob(res, opts.cursor);
  // Attached: from here on a break is resumed by event id like any other.
  opts.cursor.started = true;
  return consume(res, opts);
}

// Reattaches to the reply running for this chat and replays the events after `afterId`. Resolves null when the server
// has no reply buffered any more (204): the caller refetches the chat.
async function resumeMessage(id: string, afterId: number, opts: Handlers): Promise<DoneChat | null> {
  // The server answers 422 to anything but a plain integer, so the header is sent only as one (omitted = from the start).
  const last: Record<string, string> = Number.isSafeInteger(afterId) && afterId >= 0 ? { "Last-Event-ID": String(afterId) } : {};
  const job = opts.cursor.jobId ? `?job=${encodeURIComponent(opts.cursor.jobId)}` : "";
  const res = await streamingFetch(`${baseUrl}/api/chats/${id}/messages/stream${job}`, {
    method: "GET",
    headers: { ...headers(), Accept: "text/event-stream", ...last },
    signal: opts.signal,
  });
  if (res.status === 204) return null;
  if (!res.ok) throw await apiFailure(res as unknown as Response, true);
  rememberJob(res, opts.cursor);
  // Attached: from here on a break is resumed by event id like any other.
  opts.cursor.started = true;
  return consume(res, opts);
}

// Images need the token too, so the picture component sends this header along with the URL.
export const imageSource = (chatId: string, imageId: string) => ({
  uri: `${baseUrl}/api/chats/${chatId}/images/${imageId}`,
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});

export const api = {
  me: () => request<UserView>("/auth/me", {}, false),
  login: (body: LoginBody) => request<TokenLogin>("/auth/token", { method: "POST", body: JSON.stringify(body) }, false),
  oauthExchange: (body: OAuthExchangeBody) =>
    request<TokenLogin>("/auth/oauth/exchange", { method: "POST", body: JSON.stringify(body) }, false),
  getTrial: (): Promise<TrialStatus> => request<unknown>("/trial").then(normalizeTrial),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  listChats: () => request<ChatSummary[]>("/chats"),
  createChat: () => request<Chat>("/chats", { method: "POST" }),
  getChat: (id: string) => request<Chat>(`/chats/${id}`),
  renameChat: (id: string, title: string) =>
    request<Chat>(`/chats/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteChat: (id: string) => request<void>(`/chats/${id}`, { method: "DELETE" }),
  sendMessage: streamMessage,
  resumeMessage,
  cancelMessage: (id: string) => request<void>(`/chats/${id}/messages/cancel`, { method: "POST" }),
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
