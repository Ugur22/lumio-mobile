import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, configureApi, setUnauthorizedHandler } from "./client";

// vi.mock is hoisted above the imports, and the factory runs lazily, so the spy can be declared after them.
const streamingFetch = vi.fn();
vi.mock("expo/fetch", () => ({ fetch: (...args: unknown[]) => streamingFetch(...args) }));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

function sse(...events: [string, unknown][]): Response {
  const text = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
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
    await expect(api.sendMessage("c1", "hi", options())).rejects.toThrow("provider down");
    streamingFetch.mockResolvedValueOnce(sse(["delta", { text: "x" }]));
    await expect(api.sendMessage("c1", "hi", options())).rejects.toThrow("Connection closed");
  });
});
