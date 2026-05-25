import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AdaptationResult } from '../types/adaptation';

// Persists one AdaptationResult per training week, keyed by "w{weekNumber}".
// The Training and Today screens call getAdaptation(week) on every render;
// if an adaptation exists they display adapted workouts, otherwise the canonical plan.
// Adaptations are recomputed explicitly (via the Training screen's "Adapt" button)
// so the athlete sees a stable plan for the week — changes don't flicker as
// physiological scores shift day-to-day.

type AdaptationStore = {
  adaptations: Record<string, AdaptationResult>;

  setAdaptation:   (week: number, result: AdaptationResult) => void;
  clearAdaptation: (week: number) => void;
  getAdaptation:   (week: number) => AdaptationResult | undefined;
};

export const useAdaptationStore = create<AdaptationStore>()(
  persist(
    (set, get) => ({
      adaptations: {},

      setAdaptation: (week, result) =>
        set(state => ({
          adaptations: { ...state.adaptations, [`w${week}`]: result },
        })),

      clearAdaptation: (week) =>
        set(state => {
          const next = { ...state.adaptations };
          delete next[`w${week}`];
          return { adaptations: next };
        }),

      getAdaptation: (week) => get().adaptations[`w${week}`],
    }),
    {
      name:    'adaptation-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ adaptations: state.adaptations }),
    },
  ),
);
