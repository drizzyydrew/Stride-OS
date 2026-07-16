import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GeneratedBeginnerPlan } from '../types/beginnerPlan';

type BeginnerPlanStore = {
  schemaVersion: 1;
  activePlan: GeneratedBeginnerPlan | null;
  setActivePlan: (plan: GeneratedBeginnerPlan) => void;
  clearFuturePlan: () => void;
};

export const useBeginnerPlanStore = create<BeginnerPlanStore>()(
  persist(
    set => ({
      schemaVersion: 1,
      activePlan: null,
      setActivePlan: activePlan => set({ activePlan }),
      clearFuturePlan: () => set({ activePlan: null }),
    }),
    {
      name: 'beginner-plan-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<BeginnerPlanStore> | undefined),
        schemaVersion: 1,
      }),
    },
  ),
);
