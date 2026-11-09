import * as Linking from "expo-linking";
import { Sparkles } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ProviderIcon } from "@/components/ProviderIcon";
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
      <ScrollView contentContainerClassName="flex-grow gap-4 px-6 pb-10 pt-4" keyboardShouldPersistTaps="handled">
        <View className="min-h-[160px] flex-1 items-center justify-center">
          <Image source={require("../../assets/splash-icon.png")} accessibilityLabel="Lumio" className="h-36 w-36" />
        </View>
        {notice ? <Text className="text-caution">{notice}</Text> : null}
        {editingServer ? (
          <View className="gap-2">
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
            <Text className="text-[13px] text-muted">
              The Lumio server your account is on. Only change it if you run your own, for example http://192.168.1.20:8000 for a local one.
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-muted" numberOfLines={1}>
              Server: <Text className="text-text">{server.replace(/^https?:\/\//, "")}</Text>
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
          <View className="flex-row items-center justify-center gap-2">
            <Sparkles size={16} color={palette.accent} />
            <Text className="text-[15px] font-medium text-text">{TRIAL_PITCH}</Text>
          </View>
          {OAUTH_PROVIDERS.map(({ id, label }) => (
            <Pressable
              key={id}
              onPress={() => void continueWith(id)}
              disabled={busy || oauthBusy}
              accessibilityRole="button"
              className="h-12 flex-row items-center justify-center gap-3 rounded-xl border border-border bg-surface disabled:opacity-60"
            >
              <ProviderIcon provider={id} color={palette.text} />
              <Text className="text-[16px] font-medium text-text">{label}</Text>
            </Pressable>
          ))}
          {oauthBusy ? <ActivityIndicator color={palette.muted} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
