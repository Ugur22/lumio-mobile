import * as SecureStore from "expo-secure-store";

// The token is a bearer credential, so it lives in the Keychain / Keystore. The server address is not secret, but it
// is kept beside it so a sign-out can remove the token and keep the address for the next login.
const TOKEN_KEY = "lumio.token";
const SERVER_KEY = "lumio.server";

export interface StoredLogin {
  server: string | null;
  token: string | null;
}

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // An unreadable entry (a restored backup from another device) is treated as signed out.
    return null;
  }
}

export async function loadLogin(): Promise<StoredLogin> {
  const [server, token] = await Promise.all([read(SERVER_KEY), read(TOKEN_KEY)]);
  return { server, token };
}

export async function saveLogin(server: string, token: string): Promise<void> {
  await Promise.all([SecureStore.setItemAsync(SERVER_KEY, server), SecureStore.setItemAsync(TOKEN_KEY, token)]);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
