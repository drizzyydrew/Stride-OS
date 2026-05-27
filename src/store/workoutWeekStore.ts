// Non-persisted store — kept for future use cases where a screen needs to
// share pre-computed rich week data without re-running the engine.
//
// NOTE: Do NOT write to this store from a useEffect that depends on values
// derived from it — that creates a store-write → re-render → store-write loop.
// Prefer calling useWeekPlan() directly in each screen instead.

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
