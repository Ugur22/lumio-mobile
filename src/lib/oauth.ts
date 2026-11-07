export type OAuthProvider = "google" | "github";

export const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
];

// Where the system browser goes. `server` is the normalized base URL (no trailing slash).
export function oauthStartUrl(server: string, provider: OAuthProvider, redirect: string, challenge: string): string {
  const query = `client=app&redirect=${encodeURIComponent(redirect)}&challenge=${encodeURIComponent(challenge)}`;
  return `${server}/api/auth/oauth/${provider}/start?${query}`;
}

export interface AuthRedirect {
  code: string | null;
  error: string | null;
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

// Reads ?code= and ?auth_error= from the URL the server redirected to. Parsed by hand: the URL class is patchy in
// React Native, and exp:// URLs are not special schemes anyway.
export function parseAuthRedirect(url: string): AuthRedirect {
  const out: AuthRedirect = { code: null, error: null };
  const queryStart = url.indexOf("?");
  if (queryStart < 0) return out;
  const hash = url.indexOf("#", queryStart);
  const query = url.slice(queryStart + 1, hash < 0 ? undefined : hash);
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    const key = eq < 0 ? pair : pair.slice(0, eq);
    const value = eq < 0 ? "" : decode(pair.slice(eq + 1));
    if (value === null || value === "") continue;
    if (key === "code" && out.code === null) out.code = value;
    else if (key === "auth_error" && out.error === null) out.error = value;
  }
  return out;
}

// Only these codes are ever shown; the URL's own text never reaches the screen.
const MESSAGES: Record<string, string> = {
  unavailable: "Sign-in with that provider is not available right now.",
  state: "That sign-in expired or was interrupted. Try again.",
  denied: "Sign-in was cancelled.",
  provider: "The provider could not complete the sign-in. Try again in a moment.",
  unverified: "Your email must be verified",
  too_new: "That GitHub account is too new to start a trial",
  disposable: "Disposable email addresses cannot start a trial",
  throttled: "Too many sign-ups from your network, try later",
  disabled: "Free trials are not available right now.",
  trial_used: "This account already used its free trial. You can add your own provider.",
};

export const FALLBACK_AUTH_ERROR = "Sign-in failed. Try again.";

// trial_used still signs the person in, so it is a notice inside the app rather than a problem on the login screen.
export const isSignedInNotice = (code: string) => code === "trial_used";

export const authErrorText = (code: string): string =>
  Object.hasOwn(MESSAGES, code) ? (MESSAGES[code] as string) : FALLBACK_AUTH_ERROR;
