import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { ProfileList } from "@/api/types";

export const profilesKey = ["profiles"] as const;

export function useProfiles() {
  return useQuery({ queryKey: profilesKey, queryFn: api.listProfiles });
}

// Making a provider the default for new chats. The window belongs to the active profile, so any change can change
// every chat's meter.
export function useActivateProfile() {
  const qc = useQueryClient();
  return async (id: string) => {
    const list: ProfileList = await api.activateProfile(id);
    qc.setQueryData(profilesKey, list);
    void qc.invalidateQueries({ queryKey: ["context"] });
  };
}
