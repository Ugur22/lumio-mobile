// The token travels with every request, so plain http is accepted only for the machine itself or a private network
// address (local development); anything public has to be https.
const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[^.]+\.local)$/i;

export type ServerUrlResult = { ok: true; url: string } | { ok: false; error: string };

export function normalizeServerUrl(raw: string): ServerUrlResult {
  let input = raw.trim();
  if (!input) return { ok: false, error: "Enter the server address" };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) input = `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "That is not a valid address" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "The address must start with https://" };
  }
  if (parsed.protocol === "http:" && !PRIVATE_HOST.test(parsed.hostname)) {
    return { ok: false, error: "Use https:// for a server outside your own network" };
  }
  // Credentials in the URL would end up in logs and the stored value.
  if (parsed.username || parsed.password) return { ok: false, error: "Leave the username and password out of the address" };
  return { ok: true, url: parsed.origin + parsed.pathname.replace(/\/+$/, "") };
}
