import type { ProfileList, TrialStatus } from "@/api/types";

import { hasOwnProvider, trialActive } from "./trial";

export type EmptyKind = "new" | "ended";

// What the chat screen shows when there is nothing to send to: an account that never had a provider, or one whose
// free trial has run out. Until both answers are in, nothing is shown, so the screen does not flash.
export function emptyKind(profiles: ProfileList | undefined, trial: TrialStatus | undefined, trialSettled: boolean): EmptyKind | null {
  if (!profiles || !trialSettled) return null;
  if (hasOwnProvider(profiles) || trialActive(trial)) return null;
  return trial?.enrolled ? "ended" : "new";
}

export const EMPTY_COPY: Record<EmptyKind, { title: string; body: string }> = {
  new: {
    title: "Connect a provider to start chatting",
    body: "Lumio sends your messages to a model provider you choose. Your key is stored on your Lumio server, never on this phone.",
  },
  ended: {
    title: "Your free trial has ended",
    body: "Your chats are still here. Add a provider of your own to keep going. Your key is stored on your Lumio server, never on this phone.",
  },
};
