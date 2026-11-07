import { describe, expect, it } from "vitest";
import { parseIllustrationFailure } from "@/api/parse";
import { createSseParser, type SseEvent } from "./sse";

function collect(chunks: string[]): SseEvent[] {
  const events: SseEvent[] = [];
  const feed = createSseParser((e) => events.push(e));
  chunks.forEach(feed);
  return events;
}

describe("createSseParser", () => {
  it("parses named events with JSON data", () => {
    expect(collect(['event: delta\ndata: {"text":"hi"}\n\n'])).toEqual([
      { event: "delta", data: '{"text":"hi"}' },
    ]);
  });

  it("reassembles an event split across chunks, even mid-delimiter", () => {
    expect(collect(["event: del", 'ta\ndata: {"a":1}\n', "\nevent: done\ndata: {}\n\n"])).toEqual([
      { event: "delta", data: '{"a":1}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("handles CRLF and holds back an unfinished event", () => {
    expect(collect(["event: a\r\ndata: 1\r\n\r\nevent: b\r\ndata: 2"])).toEqual([{ event: "a", data: "1" }]);
  });
});

describe("event ids", () => {
  it("exposes the id field with each event", () => {
    expect(collect(['id: 0\nevent: delta\ndata: {"a":1}\n\nid: 12\nevent: done\ndata: {}\n\n'])).toEqual([
      { event: "delta", data: '{"a":1}', id: 0 },
      { event: "done", data: "{}", id: 12 },
    ]);
  });

  it("leaves id out when absent or not a plain integer", () => {
    expect(collect(["id: abc\nevent: a\ndata: 1\n\nevent: b\ndata: 2\n\nid: -3\ndata: 3\n\n"])).toEqual([
      { event: "a", data: "1" },
      { event: "b", data: "2" },
      { event: "message", data: "3" },
    ]);
  });

  it("keeps the id when it arrives after the data lines", () => {
    expect(collect(["event: a\ndata: 1\nid: 7\n\n"])).toEqual([{ event: "a", data: "1", id: 7 }]);
  });
});

describe("illustration_failed event", () => {
  it("parses into a failure, tolerating missing fields", () => {
    const [e] = collect(['event: illustration_failed\ndata: {"prompt":"p","status":400,"detail":"bad"}\n\n']);
    expect(e?.event).toBe("illustration_failed");
    expect(parseIllustrationFailure(JSON.parse(e?.data ?? "{}") as Record<string, unknown>)).toEqual({
      prompt: "p",
      status: 400,
      detail: "bad",
    });
    expect(parseIllustrationFailure({ status: null })).toEqual({ prompt: "", status: null, detail: "" });
  });
});
