import { create } from "zustand";

import { ApiError, api, configureApi } from "@/api/client";
import type { UserView } from "@/api/types";
import { clearToken, loadLogin, saveLogin } from "@/lib/credentials";

// "pending" = the stored login has not been checked yet, so neither the login screen nor the app may show.
type Status = "pending" | "anonymous" | "signedIn";

interface SessionState {
  status: Status;
  user: UserView | null;
  server: string;
  // Why the login screen appears without the user having signed out.
  notice: string | null;
  load: () => Promise<void>;
  signIn: (server: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // The server rejected the token mid-use.
  expire: () => void;
}

export const EXPIRED = "Your session has ended. Sign in again.";

export const useSession = create<SessionState>((set, get) => ({
  status: "pending",
  user: null,
  server: "",
  notice: null,
  load: async () => {
    const stored = await loadLogin();
    if (stored.server) set({ server: stored.server });
    if (!stored.server || !stored.token) return set({ status: "anonymous" });
    configureApi({ baseUrl: stored.server, token: stored.token });
    try {
      set({ status: "signedIn", user: await api.me() });
    } catch (err) {
      // Only a rejected token ends the session. With no connection the app cannot show chats, but it must not
      // throw away a token that is still good.
      if (err instanceof ApiError && err.status === 401) {
        configureApi({ token: null });
        await clearToken();
        set({ status: "anonymous", user: null });
      } else {
        set({ status: "anonymous", user: null, notice: "Could not reach the server. Check your connection." });
      }
    }
  },
  signIn: async (server, username, password) => {
    configureApi({ baseUrl: server, token: null });
    const { token, user } = await api.login({ username, password });
    await saveLogin(server, token);
    configureApi({ token });
    set({ status: "signedIn", user, server, notice: null });
  },
  // The server forgets the token first; the phone drops it even when that request fails, so sign-out always works.
  signOut: async () => {
    try {
      await api.logout();
    } catch {
      /* offline or already expired: the local copy goes either way */
    }
    configureApi({ token: null });
    await clearToken();
    set({ status: "anonymous", user: null, notice: null });
  },
  expire: () => {
    if (get().status !== "signedIn") return;
    configureApi({ token: null });
    void clearToken();
    set({ status: "anonymous", user: null, notice: EXPIRED });
  },
}));
