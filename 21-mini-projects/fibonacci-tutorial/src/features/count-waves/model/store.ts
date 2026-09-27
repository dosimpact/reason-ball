import { create } from "zustand";

type WaveDraft = {
  waveIndices: number[];
  maxPoints: number;
  setMaxPoints: (count: number) => void;
  chooseCandle: (index: number) => void;
  undo: () => void;
  reset: () => void;
  hydrateFromPlan: (indices: number[]) => void;
};

export const useWaveDraft = create<WaveDraft>((set) => ({
  waveIndices: [],
  maxPoints: 3,
  setMaxPoints: (maxPoints) => set({ maxPoints }),
  chooseCandle: (index) => set(({ waveIndices, maxPoints }) => {
    if (waveIndices.length >= maxPoints || waveIndices.includes(index) || (waveIndices.length > 0 && index <= waveIndices[waveIndices.length - 1])) return { waveIndices };
    return { waveIndices: [...waveIndices, index] };
  }),
  undo: () => set(({ waveIndices }) => ({ waveIndices: waveIndices.slice(0, -1) })),
  reset: () => set({ waveIndices: [] }),
  hydrateFromPlan: (indices) => set({ waveIndices: indices }),
}));
