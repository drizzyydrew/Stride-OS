import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';

import type { GeneratedBeginnerPlan } from '../types/beginnerPlan';
import { repeatBeginnerWeek } from '../utils/beginnerPlans';

type BeginnerPlanStore = {
  schemaVersion: 2;
  activePlan: GeneratedBeginnerPlan | null;
  setActivePlan: (plan: GeneratedBeginnerPlan) => void;
  repeatWeek: (sourceWeekNumber: number) => void;
  clearFuturePlan: () => void;
};

export const useBeginnerPlanStore = create<BeginnerPlanStore>()(
  persist(
    set => ({
      schemaVersion: 2,
      activePlan: null,
      setActivePlan: activePlan => set({ activePlan }),
      repeatWeek: sourceWeekNumber => set(state => ({
        activePlan: state.activePlan
          ? repeatBeginnerWeek(state.activePlan, sourceWeekNumber)
          : null,
      })),
      clearFuturePlan: () => set({ activePlan: null }),
    }),
    {
      name: 'beginner-plan-store',
      version: 2,
      storage: createAppJSONStorage(),
      merge: (persisted, current) => {
        const saved = persisted as Partial<BeginnerPlanStore> | undefined;
        const savedPlan = saved?.activePlan as (GeneratedBeginnerPlan & { completionGoal?: GeneratedBeginnerPlan['completionGoal'] }) | null | undefined;
        return {
          ...current,
          ...saved,
          schemaVersion: 2,
          activePlan: savedPlan
            ? {
              ...savedPlan,
              completionGoal: savedPlan.completionGoal ?? 'complete_distance',
              adaptationAudit: Array.isArray(savedPlan.adaptationAudit) ? savedPlan.adaptationAudit : [],
            }
            : null,
        };
      },
    },
  ),
);
