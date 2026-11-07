import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { DEFAULT_SERVER } from "@/lib/config";
import { authErrorMessage, normalizeUsername, usernameHint } from "@/lib/auth";
import { OAUTH_PROVIDERS, type OAuthProvider, authErrorText, isSignedInNotice, oauthStartUrl, parseAuthRedirect } from "@/lib/oauth";
import { newPkce } from "@/lib/pkceNative";
import { normalizeServerUrl } from "@/lib/serverUrl";
import { usePalette } from "@/lib/theme";
import { TRIAL_PITCH } from "@/lib/trial";
import { useSession } from "@/store/session";

export default function Login() {
  const palette = usePalette();
  const { server: savedServer, notice, signIn, signInWithCode } = useSession();
  const [server, setServer] = useState(savedServer || DEFAULT_SERVER);
  const [editingServer, setEditingServer] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  const submit = async () => {
    const url = normalizeServerUrl(server);
    if (!url.ok) return setError(url.error);
    const name = normalizeUsername(username);
    const hint = usernameHint(name);
    if (hint) return setError(hint);
    if (!password) return setError("Enter your password");
    setError(null);
    setBusy(true);
    try {
      await signIn(url.url, name, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const continueWith = async (provider: OAuthProvider) => {
    const url = normalizeServerUrl(server);
    if (!url.ok) return setError(url.error);
    setError(null);
    setOauthBusy(true);
    try {
      const pkce = await newPkce();
      // Expo Go gives exp://<ip>:8081/--/auth, a real build lumio://auth; createURL knows which.
      const redirect = Linking.createURL("auth");
      const result = await WebBrowser.openAuthSessionAsync(oauthStartUrl(url.url, provider, redirect, pkce.challenge), redirect);
      // Closing the browser (cancel or dismiss) is not an error.
      if (result.type !== "success") return;
      const { code, error: authError } = parseAuthRedirect(result.url);
      if (!code) return setError(authErrorText(authError ?? ""));
      // The notice is looked up from the allowlist, never taken from the URL.
      const flash = authError && isSignedInNotice(authError) ? authErrorText(authError) : null;
      await signInWithCode(url.url, code, pkce.verifier, flash);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setOauthBusy(false);
    }
  };

  const input = "rounded-xl border border-border bg-surface px-4 py-3 text-[17px] text-text";
  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="flex-grow justify-center gap-4 px-6 py-12" keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-4xl font-semibold text-text">Lumio</Text>
        {notice ? <Text className="text-caution">{notice}</Text> : null}
        {editingServer ? (
          <TextInput
            className={input}
            value={server}
            onChangeText={setServer}
            placeholder="Server address"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
          />
        ) : (
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-muted" numberOfLines={1}>
              {server.replace(/^https?:\/\//, "")}
            </Text>
            <Pressable onPress={() => setEditingServer(true)} hitSlop={8}>
              <Text className="text-accent">Change</Text>
            </Pressable>
          </View>
        )}
        <TextInput
          className={input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
        />
        <TextInput
          className={input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={palette.muted}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={submit}
        />
        {error ? <Text className="text-warn-bar">{error}</Text> : null}
        <Pressable onPress={submit} disabled={busy || oauthBusy} className="mt-2 h-12 items-center justify-center rounded-xl bg-accent">
          {busy ? <ActivityIndicator color={palette.bg} /> : <Text className="text-[17px] font-medium text-on-accent">Sign in</Text>}
        </Pressable>
        <View className="mt-4 gap-3 border-t border-border pt-5">
          {OAUTH_PROVIDERS.map(({ id, label }) => (
            <Pressable
              key={id}
              onPress={() => void continueWith(id)}
              disabled={busy || oauthBusy}
              accessibilityRole="button"
              className="h-12 items-center justify-center rounded-xl border border-border bg-surface disabled:opacity-60"
            >
              <Text className="text-[16px] font-medium text-text">{label}</Text>
            </Pressable>
          ))}
          {oauthBusy ? <ActivityIndicator color={palette.muted} /> : null}
          <Text className="text-center text-[13px] text-muted">{TRIAL_PITCH}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
