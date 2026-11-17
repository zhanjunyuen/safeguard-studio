import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PendingCommand = 'run' | 'fill-attacks' | null;

interface PresenterState {
  active: boolean;
  step: number;
  speed: 1 | 2 | 4;
  /** one-shot command a page picks up and clears (e.g. start a run) */
  pending: PendingCommand;
  setActive: (a: boolean) => void;
  toggle: () => void;
  go: (step: number) => void;
  setSpeed: (s: 1 | 2 | 4) => void;
  command: (c: PendingCommand) => void;
}

export const usePresenter = create<PresenterState>()(
  persist(
    (set) => ({
      active: false,
      step: 0,
      speed: 1,
      pending: null,
      setActive: (active) => set({ active }),
      toggle: () => set((s) => ({ active: !s.active })),
      go: (step) => set({ step }),
      setSpeed: (speed) => set({ speed }),
      command: (pending) => set({ pending }),
    }),
    { name: 'safeguard-presenter', partialize: ({ active, step, speed }) => ({ active, step, speed }) },
  ),
);

/** Replay timings scale with presenter speed (1 when presenter mode is off). */
export const useReplaySpeed = () => usePresenter((s) => (s.active ? s.speed : 1));
