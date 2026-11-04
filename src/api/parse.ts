// Tolerant of missing fields: the note is secondary and must never break the stream.
export function parseIllustrationFailure(payload: Record<string, unknown>) {
  return {
    prompt: typeof payload.prompt === "string" ? payload.prompt : "",
    status: typeof payload.status === "number" ? payload.status : null,
    detail: typeof payload.detail === "string" ? payload.detail : "",
  };
}
