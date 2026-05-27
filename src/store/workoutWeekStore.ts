// Non-persisted store — both RichWeek and WeekPlan are regenerated deterministically
// each session. Stored in memory so multiple screens share the same computed plan
// without re-running the engine on every navigation.

import { create } from 'zustand';
import type { RichWeek }  from '../types/workout';
import type { WeekPlan }  from '../utils/trainingEngine';

type WorkoutWeekState = {
  richWeek:      RichWeek | null;
  weekPlan:      WeekPlan | null;
  setRichWeek:   (week: RichWeek)  => void;
  setWeekPlan:   (plan: WeekPlan)  => void;
  clearRichWeek: () => void;
  clearWeekPlan: () => void;
};

export const useWorkoutWeekStore = create<WorkoutWeekState>()((set) => ({
  richWeek:      null,
  weekPlan:      null,
  setRichWeek:   (week) => set({ richWeek: week }),
  setWeekPlan:   (plan) => set({ weekPlan: plan }),
  clearRichWeek: ()     => set({ richWeek: null }),
  clearWeekPlan: ()     => set({ weekPlan: null }),
}));
