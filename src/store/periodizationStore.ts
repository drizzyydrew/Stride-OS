import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TrainingPhase } from '../types/training';
import type { WeeklyLoadTargets } from '../types/periodization';

type PeriodizationStore = {
  // Keyed by week number — stored so the engine output can be recalled across sessions.
  weeklyTargets:   Record<number, WeeklyLoadTargets>;
  // Records which week each phase began (for phase-transition context).
  phaseStartWeeks: Partial<Record<TrainingPhase, number>>;

  setWeeklyTargets:  (week: number, targets: WeeklyLoadTargets) => void;
  setPhaseStartWeek: (phase: TrainingPhase, week: number) => void;
};

export const usePeriodizationStore = create<PeriodizationStore>()(
  persist(
    (set) => ({
      weeklyTargets:   {},
      phaseStartWeeks: {},

      setWeeklyTargets: (week, targets) =>
        set(state => ({
          weeklyTargets: { ...state.weeklyTargets, [week]: targets },
        })),

      setPhaseStartWeek: (phase, week) =>
        set(state => ({
          phaseStartWeeks: { ...state.phaseStartWeeks, [phase]: week },
        })),
    }),
    {
      name:    'periodization-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        weeklyTargets:   state.weeklyTargets,
        phaseStartWeeks: state.phaseStartWeeks,
      }),
    },
  ),
);
