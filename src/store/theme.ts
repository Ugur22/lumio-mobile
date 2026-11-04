import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import { create } from "zustand";

import { parseThemeMode, type ThemeMode } from "@/lib/themeMode";

// A device setting, so it lives outside the sign-in: signing out does not reset it.
const KEY = "lumio.theme";

interface ThemeState {
  mode: ThemeMode;
  ready: boolean;
  load: () => Promise<void>;
  set: (mode: ThemeMode) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  mode: "system",
  ready: false,
  load: async () => {
    let mode: ThemeMode = "system";
    try {
      mode = parseThemeMode(await AsyncStorage.getItem(KEY));
    } catch {
      /* unreadable storage: follow the phone */
    }
    colorScheme.set(mode);
    set({ mode, ready: true });
  },
  set: (mode) => {
    // NativeWind passes this on to the phone's appearance, so the Tailwind colours, the JS palette and the status
    // bar all switch together.
    colorScheme.set(mode);
    set({ mode });
    AsyncStorage.setItem(KEY, mode).catch(() => undefined);
  },
}));
