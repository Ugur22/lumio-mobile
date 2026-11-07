import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, ReplyFailed, StreamInterrupted, api, configureApi, newCursor, setUnauthorizedHandler } from "./client";

// vi.mock is hoisted above the imports, and the factory runs lazily, so the spy can be declared after them.
const streamingFetch = vi.fn();
vi.mock("expo/fetch", () => ({ fetch: (...args: unknown[]) => streamingFetch(...args) }));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

function sse(...events: [string, unknown, number?][]): Response {
  const text = events
    .map(([event, data, id]) => `${id === undefined ? "" : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
  return new Response(text, { headers: { "Content-Type": "text/event-stream" } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  configureApi({ baseUrl: "https://lumio.test", token: "tok123" });
});

afterEach(() => {
  fetchMock.mockReset();
  streamingFetch.mockReset();
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("prefixes the server address and sends the bearer token", async () => {
    fetchMock.mockResolvedValue(json([]));
    await api.listChats();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://lumio.test/api/chats");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("sends no Authorization header before sign-in and logs in through the token route", async () => {
    configureApi({ token: null });
    fetchMock.mockResolvedValue(json({ token: "new", user: { id: "1", username: "u", is_admin: false } }));
    const result = await api.login({ username: "u", password: "pw" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://lumio.test/api/auth/token");
    expect(init.headers.Authorization).toBeUndefined();
    expect(result.token).toBe("new");
  });

  it("reports a 401 to the session, except from the sign-in request", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(json({ detail: "Not signed in" }, { status: 401 }));
    await expect(api.listChats()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(json({ detail: "Invalid username or password" }, { status: 401 }));
    await expect(api.login({ username: "u", password: "x" })).rejects.toThrow("Invalid username or password");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("carries Retry-After on a 429 and joins validation messages", async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: "slow down" }, { status: 429, headers: { "Retry-After": "30" } }));
    await expect(api.listChats()).rejects.toMatchObject({ status: 429, retryAfter: 30 });
    fetchMock.mockResolvedValueOnce(json({ detail: [{ msg: "too short" }, { msg: "bad" }] }, { status: 422 }));
    await expect(api.listChats()).rejects.toThrow(new ApiError("too short; bad", 422));
  });
});

describe("sendMessage", () => {
  const options = () => ({
    images: [],
    web: false,
    illustrate: false,
    signal: new AbortController().signal,
    onDelta: vi.fn(),
    onSources: vi.fn(),
    onIllustrationFailed: vi.fn(),
    onImage: vi.fn(),
    onReasoning: vi.fn(),
    cursor: newCursor(),
  });

  it("streams deltas and resolves with the saved chat", async () => {
    const chat = { id: "c1", usage: null };
    streamingFetch.mockResolvedValue(sse(["delta", { text: "Hel" }], ["delta", { text: "lo" }], ["done", chat]));
    const opts = options();
    await expect(api.sendMessage("c1", "hi", opts)).resolves.toEqual(chat);
    expect(opts.onDelta.mock.calls).toEqual([["Hel"], ["lo"]]);
    const [url, init] = streamingFetch.mock.calls[0];
    expect(url).toBe("https://lumio.test/api/chats/c1/messages");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("fails when the server sends an error event or the stream ends early", async () => {
    streamingFetch.mockResolvedValueOnce(sse(["error", { detail: "provider down" }]));
    await expect(api.sendMessage("c1", "hi", options())).rejects.toBeInstanceOf(ReplyFailed);
    streamingFetch.mockResolvedValueOnce(sse(["delta", { text: "x" }]));
    await expect(api.sendMessage("c1", "hi", options())).rejects.toBeInstanceOf(StreamInterrupted);
  });
});

describe("event ids, images and resume", () => {
  const options = () => ({
    images: [],
    web: false,
    illustrate: false,
    signal: new AbortController().signal,
    onDelta: vi.fn(),
    onSources: vi.fn(),
    onIllustrationFailed: vi.fn(),
    onImage: vi.fn(),
    onReasoning: vi.fn(),
    cursor: newCursor(),
  });

  it("tracks the last event id, hands images to onImage and marks the reply started", async () => {
    streamingFetch.mockResolvedValue(
      sse(["delta", { text: "a" }, 0], ["image", { id: "0123456789abcdef0123456789abcdef", media_type: "image/png", prompt: "p" }, 1], ["delta", { text: "b" }, 2]),
    );
    const opts = options();
    await expect(api.sendMessage("c1", "hi", opts)).rejects.toBeInstanceOf(StreamInterrupted);
    expect(opts.cursor).toEqual({ lastId: 2, started: true, jobId: null });
    expect(opts.onImage).toHaveBeenCalledWith({ id: "0123456789abcdef0123456789abcdef", prompt: "p" });
  });

  it("resumes with Last-Event-ID and ignores replayed ids it already applied", async () => {
    streamingFetch.mockResolvedValue(sse(["delta", { text: "b" }, 1], ["delta", { text: "c" }, 2], ["done", { id: "c1" }, 3]));
    const opts = options();
    opts.cursor.lastId = 1;
    await expect(api.resumeMessage("c1", 1, opts)).resolves.toEqual({ id: "c1" });
    expect(opts.onDelta.mock.calls).toEqual([["c"]]);
    const [url, init] = streamingFetch.mock.calls[0];
    expect(url).toBe("https://lumio.test/api/chats/c1/messages/stream");
    expect(init.method).toBe("GET");
    expect(init.headers["Last-Event-ID"]).toBe("1");
  });

  it("resolves null on 204 and rejects 404 as an ApiError", async () => {
    streamingFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.resumeMessage("c1", 4, options())).resolves.toBeNull();
    streamingFetch.mockResolvedValueOnce(json({ detail: "Chat not found" }, { status: 404 }));
    await expect(api.resumeMessage("c1", 4, options())).rejects.toMatchObject({ status: 404 });
  });

  it("keeps X-Job-Id from the POST and sends it as ?job= on resume", async () => {
    const res = sse(["delta", { text: "a" }, 0]);
    res.headers.set("X-Job-Id", "job_1-A");
    streamingFetch.mockResolvedValueOnce(res);
    const opts = options();
    await expect(api.sendMessage("c1", "hi", opts)).rejects.toBeInstanceOf(StreamInterrupted);
    expect(opts.cursor.jobId).toBe("job_1-A");
    streamingFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.resumeMessage("c1", 0, opts)).resolves.toBeNull();
    expect(streamingFetch.mock.calls[1][0]).toBe("https://lumio.test/api/chats/c1/messages/stream?job=job_1-A");
    expect(streamingFetch.mock.calls[1][1].headers["Last-Event-ID"]).toBe("0");
  });

  it("ignores a job id that is not a plain token", async () => {
    const res = sse(["delta", { text: "a" }, 0]);
    res.headers.set("X-Job-Id", "a&b=c");
    streamingFetch.mockResolvedValueOnce(res);
    const opts = options();
    await api.sendMessage("c1", "hi", opts).catch(() => undefined);
    expect(opts.cursor.jobId).toBeNull();
  });

  it("only sends Last-Event-ID as a non-negative integer, and does not swallow a 422", async () => {
    for (const bad of [-1, 1.5, Number.NaN]) {
      streamingFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await api.resumeMessage("c1", bad, options());
      expect(streamingFetch.mock.calls.at(-1)?.[1].headers["Last-Event-ID"]).toBeUndefined();
    }
    streamingFetch.mockResolvedValueOnce(json({ detail: "Last-Event-ID must be an event number" }, { status: 422 }));
    await expect(api.resumeMessage("c1", 3, options())).rejects.toMatchObject({ status: 422 });
  });

  it("reports reasoning as a bare signal and keeps none of its text", async () => {
    streamingFetch.mockResolvedValue(sse(["reasoning", { text: "secret chain of thought" }, 0], ["reasoning", { text: "more" }, 1], ["done", { id: "c1" }, 2]));
    const opts = options();
    await api.sendMessage("c1", "hi", opts);
    expect(opts.onReasoning).toHaveBeenCalledTimes(2);
    expect(opts.onReasoning.mock.calls.flat()).toEqual([]);
  });

  it("posts to the cancel route", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await api.cancelMessage("c1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://lumio.test/api/chats/c1/messages/cancel");
    expect(init.method).toBe("POST");
  });
});
