import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MobilityCompletion } from '../types/mobility';
import { useActivityStore } from './activityStore';
import { activityFromMobilityCompletion } from '../utils/activityMigration';

type MobilityStore = {
  completions:           MobilityCompletion[];

  // Set later by the readiness wave (Movement Lab). `sourceAnalysisId` is the
  // readiness-assessment id that produced this recommendation set, so the UI
  // can eventually show "based on your last readiness check".
  recommendedWorkoutIds: string[];
  recommendationSourceId: string | null;

  logCompletion:  (entry: Omit<MobilityCompletion, 'id'>) => void;
  deleteCompletion: (id: string) => void;
  resetMobility:  () => void;

  setRecommendedWorkouts: (ids: string[], sourceAnalysisId?: string) => void;
};

export const useMobilityStore = create<MobilityStore>()(
  persist(
    (set, get) => ({
      completions: [],
      recommendedWorkoutIds: [],
      recommendationSourceId: null,

      logCompletion: (entry) => {
        const completion: MobilityCompletion = {
          id: `mob_${entry.workoutId}_${Date.now()}`,
          ...entry,
        };
        set(state => ({ completions: [...state.completions, completion] }));
        useActivityStore.getState().addActivity(
          activityFromMobilityCompletion(completion, false),
        );
      },

      deleteCompletion: (id) => {
        set(state => ({ completions: state.completions.filter(c => c.id !== id) }));
        useActivityStore.getState().removeActivity(`activity_mobility_${id}`);
      },

      resetMobility: () => {
        for (const completion of get().completions) {
          useActivityStore.getState().removeActivity(`activity_mobility_${completion.id}`);
        }
        set({ completions: [], recommendedWorkoutIds: [], recommendationSourceId: null });
      },

      setRecommendedWorkouts: (ids, sourceAnalysisId) => {
        set({ recommendedWorkoutIds: ids, recommendationSourceId: sourceAnalysisId ?? null });
      },
    }),
    {
      name: 'mobility-store',
      storage: createAppJSONStorage(),
      partialize: (state) => ({
        completions: state.completions,
        recommendedWorkoutIds: state.recommendedWorkoutIds,
        recommendationSourceId: state.recommendationSourceId,
      }),
    },
  ),
);

// ─── Selectors ─────────────────────────────────────────────────────────────────

export function completionsForWorkout(completions: MobilityCompletion[], workoutId: string): MobilityCompletion[] {
  return completions.filter(c => c.workoutId === workoutId);
}

export function weeklyCompletionCount(completions: MobilityCompletion[], now: number = Date.now()): number {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = now - weekMs;
  return completions.filter(c => c.completedAt >= cutoff).length;
}

export function lastCompletedAt(completions: MobilityCompletion[], workoutId: string): number | null {
  const forWorkout = completionsForWorkout(completions, workoutId);
  if (forWorkout.length === 0) return null;
  return Math.max(...forWorkout.map(c => c.completedAt));
}
