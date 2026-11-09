import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { ModelsQuery, NewProfileBody, ProfileList } from "@/api/types";
import { addedProfile } from "@/lib/providerPresets";

import { profilesKey, useActivateProfile } from "./useProfiles";

// The key test is the provider's own model list: it fails on a bad key and doubles as the list to pick from.
export function useTestProvider() {
  return useMutation({ mutationFn: (body: ModelsQuery) => api.listModels(body) });
}

// Saves the provider and makes it the default, so the next message goes to it.
export function useSaveProvider() {
  const qc = useQueryClient();
  const activate = useActivateProfile();
  return useMutation({
    mutationFn: async (body: NewProfileBody) => {
      const before = qc.getQueryData<ProfileList>(profilesKey);
      const list = await api.createProfile(body);
      qc.setQueryData(profilesKey, list);
      const made = addedProfile(before, list);
      if (made && list.active !== made.id) await activate(made.id);
      void qc.invalidateQueries({ queryKey: ["context"] });
    },
  });
}
