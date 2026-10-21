import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage, getAppStorage } from './persistStorage';

import type { Activity, ActivityDraft, HealthKitDistanceEvidence } from '../types/activity';
import { mergeHealthDistanceEvidence, type HealthDistanceLink } from '../utils/healthDistanceRefresh';
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
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from '../lib/localDataOwner';
import { mergeRecording, sameRecording } from '../utils/runCompletionIdentity';
import { waitForPersistedStoreHydration } from '../lib/trackingTaskHydration';

export const ACTIVITY_STORE_SCHEMA_VERSION = 3;

type ActivityStore = {
  schemaVersion: number;
  activities: Activity[];
  hydrationStatus: 'loading' | 'ready' | 'error';
  addActivity: (input: Activity | ActivityDraft) => string;
  /** Caller journals the first End before invoking this; resolves only after durable history readback. */
  addActivityAndPersist: (input: Activity | ActivityDraft, lease: OwnerLease, options?: { isCurrent?: () => boolean; onlyIfMissing?: boolean }) => Promise<string>;
  awaitPersistence: (lease: OwnerLease) => Promise<void>;
  refreshHealthDistanceAndPersist: (id: string, evidence: HealthKitDistanceEvidence, lease: OwnerLease,
    options: { isCurrent: () => boolean; workoutInstanceId?: string; link?: HealthDistanceLink }) => Promise<void>;
  updateActivity: (id: string, patch: Partial<Activity>) => void;
  removeActivity: (id: string) => void;
  getById: (id: string) => Activity | undefined;
  importLegacyWorkouts: (records: CompletedWorkoutRecord[]) => void;
  importLegacyStrength: (records: StrengthLogRecord[]) => void;
  importLegacyMobility: (records: MobilityCompletion[]) => void;
  setHydrationStatus: (status: ActivityStore['hydrationStatus']) => void;
  /** Adds activities whose ids aren't already present (never overwrites or deletes). */
  mergeRestoredActivities: (records: readonly Activity[]) => number;
};

let activityWriteQueue: Promise<unknown> = Promise.resolve();
let activityRemovalRevision = 0;
export function getActivityRemovalRevision() { return activityRemovalRevision; }
function serializeActivityWrite<T>(action: () => T | Promise<T>): Promise<T> {
  const write = activityWriteQueue.then(action);
  activityWriteQueue = write.catch(() => undefined);
  return write;
}

// Explicit commits share ordering with every normal middleware write.
const activityJSONStorage = createAppJSONStorage();
const activityStorage: typeof activityJSONStorage = activityJSONStorage && {
  ...activityJSONStorage,
  setItem: (name, value) => serializeActivityWrite(() => activityJSONStorage.setItem(name, value)),
  removeItem: name => serializeActivityWrite(() => activityJSONStorage.removeItem(name)),
};
let activityCommitQueue: Promise<unknown> = Promise.resolve();
function serializeActivityCommit<T>(action: () => Promise<T>): Promise<T> {
  const commit = activityCommitQueue.then(action);
  activityCommitQueue = commit.catch(() => undefined);
  return commit;
}

function requireActivityOwner(lease: OwnerLease) {
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed before activity persistence completed');
}

async function waitForActivityHistory(lease: OwnerLease) {
  requireActivityOwner(lease);
  const hydrated = await waitForPersistedStoreHydration(useActivityStore);
  requireActivityOwner(lease);
  if (!hydrated) throw new Error('Activity history is not yet readable; retry after unlocking the device');
  if (useActivityStore.getState().hydrationStatus === 'loading') {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new Error('Activity history migration is not yet ready')); }, 2_000);
      const unsubscribe = useActivityStore.subscribe(state => {
        if (state.hydrationStatus === 'loading') return;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      });
      if (useActivityStore.getState().hydrationStatus !== 'loading') {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  }
  requireActivityOwner(lease);
  if (useActivityStore.getState().hydrationStatus !== 'ready') throw new Error('Activity history could not be loaded safely');
}

async function flushActivityHistory(lease: OwnerLease) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const committed = await serializeActivityWrite(async () => {
      requireActivityOwner(lease);
      const state = useActivityStore.getState();
      const encoded = JSON.stringify({ state: { schemaVersion: state.schemaVersion, activities: state.activities }, version: ACTIVITY_STORE_SCHEMA_VERSION });
      const storage = getAppStorage();
      await storage.setItem('activity-store', encoded);
      requireActivityOwner(lease);
      // Hydration retries locked reads; a commit must surface a failed confirmation.
      const saved = await (storage.getItemOnce ? storage.getItemOnce('activity-store') : storage.getItem('activity-store'));
      requireActivityOwner(lease);
      if (saved !== encoded) throw new Error('Activity history persistence could not be confirmed');
      return state;
    });
    requireActivityOwner(lease);
    const current = useActivityStore.getState();
    // Immutable history references act as revisions; retry behind queued edits.
    if (current.activities === committed.activities && current.schemaVersion === committed.schemaVersion) return;
  }
  throw new Error('Activity history kept changing during persistence; retry saving it');
}

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

      addActivityAndPersist: (input, lease, options) => {
        const snapshot = JSON.parse(JSON.stringify(input)) as Activity | ActivityDraft;
        const owner = { ...lease };
        const isCurrent = options?.isCurrent ?? (() => true);
        return serializeActivityCommit(async () => {
          await waitForActivityHistory(owner);
          if (!isCurrent()) throw new Error('Activity history changed before recovery completed; retry if you still want to restore it');
          if (!snapshot.id && !snapshot.workoutInstanceId) throw new Error('A durable activity requires a stable ID or recording instance');
          const existing = options?.onlyIfMissing
            ? get().activities.filter(activity => sameRecording(activity, snapshot as Activity)) : [];
          if (existing.length > 1) throw new Error('More than one saved activity matches this recording. No activity was replaced.');
          const id = existing[0]?.id ?? get().addActivity(snapshot);
          await flushActivityHistory(owner);
          requireActivityOwner(owner);
          if (!isCurrent()) throw new Error('Activity history changed during recovery; saved history has not been cleared');
          return id;
        });
      },

      awaitPersistence: lease => serializeActivityCommit(async () => {
        await waitForActivityHistory(lease);
        await flushActivityHistory(lease);
        requireActivityOwner(lease);
      }),

      refreshHealthDistanceAndPersist: (id, evidence, lease, options) => {
        const snapshot = JSON.parse(JSON.stringify(evidence)) as HealthKitDistanceEvidence;
        const selectedLink = options.link ? JSON.parse(JSON.stringify(options.link)) as HealthDistanceLink : undefined;
        const instanceId = options.workoutInstanceId;
        const removalRevision = activityRemovalRevision;
        const requireCurrent = () => {
          requireActivityOwner(lease);
          if (!options.isCurrent() || removalRevision !== activityRemovalRevision) throw new Error('Health refresh is not confirmed. Reopen this activity to retry.');
          const rows = get().activities.filter(row => row.id === id);
          if (rows.length !== 1) throw new Error('This activity is missing or ambiguous. No new activity was created.');
          const row = rows[0]!;
          mergeHealthDistanceEvidence(row, snapshot, instanceId, selectedLink);
          const rowClaims = [row.workoutInstanceId, row.healthKit?.workoutInstanceId, instanceId, selectedLink?.metadata.workoutInstanceId]
            .filter((claim): claim is string => typeof claim === 'string' && claim.trim().length > 0);
          const activityClaims = [id, selectedLink?.metadata.strideOSActivityId, row.healthKit?.strideOSActivityId]
            .filter((claim): claim is string => typeof claim === 'string' && claim.trim().length > 0);
          const workoutClaims = [row.legacyWorkoutId, selectedLink?.metadata.strideOSWorkoutId, row.healthKit?.strideOSWorkoutId]
            .filter((claim): claim is string => typeof claim === 'string' && claim.trim().length > 0);
          const claims = get().activities.filter(other => other.id !== id && (
            other.healthKit?.workoutUuid === snapshot.workoutUuid && other.healthKit?.sourceBundleIdentifier === snapshot.sourceBundleIdentifier
            || [other.workoutInstanceId, other.healthKit?.workoutInstanceId].some(claim => claim != null && rowClaims.includes(claim))
            || [other.id, other.healthKit?.strideOSActivityId].some(claim => claim != null && activityClaims.includes(claim))
            || [other.legacyWorkoutId, other.healthKit?.strideOSWorkoutId].some(claim => claim != null && workoutClaims.includes(claim))));
          if (claims.length) throw new Error('More than one activity claims this Health workout. Nothing was replaced.');
          return row;
        };
        return serializeActivityCommit(async () => {
          await waitForActivityHistory(lease);
          const row = requireCurrent();
          const next = mergeHealthDistanceEvidence(row, snapshot, instanceId, selectedLink);
          set(state => ({ activities: state.activities.map(activity => activity === row ? next : activity) }));
          await flushActivityHistory(lease);
          const saved = requireCurrent();
          if (JSON.stringify(saved.metrics.healthKitDistance) !== JSON.stringify(snapshot)) throw new Error('Health distance saving could not be confirmed. Retry refresh.');
        });
      },

      mergeRestoredActivities: (records) => {
        if (!captureOwnerLease()) throw new Error('Local history is locked until its owner is confirmed');
        let added = 0;
        set(state => {
          const merged = [...state.activities];
          for (const record of records) {
            if (!record || typeof record.id !== 'string') continue;
            const incoming = normalizeActivity(record, record.updatedAt ?? Date.now());
            const index = merged.findIndex(item => sameRecording(item, incoming));
            if (index < 0) { merged.push(incoming); added += 1; }
          }
          merged.sort((a, b) => b.startTime - a.startTime);
          return { activities: remapLegacyScheduledSessionIds(merged) };
        });
        return added;
      },

      addActivity: (input) => {
        if (!captureOwnerLease()) throw new Error('Local history is locked until its owner is confirmed');
        const activity = normalizeActivity(input);
        let savedActivityId = activity.id;
        set(state => {
          const existingIndex = state.activities.findIndex(item => item.id === activity.id);
          if (existingIndex < 0) {
            const recordingIndex = state.activities.findIndex(item => sameRecording(item, activity));
            if (recordingIndex >= 0) {
              savedActivityId = state.activities[recordingIndex].id;
              return { activities: state.activities.map((item, index) => index === recordingIndex
                ? mergeRecording(item, activity) : item) };
            }
            return { activities: [...state.activities, activity] };
          }
          return {
            activities: state.activities.map(item => item.id === activity.id ? mergeRecording(item, activity) : item),
          };
        });
        // After state settles — synchronous, no dangling promise.
        runRecalculation('activity_added', get().activities);
        return savedActivityId;
      },

      updateActivity: (id, patch) => {
        if (!captureOwnerLease()) throw new Error('Local history is locked until its owner is confirmed');
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
        if (!captureOwnerLease()) throw new Error('Local history is locked until its owner is confirmed');
        activityRemovalRevision += 1;
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
      storage: activityStorage,
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
