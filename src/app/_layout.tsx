import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { setUnauthorizedHandler } from "@/api/client";
import { queryClient } from "@/lib/queryClient";
import { useCurrent } from "@/store/current";
import { useSession } from "@/store/session";
import { useStream } from "@/store/stream";
import { useTheme } from "@/store/theme";

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const themeReady = useTheme((s) => s.ready);

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

  // Nothing renders until the stored login and theme have been read, so neither the login screen nor the wrong
  // colours flash.
  if (status === "pending" || !themeReady) return <View className="flex-1 bg-bg" />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={status === "signedIn"}>
            <Stack.Screen name="(drawer)" />
          </Stack.Protected>
          <Stack.Protected guard={status !== "signedIn"}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
