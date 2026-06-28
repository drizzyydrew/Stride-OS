import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CompletedWorkoutRecord, Workout, WorkoutIntensity, WorkoutType } from '../types/training';
import { calculateTrainingLoad } from '../utils/training';
import { calculateUpdatedFatigue } from '../utils/calculateFatigue';
import { estimateDistanceMiles } from '../utils/historyUtils';
import { syncWorkoutLog, deleteWorkoutLog } from '../lib/syncService';
import { syncCompletedWorkoutToExternalServices } from '../lib/externalIntegrations';

const DAY_MS = 24 * 60 * 60 * 1000;

const EASY_INTENSITIES: WorkoutIntensity[] = ['easy', 'very_easy'];

// Derive WorkoutIntensity from a 1–10 RPE value
function rpeToIntensity(rpe: number): WorkoutIntensity {
  if (rpe <= 2) return 'very_easy';
  if (rpe <= 4) return 'easy';
  if (rpe <= 6) return 'moderate';
  if (rpe <= 8) return 'hard';
  return 'max';
}

type LogEdits = Partial<Pick<CompletedWorkoutRecord,
  'actualDurationMinutes' | 'actualDistanceMiles' | 'rpe' | 'notes'>>;

type ManualLogEntry = {
  completionKey: string;
  type:          WorkoutType;
  intensity:     WorkoutIntensity;
  durationMinutes: number;
  distanceMiles:   number;
  rpe?:            number;
  notes?:          string;
};

type WorkoutStore = {
  completedWorkouts: string[];
  history:           CompletedWorkoutRecord[];

  completeWorkout: (
    completionKey:    string,
    workout:          Workout,
    currentWeek:      number,
    currentFatigue:   number,
    currentRecovery:  number,
    setFatigueScore:   (score: number) => void,
    setRecentEasyLoad: (load: number)  => void,
  ) => void;

  skipWorkout: (
    completionKey:    string,
    workout:          Workout,
    currentWeek:      number,
    currentFatigue:   number,
    currentRecovery:  number,
    setFatigueScore:   (score: number) => void,
    setRecentEasyLoad: (load: number)  => void,
    reason?:           string,
  ) => void;

  editLog:    (id: string, updates: LogEdits)        => void;
  deleteLog:  (id: string)                           => void;
  hydrateWorkouts: (records: CompletedWorkoutRecord[]) => void;
  manualLog:  (
    entry:            ManualLogEntry,
    currentWeek:      number,
    currentFatigue:   number,
    currentRecovery:  number,
    setFatigueScore:   (score: number) => void,
    setRecentEasyLoad: (load: number)  => void,
  ) => void;
};

// Backfill fields added after the initial schema so existing AsyncStorage records
// don't produce undefined access at runtime.
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
    // Optional extended fields — preserved if present
    actualDurationMinutes: r.actualDurationMinutes,
    actualDistanceMiles:   r.actualDistanceMiles,
    rpe:                   r.rpe,
    notes:                 r.notes,
    source:                r.source,
    skipped:               r.skipped,
    skippedReason:         r.skippedReason,
  };
}

// Shared helper: computes load, fatigue delta, recovery delta, and easy load
// given workout parameters. Returns the record fields and side-effect values.
function computeLoadFields(
  durationMinutes: number,
  intensity:       WorkoutIntensity,
  currentFatigue:  number,
  history:         CompletedWorkoutRecord[],
  workoutType:     WorkoutType,
): {
  estimatedLoad:          number;
  estimatedDistanceMiles: number;
  fatigueAfter:           number;
  fatigueDelta:           number;
  recoveryDelta:          number;
  newEasyLoad:            number;
} {
  const estimatedLoad = calculateTrainingLoad(durationMinutes, intensity);

  const fatigueAfter = calculateUpdatedFatigue({
    currentFatigue,
    estimatedLoad,
    workoutType,
    intensity,
    history,
  });
  const fatigueDelta  = fatigueAfter - currentFatigue;
  const recoveryDelta = Math.round(-fatigueDelta * 0.30);

  const sevenDaysAgo  = Date.now() - 7 * DAY_MS;
  const priorEasyLoad = history
    .filter(r => r.timestamp >= sevenDaysAgo && EASY_INTENSITIES.includes(r.intensity))
    .reduce((s, r) => s + r.estimatedLoad, 0);
  const thisEasyLoad  = EASY_INTENSITIES.includes(intensity) ? estimatedLoad : 0;
  const newEasyLoad   = priorEasyLoad + thisEasyLoad;

  return {
    estimatedLoad,
    estimatedDistanceMiles: estimateDistanceMiles(durationMinutes, intensity),
    fatigueAfter,
    fatigueDelta,
    recoveryDelta,
    newEasyLoad,
  };
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      completedWorkouts: [],
      history:           [],

      // ── Complete (planned) ────────────────────────────────────────────────────

      completeWorkout: (
        completionKey, workout, currentWeek,
        currentFatigue, currentRecovery,
        setFatigueScore, setRecentEasyLoad,
      ) => {
        if (get().completedWorkouts.includes(completionKey)) return;

        const history = get().history;
        const { estimatedLoad, estimatedDistanceMiles, fatigueAfter, fatigueDelta, recoveryDelta, newEasyLoad } =
          computeLoadFields(workout.durationMinutes, workout.intensity, currentFatigue, history, workout.type);

        const record: CompletedWorkoutRecord = {
          id:                     completionKey,
          workoutId:              workout.id,
          type:                   workout.type,
          intensity:              workout.intensity,
          durationMinutes:        workout.durationMinutes,
          estimatedLoad,
          estimatedDistanceMiles,
          timestamp:              Date.now(),
          week:                   currentWeek,
          completed:              true,
          fatigueBefore:          currentFatigue,
          fatigueAfter,
          fatigueDelta,
          recoveryBefore:         currentRecovery,
          recoveryDelta,
          source:                 'generated',
        };

        setRecentEasyLoad(newEasyLoad);
        setFatigueScore(fatigueAfter);

        set(state => ({
          completedWorkouts: [...state.completedWorkouts, completionKey],
          history:           [...state.history, record],
        }));

        syncWorkoutLog(record).catch(console.warn);
        syncCompletedWorkoutToExternalServices(record).catch(console.warn);
      },

      // ── Skip ─────────────────────────────────────────────────────────────────

      skipWorkout: (
        completionKey, workout, currentWeek,
        currentFatigue, currentRecovery,
        setFatigueScore, setRecentEasyLoad,
        reason,
      ) => {
        if (get().completedWorkouts.includes(completionKey)) return;

        // Skipping = rest effect: no additional fatigue, slight recovery delta
        const recoveryDelta = 2;

        const record: CompletedWorkoutRecord = {
          id:                     completionKey,
          workoutId:              workout.id,
          type:                   workout.type,
          intensity:              workout.intensity,
          durationMinutes:        0,
          estimatedLoad:          0,
          estimatedDistanceMiles: 0,
          timestamp:              Date.now(),
          week:                   currentWeek,
          completed:              true,
          fatigueBefore:          currentFatigue,
          fatigueAfter:           currentFatigue,
          fatigueDelta:           0,
          recoveryBefore:         currentRecovery,
          recoveryDelta,
          source:                 'generated',
          skipped:                true,
          skippedReason:          reason,
        };

        set(state => ({
          completedWorkouts: [...state.completedWorkouts, completionKey],
          history:           [...state.history, record],
        }));

        syncWorkoutLog(record).catch(console.warn);
      },

      // ── Edit a logged record ──────────────────────────────────────────────────

      editLog: (id, updates) => {
        set(state => ({
          history: state.history.map(r =>
            r.id === id ? { ...r, ...updates } : r,
          ),
        }));
      },

      // ── Delete a logged record ────────────────────────────────────────────────

      deleteLog: (id) => {
        set(state => ({
          completedWorkouts: state.completedWorkouts.filter(k => k !== id),
          history:           state.history.filter(r => r.id !== id),
        }));
        deleteWorkoutLog(id).catch(console.warn);
      },

      // ── Hydrate from Supabase ─────────────────────────────────────────────────

      hydrateWorkouts: (records) => {
        set(state => {
          const existingIds = new Set(state.completedWorkouts);
          const newRecords  = records.filter(r => !existingIds.has(r.id)).map(migrateRecord);
          if (newRecords.length === 0) return state;
          return {
            completedWorkouts: [...state.completedWorkouts, ...newRecords.map(r => r.id)],
            history:           [...state.history, ...newRecords],
          };
        });
      },

      // ── Manual log ────────────────────────────────────────────────────────────

      manualLog: (
        entry, currentWeek, currentFatigue, currentRecovery,
        setFatigueScore, setRecentEasyLoad,
      ) => {
        if (get().completedWorkouts.includes(entry.completionKey)) return;

        const intensity = entry.rpe !== undefined
          ? rpeToIntensity(entry.rpe) : entry.intensity;

        const history = get().history;
        const { estimatedLoad, fatigueAfter, fatigueDelta, recoveryDelta, newEasyLoad } =
          computeLoadFields(entry.durationMinutes, intensity, currentFatigue, history, entry.type);

        const record: CompletedWorkoutRecord = {
          id:                     entry.completionKey,
          workoutId:              entry.type,
          type:                   entry.type,
          intensity,
          durationMinutes:        entry.durationMinutes,
          estimatedLoad,
          estimatedDistanceMiles: entry.distanceMiles,
          timestamp:              Date.now(),
          week:                   currentWeek,
          completed:              true,
          fatigueBefore:          currentFatigue,
          fatigueAfter,
          fatigueDelta,
          recoveryBefore:         currentRecovery,
          recoveryDelta,
          actualDurationMinutes:  entry.durationMinutes,
          actualDistanceMiles:    entry.distanceMiles,
          rpe:                    entry.rpe,
          notes:                  entry.notes,
          source:                 'manual',
        };

        setRecentEasyLoad(newEasyLoad);
        setFatigueScore(fatigueAfter);

        set(state => ({
          completedWorkouts: [...state.completedWorkouts, entry.completionKey],
          history:           [...state.history, record],
        }));

        syncWorkoutLog(record).catch(console.warn);
        syncCompletedWorkoutToExternalServices(record).catch(console.warn);
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
