import { create } from "zustand";

type MobileMenuState = {
  isOpen: boolean;
  close: () => void;
  toggle: () => void;
};

export const useMobileMenuStore = create<MobileMenuState>((set) => ({
  isOpen: false,
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
