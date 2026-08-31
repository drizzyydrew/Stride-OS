import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage, getAppStorage } from './persistStorage';

import type { Activity, ActivityDraft } from '../types/activity';
import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { MobilityCompletion } from '../types/mobility';
import { calculateActivityLoad, sanitizeActivityMetrics } from '../utils/activityLoad';
import {
  migrateLegacyMobilityHistory,
  migrateLegacyStrengthHistory,
  migrateLegacyWorkoutHistory,
  remapLegacyScheduledSessionIds,
} from '../utils/activityMigration';
import { runRecalculation } from '../lib/recalculation';

export const ACTIVITY_STORE_SCHEMA_VERSION = 3;

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

function healthKitDuplicateIndex(activities: readonly Activity[], activity: Activity): number {
  const metadata = activity.healthKit;
  if (!metadata) return -1;
  return activities.findIndex(item => {
    if (
      item.healthKit?.workoutUuid === metadata.workoutUuid &&
      item.healthKit.sourceBundleIdentifier === metadata.sourceBundleIdentifier
    ) return true;
    return metadata.importedByStrideOS
      && item.source === 'tracked'
      && Math.abs(item.startTime - metadata.originalStartTime) < 30_000
      && Math.abs((item.endTime ?? item.startTime) - metadata.originalEndTime) < 30_000;
  });
}

function liveTrackedDuplicateIndex(activities: readonly Activity[], activity: Activity): number {
  const liveNote = activity.notes?.startsWith('Saved from live GPS tracking')
    || activity.notes?.startsWith('Saved from indoor treadmill run');
  if (!liveNote || activity.activityType !== 'running') return -1;
  const duration = activity.metrics.durationSeconds ?? 0;
  const distance = activity.metrics.distanceMeters ?? 0;
  return activities.findIndex(item => {
    const itemLiveNote = item.notes?.startsWith('Saved from live GPS tracking')
      || item.notes?.startsWith('Saved from indoor treadmill run');
    if (!itemLiveNote || item.activityType !== activity.activityType || item.subtype !== activity.subtype) return false;
    return Math.abs(item.startTime - activity.startTime) <= 120_000
      && Math.abs((item.metrics.durationSeconds ?? 0) - duration) <= 60
      && Math.abs((item.metrics.distanceMeters ?? 0) - distance) <= 50;
  });
}

export function migrateActivityStoreState(persisted: unknown): Pick<ActivityStore, 'schemaVersion' | 'activities'> {
  const source = (persisted ?? {}) as Partial<ActivityStore>;
  const normalized = Array.isArray(source.activities)
    ? source.activities.map(activity => normalizeActivity(activity, activity.updatedAt ?? Date.now()))
    : [];
  // v1 → v2: remap bare-id scheduledSessionId values written before the
  // canonical id fix to the same `week:${date}:...` form scheduledSessions.ts
  // derives. Runs unconditionally (not just when persistedVersion === 1)
  // because `merge` calls this same function on every hydration regardless
  // of version — the remap is idempotent (see remapLegacyScheduledSessionId)
  // so that's safe and keeps already-migrated installs correct too.
  return {
    schemaVersion: ACTIVITY_STORE_SCHEMA_VERSION,
    activities: remapLegacyScheduledSessionIds(normalized),
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
        let savedActivityId = activity.id;
        set(state => {
          const existingIndex = state.activities.findIndex(item => item.id === activity.id);
          if (existingIndex < 0) {
            const healthKitIndex = healthKitDuplicateIndex(state.activities, activity);
            if (healthKitIndex >= 0) {
              savedActivityId = state.activities[healthKitIndex]?.id ?? activity.id;
              return {
                activities: state.activities.map((item, index) => index === healthKitIndex
                  ? { ...item, ...activity, id: item.id, createdAt: item.createdAt, updatedAt: Date.now() }
                  : item),
              };
            }
            const liveDuplicateIndex = liveTrackedDuplicateIndex(state.activities, activity);
            if (liveDuplicateIndex >= 0) {
              savedActivityId = state.activities[liveDuplicateIndex]?.id ?? activity.id;
              return {
                activities: state.activities.map((item, index) => index === liveDuplicateIndex
                  ? { ...item, ...activity, id: item.id, createdAt: item.createdAt, updatedAt: Date.now() }
                  : item),
              };
            }
            if (activity.scheduledSessionId) {
              const linkedIndex = state.activities.findIndex(item => item.scheduledSessionId === activity.scheduledSessionId);
              if (linkedIndex >= 0) {
                savedActivityId = state.activities[linkedIndex]?.id ?? activity.id;
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
        // After state settles — synchronous, no dangling promise.
        runRecalculation('activity_added', get().activities);
        return get().activities.find(item => item.scheduledSessionId && item.scheduledSessionId === activity.scheduledSessionId)?.id
          ?? savedActivityId;
      },

      updateActivity: (id, patch) => {
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
        }));
        runRecalculation('activity_updated', get().activities);
      },

      removeActivity: (id) => {
        set(state => ({ activities: state.activities.filter(activity => activity.id !== id) }));
        runRecalculation('activity_removed', get().activities);
      },

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
      storage: createAppJSONStorage(),
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
        const storage = getAppStorage();
        Promise.allSettled([
          Promise.resolve(storage.getItem('workout-store')).then((raw: string | null) => {
            if (!raw) return;
            const parsed = JSON.parse(raw) as {
              state?: { history?: CompletedWorkoutRecord[] };
            };
            if (Array.isArray(parsed.state?.history)) {
              state.importLegacyWorkouts(parsed.state.history);
            }
          }),
          Promise.resolve(storage.getItem('strength-store')).then((raw: string | null) => {
            if (!raw) return;
            const parsed = JSON.parse(raw) as {
              state?: { history?: StrengthLogRecord[] };
            };
            if (Array.isArray(parsed.state?.history)) {
              state.importLegacyStrength(parsed.state.history);
            }
          }),
          Promise.resolve(storage.getItem('mobility-store')).then((raw: string | null) => {
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
