import { create } from "zustand";

// The provider/model sheet is opened from the switcher chip, but also from the trial chip and notices.
// The add-provider flow has its own sheet: it is what "providers" turns into when there is nothing to switch to.
interface SheetState {
  providers: boolean;
  setProviders: (open: boolean) => void;
  addProvider: boolean;
  setAddProvider: (open: boolean) => void;
  webSetup: boolean;
  setWebSetup: (open: boolean) => void;
}

export const useSheets = create<SheetState>((set) => ({
  providers: false,
  setProviders: (providers) => set({ providers }),
  addProvider: false,
  setAddProvider: (addProvider) => set({ addProvider }),
  webSetup: false,
  setWebSetup: (webSetup) => set({ webSetup }),
}));
