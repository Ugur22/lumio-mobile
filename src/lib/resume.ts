// Keeps a reply going across a dropped connection. The server runs the reply as a job and buffers its events, so
// after a break we reconnect and ask for everything after the last event id we saw.
import { AppState } from "react-native";

export interface ResumeDeps<T> {
  // Attempt 0 sends the message; later attempts resume. Resolves null when the server has no job left (refetch).
  attempt: (n: number, signal: AbortSignal) => Promise<T | null>;
  // False for errors the server meant (a failed reply, 401, 404): those end the turn instead of retrying.
  retryable: (err: unknown) => boolean;
  // Grows whenever a new event arrived, so a connection that made progress gets a fresh retry budget.
  progress: () => number;
  signal: AbortSignal;
  isActive?: () => boolean;
  // Calls back when the app returns to the foreground; returns the unsubscribe.
  onForeground?: (cb: () => void) => () => void;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  delays?: number[];
}

export const RETRY_DELAYS = [400, 1000, 2000, 4000];

const appActive = () => AppState.currentState === "active";

function appForeground(cb: () => void): () => void {
  let prev = AppState.currentState;
  const sub = AppState.addEventListener("change", (next) => {
    if (next === "active" && prev !== "active") cb();
    prev = next;
  });
  return () => sub.remove();
}

export function sleepMs(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done);
  });
}

// Resolves once the app is in the foreground (or the turn was stopped).
function untilActive(d: Required<Pick<ResumeDeps<unknown>, "isActive" | "onForeground">>, signal: AbortSignal): Promise<void> {
  if (d.isActive() || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const off = d.onForeground(finish);
    signal.addEventListener("abort", finish);
    function finish() {
      off();
      signal.removeEventListener("abort", finish);
      resolve();
    }
  });
}

export async function runWithResume<T>(deps: ResumeDeps<T>): Promise<T | null> {
  const isActive = deps.isActive ?? appActive;
  const onForeground = deps.onForeground ?? appForeground;
  const sleep = deps.sleep ?? sleepMs;
  const delays = deps.delays ?? RETRY_DELAYS;
  let attempt = 0;
  let failures = 0;
  for (;;) {
    await untilActive({ isActive, onForeground }, deps.signal);
    if (deps.signal.aborted) throw new DOMException("Aborted", "AbortError");

    // A connection that looks alive after the app was in the background is usually dead; coming back drops it so the
    // attempt ends and the loop resumes on a fresh one.
    const conn = new AbortController();
    const forward = () => conn.abort();
    deps.signal.addEventListener("abort", forward);
    const off = onForeground(() => conn.abort());
    const before = deps.progress();
    try {
      return await deps.attempt(attempt, conn.signal);
    } catch (err) {
      if (deps.signal.aborted) throw err;
      // The app coming back to the foreground dropped this connection on purpose: reconnect at once, free of charge.
      if (conn.signal.aborted) {
        attempt += 1;
        continue;
      }
      if (!deps.retryable(err)) throw err;
      attempt += 1;
      failures = deps.progress() > before ? 1 : failures + 1;
      if (failures > delays.length) throw err;
      await sleep(delays[failures - 1] ?? 0, deps.signal);
    } finally {
      off();
      deps.signal.removeEventListener("abort", forward);
    }
  }
}
