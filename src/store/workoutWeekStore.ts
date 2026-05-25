// Non-persisted store — RichWeek is regenerated deterministically each session.
// Stored in memory only so multiple screens can share the same computed week
// without re-running the engine on every navigation.

import { create } from 'zustand';
import type { RichWeek } from '../types/workout';

type WorkoutWeekState = {
  richWeek:      RichWeek | null;
  setRichWeek:   (week: RichWeek) => void;
  clearRichWeek: () => void;
};

export const useWorkoutWeekStore = create<WorkoutWeekState>()((set) => ({
  richWeek:      null,
  setRichWeek:   (week) => set({ richWeek: week }),
  clearRichWeek: ()     => set({ richWeek: null }),
}));
