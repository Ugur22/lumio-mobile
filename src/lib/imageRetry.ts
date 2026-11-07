// A picture can be asked for before the server can serve it (a live one, before its message is saved), so a load error
// is retried a few times before it counts as "no longer stored".
export const IMAGE_RETRY_DELAYS = [1000, 2000, 4000];

// Delay before retry number `attempt` (0 = first retry); null once the retries are used up.
export function retryDelay(attempt: number): number | null {
  return IMAGE_RETRY_DELAYS[attempt] ?? null;
}

// The server ignores `r`; it only makes the retry a different URL, so no cached failure is reused.
export function retryUri(uri: string, attempt: number): string {
  if (attempt <= 0) return uri;
  return `${uri}${uri.includes("?") ? "&" : "?"}r=${attempt}`;
}
