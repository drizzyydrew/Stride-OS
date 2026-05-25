import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CompletedWorkoutRecord, Workout, WorkoutIntensity } from '../types/training';
import { calculateTrainingLoad } from '../utils/training';
import { calculateUpdatedFatigue } from '../utils/calculateFatigue';
import { estimateDistanceMiles } from '../utils/historyUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

const EASY_INTENSITIES: WorkoutIntensity[] = ['easy', 'very_easy'];

type WorkoutStore = {
  // Week-scoped completion IDs: "w{week}_{workoutId}_{index}".
  completedWorkouts: string[];

  // Full ordered history of every logged workout.
  history: CompletedWorkoutRecord[];

  completeWorkout: (
    completionKey:    string,
    workout:          Workout,
    currentWeek:      number,
    currentFatigue:   number,
    currentRecovery:  number,
    // Callbacks into athleteStore — avoids circular store imports.
    setFatigueScore:   (score: number) => void,
    setRecentEasyLoad: (load: number)  => void,
  ) => void;
};

// Backfill fields added after the initial schema so existing AsyncStorage records
// don't produce undefined access at runtime. Safe to call on every rehydration —
// records that already have the fields are untouched (spread order).
function migrateRecord(r: Partial<CompletedWorkoutRecord>): CompletedWorkoutRecord {
  const intensity = (r.intensity ?? 'easy') as WorkoutIntensity;
  return {
    id:                     r.id                     ?? '',
    workoutId:              r.workoutId              ?? '',
    type:                   r.type                   ?? 'easy_run',
    intensity,
    durationMinutes:        r.durationMinutes        ?? 0,
    estimatedLoad:          r.estimatedLoad          ?? 0,
    estimatedDistanceMiles: r.estimatedDistanceMiles ?? estimateDistanceMiles(r.durationMinutes ?? 0, intensity),
    timestamp:              r.timestamp              ?? 0,
    week:                   r.week                   ?? 1,
    completed:              true,
    fatigueBefore:          r.fatigueBefore          ?? 0,
    fatigueAfter:           r.fatigueAfter           ?? 0,
    fatigueDelta:           r.fatigueDelta           ?? 0,
    recoveryBefore:         r.recoveryBefore         ?? 0,
    recoveryDelta:          r.recoveryDelta          ?? 0,
  };
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      completedWorkouts: [],
      history:           [],

      completeWorkout: (
        completionKey,
        workout,
        currentWeek,
        currentFatigue,
        currentRecovery,
        setFatigueScore,
        setRecentEasyLoad,
      ) => {
        if (get().completedWorkouts.includes(completionKey)) return;

        const currentHistory = get().history;

        const estimatedLoad = calculateTrainingLoad(
          workout.durationMinutes,
          workout.intensity,
        );

        // ── Fatigue ───────────────────────────────────────────────────────────
        const fatigueAfter = calculateUpdatedFatigue({
          currentFatigue,
          estimatedLoad,
          workoutType: workout.type,
          intensity:   workout.intensity,
          history:     currentHistory,
        });
        const fatigueDelta = fatigueAfter - currentFatigue;

        // ── Recovery delta ────────────────────────────────────────────────────
        // Approximates the workout's contribution to recovery change using the
        // fatigue drag coefficient (0.30) from calculateRecoveryScore.
        // The actual recovery after this workout is set by athleteStore.recalculateRecovery;
        // this delta captures only the load-driven portion, not sleep/HR changes.
        const recoveryDelta = Math.round(-fatigueDelta * 0.30);

        // ── 7-day easy load ───────────────────────────────────────────────────
        const sevenDaysAgo  = Date.now() - 7 * DAY_MS;
        const priorEasyLoad = currentHistory
          .filter(r => r.timestamp >= sevenDaysAgo && EASY_INTENSITIES.includes(r.intensity))
          .reduce((s, r) => s + r.estimatedLoad, 0);
        const thisEasyLoad = EASY_INTENSITIES.includes(workout.intensity) ? estimatedLoad : 0;
        const newEasyLoad  = priorEasyLoad + thisEasyLoad;

        // ── Build record ──────────────────────────────────────────────────────
        const record: CompletedWorkoutRecord = {
          id:                     completionKey,
          workoutId:              workout.id,
          type:                   workout.type,
          intensity:              workout.intensity,
          durationMinutes:        workout.durationMinutes,
          estimatedLoad,
          estimatedDistanceMiles: estimateDistanceMiles(workout.durationMinutes, workout.intensity),
          timestamp:              Date.now(),
          week:                   currentWeek,
          completed:              true,
          fatigueBefore:          currentFatigue,
          fatigueAfter,
          fatigueDelta,
          recoveryBefore:         currentRecovery,
          recoveryDelta,
        };

        // Order matters: easy load must land in athleteStore before setFatigueScore
        // triggers recalculateRecovery so the bonus is already in place.
        setRecentEasyLoad(newEasyLoad);
        setFatigueScore(fatigueAfter);

        set((state) => ({
          completedWorkouts: [...state.completedWorkouts, completionKey],
          history:           [...state.history, record],
        }));
      },
    }),
    {
      name:       'workout-store',
      storage:    createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        completedWorkouts: state.completedWorkouts,
        history:           state.history,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.history = state.history.map(migrateRecord);
        }
      },
    },
  ),
);
