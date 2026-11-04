import { create } from "zustand";

interface CurrentState {
  // null = the blank "new chat" screen.
  chatId: string | null;
  // Bumped when the user opens a chat or starts a new one, so the list remounts and starts at the end. Adopting the
  // id of a chat that was just created keeps it, so the screen does not jump after a first reply is saved.
  epoch: number;
  open: (id: string | null) => void;
  adopt: (id: string) => void;
}

export const useCurrent = create<CurrentState>((set) => ({
  chatId: null,
  epoch: 0,
  open: (id) => set((s) => ({ chatId: id, epoch: s.epoch + 1 })),
  adopt: (id) => set({ chatId: id }),
}));
