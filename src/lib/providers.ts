import type { Profile, ProfileList } from "@/api/types";

// A chat's own provider wins unless it was deleted, in which case the chat quietly follows the default.
export function effectiveProfile(
  list: ProfileList | undefined,
  chatProfileId: string | null | undefined,
): { profile: Profile | undefined; fellBack: boolean } {
  const own = chatProfileId ? list?.profiles.find((p) => p.id === chatProfileId) : undefined;
  if (own) return { profile: own, fellBack: false };
  return {
    profile: list?.profiles.find((p) => p.id === list.active),
    fellBack: Boolean(chatProfileId) && list !== undefined,
  };
}
