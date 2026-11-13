import { useEffect, useState } from "react";
import { AppState } from "react-native";

// From thinking-orbs-native (MIT, see ./LICENSE), commit 387b049 of Jakubantalik/Libraries.dev.

/** True while the app is foregrounded; the render loop stops otherwise. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setActive(s !== "background"));
    return () => sub.remove();
  }, []);
  return active;
}

// One clock for every orb on screen, so several mounted together stay in phase. Seconds since a fixed origin.
export function nowSeconds(): number {
  return typeof performance?.now === "function" ? performance.now() / 1000 : Date.now() / 1000;
}
