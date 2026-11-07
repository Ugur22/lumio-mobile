import { create } from "zustand";

// The provider/model sheet is opened from the switcher chip, but also from the trial chip and notices.
interface SheetState {
  providers: boolean;
  setProviders: (open: boolean) => void;
}

export const useSheets = create<SheetState>((set) => ({
  providers: false,
  setProviders: (providers) => set({ providers }),
}));
