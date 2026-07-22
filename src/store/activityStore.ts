import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Activity, ActivityDraft } from '../types/activity';
import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { MobilityCompletion } from '../types/mobility';
import { calculateActivityLoad, sanitizeActivityMetrics } from '../utils/activityLoad';
import {
  migrateLegacyMobilityHistory,
  migrateLegacyStrengthHistory,
  migrateLegacyWorkoutHistory,
} from '../utils/activityMigration';

export const ACTIVITY_STORE_SCHEMA_VERSION = 1;

type ActivityStore = {
  schemaVersion: number;
  activities: Activity[];
  hydrationStatus: 'loading' | 'ready' | 'error';
  addActivity: (input: Activity | ActivityDraft) => string;
  updateActivity: (id: string, patch: Partial<Activity>) => void;
  removeActivity: (id: string) => void;
  getById: (id: string) => Activity | undefined;
  importLegacyWorkouts: (records: CompletedWorkoutRecord[]) => void;
  importLegacyStrength: (records: StrengthLogRecord[]) => void;
  importLegacyMobility: (records: MobilityCompletion[]) => void;
  setHydrationStatus: (status: ActivityStore['hydrationStatus']) => void;
};

function uid(now = Date.now()): string {
  return `activity_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeActivity(input: Activity | ActivityDraft, now = Date.now()): Activity {
  const durationMinutes = Math.max(0, (input.metrics.durationSeconds ?? 0) / 60);
  const trainingLoad = input.trainingLoad ?? calculateActivityLoad({
    activityType: input.activityType,
    durationMinutes,
    rpe: input.rpe,
    heartRateZoneMinutes: input.metrics.heartRateZoneSeconds
      ? Object.fromEntries(
          Object.entries(input.metrics.heartRateZoneSeconds)
            .map(([zone, seconds]) => [zone, (seconds ?? 0) / 60]),
        )
      : undefined,
  });

  return {
    ...input,
    id: input.id ?? uid(now),
    metrics: sanitizeActivityMetrics(input.activityType, input.metrics),
    trainingLoad,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function migrateActivityStoreState(persisted: unknown): Pick<ActivityStore, 'schemaVersion' | 'activities'> {
  const source = (persisted ?? {}) as Partial<ActivityStore>;
  return {
    schemaVersion: ACTIVITY_STORE_SCHEMA_VERSION,
    activities: Array.isArray(source.activities)
      ? source.activities.map(activity => normalizeActivity(activity, activity.updatedAt ?? Date.now()))
      : [],
  };
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set, get) => ({
      schemaVersion: ACTIVITY_STORE_SCHEMA_VERSION,
      activities: [],
      hydrationStatus: 'loading',

      addActivity: (input) => {
        const activity = normalizeActivity(input);
        set(state => {
          const existingIndex = state.activities.findIndex(item => item.id === activity.id);
          if (existingIndex < 0) {
            if (activity.scheduledSessionId) {
              const linkedIndex = state.activities.findIndex(item => item.scheduledSessionId === activity.scheduledSessionId);
              if (linkedIndex >= 0) {
                return {
                  activities: state.activities.map(item => item.scheduledSessionId === activity.scheduledSessionId
                    ? { ...activity, id: item.id, createdAt: item.createdAt, updatedAt: Date.now() }
                    : item),
                };
              }
            }
            return { activities: [...state.activities, activity] };
          }
          return {
            activities: state.activities.map(item => item.id === activity.id ? activity : item),
          };
        });
        return get().activities.find(item => item.scheduledSessionId && item.scheduledSessionId === activity.scheduledSessionId)?.id
          ?? activity.id;
      },

      updateActivity: (id, patch) =>
        set(state => ({
          activities: state.activities.map(activity => {
            if (activity.id !== id) return activity;
            const next = { ...activity, ...patch, id, updatedAt: Date.now() };
            const shouldRecalculateLoad = patch.activityType !== undefined
              || patch.metrics !== undefined
              || patch.rpe !== undefined;
            return normalizeActivity({
              ...next,
              trainingLoad: patch.trainingLoad
                ?? (shouldRecalculateLoad ? undefined : activity.trainingLoad),
            }, next.updatedAt);
          }),
        })),

      removeActivity: (id) =>
        set(state => ({ activities: state.activities.filter(activity => activity.id !== id) })),

      getById: (id) => get().activities.find(activity => activity.id === id),

      importLegacyWorkouts: (records) =>
        set(state => ({
          activities: migrateLegacyWorkoutHistory(records, state.activities),
        })),

      importLegacyStrength: records =>
        set(state => ({
          activities: migrateLegacyStrengthHistory(records, state.activities),
        })),

      importLegacyMobility: records =>
        set(state => ({
          activities: migrateLegacyMobilityHistory(records, state.activities),
        })),

      setHydrationStatus: hydrationStatus => set({ hydrationStatus }),
    }),
    {
      name: 'activity-store',
      version: ACTIVITY_STORE_SCHEMA_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        schemaVersion: state.schemaVersion,
        activities: state.activities,
      }),
      migrate: persisted => migrateActivityStoreState(persisted),
      merge: (persisted, current) => ({
        ...current,
        ...migrateActivityStoreState(persisted),
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('Activity store hydration failed', error);
          useActivityStore.getState().setHydrationStatus('error');
          return;
        }
        if (!state) {
          useActivityStore.getState().setHydrationStatus('error');
          return;
        }
        // Build 36/37 stored completed running workouts separately. Read that
        // persisted snapshot after this store hydrates, then project it with
        // stable IDs. Repeating this on every launch is safe and idempotent.
        Promise.allSettled([
          AsyncStorage.getItem('workout-store').then(raw => {
            if (!raw) return;
            const parsed = JSON.parse(raw) as {
              state?: { history?: CompletedWorkoutRecord[] };
            };
            if (Array.isArray(parsed.state?.history)) {
              state.importLegacyWorkouts(parsed.state.history);
            }
          }),
          AsyncStorage.getItem('strength-store').then(raw => {
            if (!raw) return;
            const parsed = JSON.parse(raw) as {
              state?: { history?: StrengthLogRecord[] };
            };
            if (Array.isArray(parsed.state?.history)) {
              state.importLegacyStrength(parsed.state.history);
            }
          }),
          AsyncStorage.getItem('mobility-store').then(raw => {
            if (!raw) return;
            const parsed = JSON.parse(raw) as {
              state?: { completions?: MobilityCompletion[] };
            };
            if (Array.isArray(parsed.state?.completions)) {
              state.importLegacyMobility(parsed.state.completions);
            }
          }),
        ]).then(results => {
          results.forEach(result => {
            if (result.status === 'rejected') {
              console.warn('Activity legacy migration failed', result.reason);
            }
          });
          state.setHydrationStatus('ready');
        });
      },
    },
  ),
);
