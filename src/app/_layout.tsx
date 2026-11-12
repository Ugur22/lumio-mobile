import "../global.css";
import { Literata_600SemiBold, useFonts } from "@expo-google-fonts/literata";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { setUnauthorizedHandler } from "@/api/client";
import { navigationColors } from "@/lib/navTheme";
import { queryClient } from "@/lib/queryClient";
import { usePalette } from "@/lib/theme";
import { useCurrent } from "@/store/current";
import { useSession } from "@/store/session";
import { useStream } from "@/store/stream";
import { useTheme } from "@/store/theme";

// Hold the native splash until the stored login and theme are read, so it hands over straight to the right screen.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const themeReady = useTheme((s) => s.ready);
  // A font that fails to load must not hold the app back: the headline falls back to the system font.
  const [fontsLoaded, fontError] = useFonts({ Literata_600SemiBold });

  // The router's built-in themes are the iOS system greys, which showed beside the open drawer in dark mode.
  const scheme = useColorScheme();
  const palette = usePalette();
  const navTheme = useMemo(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, ...navigationColors(palette) } };
  }, [scheme, palette]);

  useEffect(() => {
    setUnauthorizedHandler(() => useSession.getState().expire());
    void useTheme.getState().load();
    void useSession.getState().load();
    return () => setUnauthorizedHandler(null);
  }, []);

  // One person's chats must not be left in memory for the next sign-in on this phone.
  useEffect(() => {
    if (status !== "signedIn") {
      queryClient.clear();
      useStream.getState().clear();
      useCurrent.getState().open(null);
    }
  }, [status]);

  const ready = status !== "pending" && themeReady && (fontsLoaded || fontError !== null);
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Nothing renders until the stored login and theme have been read, so neither the login screen nor the wrong
  // colours flash.
  if (!ready) return <View className="flex-1 bg-bg" />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <StatusBar style="auto" />
        <ThemeProvider value={navTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={status === "signedIn"}>
              <Stack.Screen name="(drawer)" />
            </Stack.Protected>
            <Stack.Protected guard={status !== "signedIn"}>
              <Stack.Screen name="login" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
