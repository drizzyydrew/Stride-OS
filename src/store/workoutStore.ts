import { workoutWasDeleted, newPerformanceIdentity, completionKeyFor } from '../utils/workoutDeletion';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage, getAppStorage } from './persistStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CompletedWorkoutRecord, RunningQualityFeedback, Workout, WorkoutIntensity, WorkoutType } from '../types/training';
import type { Activity } from '../types/activity';
import { calculateTrainingLoad } from '../utils/training';
import { calculateUpdatedFatigue } from '../utils/calculateFatigue';
import { estimateDistanceMiles } from '../utils/historyUtils';
import { syncWorkoutLog, deleteWorkoutLog } from '../lib/syncService';
import { syncCompletedWorkoutToExternalServices } from '../lib/externalIntegrations';
import { useActivityStore } from './activityStore';
import { activityFromWorkoutRecord } from '../utils/activityMigration';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from '../lib/localDataOwner';
import { RunCompletionJournal, type LiveRunEntry, type PendingRunCompletion } from '../lib/runCompletionJournal';
import { matchingWatchRecording, runCompletionKey, sameRecording, type RunWorkoutRecord } from '../utils/runCompletionIdentity';
import { isValidRaceActivityLink } from '../utils/raceLink';
import { canReportRunningQuality, normalizeRunningQuality, normalizeRunningQualityPrescription, normalizeRunningQualityResponse } from '../utils/runningQualityFeedback';

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

type LogEdits = Partial<Pick<RunWorkoutRecord,
  'actualDurationMinutes' | 'actualDistanceMiles' | 'routeCoordinates' | 'rpe' | 'notes'>>;

type ManualLogEntry = LiveRunEntry;
export type RunCompletionResult = {
  status: 'saved' | 'discarded';
  activityId: string | null;
  entry: LiveRunEntry;
  ownerLease: OwnerLease;
};

type WorkoutStore = {
  completedWorkouts: string[];
  history:           RunWorkoutRecord[];
  saveLiveRun: (
    entry: LiveRunEntry, currentWeek: number, currentFatigue: number, currentRecovery: number,
    setFatigueScore: (score: number) => void, setRecentEasyLoad: (load: number) => void,
  ) => Promise<string>;
  commitRunEnd: (
    entry: LiveRunEntry, currentWeek: number, currentFatigue: number, currentRecovery: number,
    setFatigueScore: (score: number) => void, setRecentEasyLoad: (load: number) => void,
    discardShort?: boolean,
  ) => Promise<RunCompletionResult>;
  discardRunEnd: (entry: LiveRunEntry, week: number, fatigue: number, recovery: number, lease: OwnerLease) => Promise<RunCompletionResult>;
  getRunDiscardResult: (workoutInstanceId: string, lease: OwnerLease) => Promise<RunCompletionResult | null>;
  acknowledgeRunCleanup: (workoutInstanceId: string, lease: OwnerLease) => Promise<void>;
  pendingRunDiscards: () => Promise<PendingRunCompletion[]>;
  restorePendingCompletions: () => Promise<void>;

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
  deleteLog:  (id: string, lease?: OwnerLease) => Promise<void>;
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
function migrateRecord(r: Partial<RunWorkoutRecord>): RunWorkoutRecord {
  const intensity = (r.intensity ?? 'easy') as WorkoutIntensity;
  return {
    ...r,
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
    runningQualityPrescription: normalizeRunningQualityPrescription(r.runningQualityPrescription),
    runningQualityResponse: normalizeRunningQualityResponse(r.runningQualityResponse),
    runningQuality: normalizeRunningQuality(r.runningQuality, r.actualDurationMinutes),
    actualDistanceMiles:   r.actualDistanceMiles,
    routeCoordinates:      r.routeCoordinates,
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

const completionJournal = new RunCompletionJournal(getAppStorage());
let completionCommitQueue: Promise<unknown> = Promise.resolve();
function serializedCompletion<T>(action: () => Promise<T>): Promise<T> {
  const task = completionCommitQueue.then(action);
  completionCommitQueue = task.catch(() => undefined);
  return task;
}

async function waitForHistoryHydration() {
  await Promise.all([useWorkoutStore, useActivityStore].map(store => {
    if (store.persist.hasHydrated()) return Promise.resolve();
    return new Promise<void>(resolve => {
      const unsubscribe = store.persist.onFinishHydration(() => { unsubscribe(); resolve(); });
      if (store.persist.hasHydrated()) { unsubscribe(); resolve(); }
    });
  }));
}

async function flushCompletionHistory(lease: OwnerLease, record: RunWorkoutRecord): Promise<string> {
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed before local commit');
  if (record.ownerUserId && record.ownerUserId !== lease.ownerUserId) throw new Error('Saved run belongs to a different local account');
  const projection = activityFromWorkoutRecord(record, false);
  const activity = useActivityStore.getState().activities.find(activity => sameRecording(activity, projection));
  if (!activity) throw new Error('Saved run Activity projection is unavailable; retry recovery');
  const storage = getAppStorage();
  const workout = useWorkoutStore.getState();
  await storage.setItem('workout-store', JSON.stringify({ state: { history: workout.history, completedWorkouts: workout.completedWorkouts }, version: 0 }));
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed during local commit');
  await useActivityStore.getState().awaitPersistence(lease);
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed during local commit');
  // A completed history row alone is not proof that its detail Activity survived.
  const raw = await storage.getItem('activity-store');
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed during local commit');
  const persisted = raw ? JSON.parse(raw) as { state?: { activities?: Activity[] } } : null;
  const savedActivity = persisted?.state?.activities?.find(item => item.id === activity.id
    && sameRecording(item, projection)
    && (!record.workoutInstanceId
      || (item.workoutInstanceId ?? item.healthKit?.workoutInstanceId) === record.workoutInstanceId));
  if (!savedActivity) throw new Error('Saved run Activity persistence could not be confirmed; retry recovery');
  return savedActivity.id;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      completedWorkouts: [],
      history:           [],

      saveLiveRun: async (entry, week, fatigue, recovery, setFatigueScore, setRecentEasyLoad) => {
        const result = await get().commitRunEnd(entry, week, fatigue, recovery, setFatigueScore, setRecentEasyLoad);
        if (!result.activityId) throw new Error('This recording already has a durable short-run discard');
        return result.activityId;
      },

      commitRunEnd: (entry, week, fatigue, recovery, setFatigueScore, setRecentEasyLoad, discardShort = false) => {
        const lease = captureOwnerLease();
        if (!lease) return Promise.reject(new Error('Confirm the owner of this recording before saving'));
        if (entry.raceLink && !isValidRaceActivityLink(entry.raceLink, lease.ownerUserId)) {
          return Promise.reject(new Error('The race link does not belong to this recording owner'));
        }
        return serializedCompletion(async () => {
          await waitForHistoryHydration();
          if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed before the run could be saved');
          if (entry.ownerUserId && entry.ownerUserId !== lease.ownerUserId) throw new Error('Run belongs to a different local account');
          if (!entry.workoutInstanceId || entry.actualStartTime == null || entry.actualEndTime == null) throw new Error('Run identity and actual times are required');
          const completionKey = runCompletionKey(entry.workoutInstanceId, entry.actualStartTime);
          const existing = get().history.find(record => (record.id === completionKey || record.completionKey === completionKey) || record.workoutInstanceId === entry.workoutInstanceId);
          if (existing) {
            if (existing.ownerUserId && existing.ownerUserId !== lease.ownerUserId) throw new Error('Saved run belongs to a different local account');
            const projection = activityFromWorkoutRecord(existing, false);
            // Missing may mean deliberately deleted, not an interrupted commit.
            if (!useActivityStore.getState().activities.some(activity => sameRecording(activity, projection))) {
              throw new Error('Saved run Activity is missing. Use Restore saved recording to explicitly restore it.');
            }
          }
          const pending: PendingRunCompletion = { ownerUserId: lease.ownerUserId, entry: { ...entry, ownerUserId: lease.ownerUserId, completionKey },
            discarded: discardShort && entry.durationMinutes < 5 && !(entry.raceLink && entry.actualEndTime! > entry.actualStartTime!), week, fatigue, recovery };
          await completionJournal.save(pending);
          if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed; the saved run is retained for its original owner');
          const saved = (await completionJournal.read()).find(item => item.ownerUserId === lease.ownerUserId && item.entry.completionKey === completionKey)!;
          if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed; the saved run is retained for its original owner');
          if (saved.discarded) return { status: 'discarded', activityId: null, entry: saved.entry, ownerLease: lease };
          get().manualLog({ ...saved.entry, watchRecording: saved.entry.watchRecording
            ?? matchingWatchRecording(entry.watchRecording, saved.entry.workoutInstanceId, saved.entry.actualStartTime) },
          saved.week, saved.fatigue, saved.recovery, setFatigueScore, setRecentEasyLoad);
          const record = get().history.find(record => (record.id === completionKey || record.completionKey === completionKey) || record.workoutInstanceId === saved.entry.workoutInstanceId);
          if (!record) throw new Error('Saved recording history is unavailable; retry recovery');
          const activityId = await flushCompletionHistory(lease, record);
          if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed; run recovery remains available to its original owner');
          await completionJournal.acknowledge(lease.ownerUserId, completionKey);
          if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed after the run was saved for its original owner');
          return { status: 'saved', activityId, ownerLease: lease, entry: { ...saved.entry,
            watchRecording: record.watchRecording,
            actualEndTime: record.actualEndTime, durationMinutes: record.actualDurationMinutes ?? record.durationMinutes,
            distanceMiles: record.actualDistanceMiles ?? record.estimatedDistanceMiles } };
        });
      },

      discardRunEnd: (entry, week, fatigue, recovery, lease) => serializedCompletion(async () => {
        await waitForHistoryHydration();
        if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed before recording discard');
        if (!entry.workoutInstanceId || entry.actualStartTime == null || entry.actualEndTime == null) throw new Error('Run discard requires recording identity and actual times');
        if (get().history.some(record => record.workoutInstanceId === entry.workoutInstanceId)) {
          throw new Error('A saved recording cannot be discarded through active-run cleanup');
        }
        const completionKey = runCompletionKey(entry.workoutInstanceId);
        await completionJournal.discard({ ownerUserId: lease.ownerUserId, discarded: true,
          entry: { ...entry, completionKey, ownerUserId: lease.ownerUserId }, week, fatigue, recovery }, () => ownerLeaseIsCurrent(lease));
        if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed during recording discard');
        const result = await get().getRunDiscardResult(entry.workoutInstanceId, lease);
        if (!result) throw new Error('Recording discard was not durably retained');
        return result;
      }),

      getRunDiscardResult: async (instance, lease) => {
        if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed before discard resolution');
        const entries = await completionJournal.read();
        if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed during discard resolution');
        const item = entries.find(value => value.ownerUserId === lease.ownerUserId
          && value.entry.workoutInstanceId === instance && value.discarded);
        return item ? { status: 'discarded', activityId: null, entry: item.entry, ownerLease: lease } : null;
      },

      acknowledgeRunCleanup: (instance, lease) => serializedCompletion(async () => {
        if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed before recording cleanup');
        await completionJournal.acknowledgeCleanup(lease.ownerUserId, runCompletionKey(instance), () => ownerLeaseIsCurrent(lease));
      }),

      pendingRunDiscards: async () => {
        const lease = captureOwnerLease();
        if (!lease) return [];
        const pending = await completionJournal.read();
        if (!ownerLeaseIsCurrent(lease)) return [];
        return pending.filter(item => item.ownerUserId === lease.ownerUserId && item.discarded && !item.cleanupAcknowledged);
      },

      restorePendingCompletions: () => {
        const lease = captureOwnerLease();
        if (!lease) return Promise.resolve();
        return serializedCompletion(async () => {
          await waitForHistoryHydration();
          const pending = await completionJournal.read();
          for (const item of pending) {
            if (!ownerLeaseIsCurrent(lease)) return;
            if (item.ownerUserId !== lease.ownerUserId) continue;
            // Keep a durable discard marker until matching-instance native cleanup.
            if (item.discarded) continue;
            const existing = get().history.find(record => record.id === item.entry.completionKey
              || record.workoutInstanceId === item.entry.workoutInstanceId);
            if (existing && (!existing.ownerUserId || existing.ownerUserId === lease.ownerUserId)
              && !useActivityStore.getState().activities.some(activity => sameRecording(activity, activityFromWorkoutRecord(existing, false)))) {
              // Preserve ambiguous missing/deleted history for explicit restoration.
              continue;
            }
            get().manualLog(item.entry, item.week, item.fatigue, item.recovery, () => {}, () => {});
            const record = get().history.find(record => record.id === item.entry.completionKey
              || record.workoutInstanceId === item.entry.workoutInstanceId);
            if (!record) throw new Error('Saved recording history is unavailable; retry recovery');
            await flushCompletionHistory(lease, record);
            if (!ownerLeaseIsCurrent(lease)) return;
            await completionJournal.acknowledge(lease.ownerUserId, item.entry.completionKey);
          }
        });
      },

      // ── Complete (planned) ────────────────────────────────────────────────────

      completeWorkout: (
        completionKey, workout, currentWeek,
        currentFatigue, currentRecovery,
        setFatigueScore, setRecentEasyLoad,
      ) => {
        if (!captureOwnerLease()) throw new Error('Local training data is locked until its owner is confirmed');
        if (get().completedWorkouts.includes(completionKey)) return;

        const history = get().history;
        const { estimatedLoad, estimatedDistanceMiles, fatigueAfter, fatigueDelta, recoveryDelta, newEasyLoad } =
          computeLoadFields(workout.durationMinutes, workout.intensity, currentFatigue, history, workout.type);

        const record: CompletedWorkoutRecord = {
          ...newPerformanceIdentity(completionKey, 'workout', useActivityStore.getState().deletedActivities),
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

        if (workoutWasDeleted(useActivityStore.getState().deletedActivities, 'activity_logs', activityFromWorkoutRecord(record, false))) throw new Error('This exact workout was deleted. Start a new recording rather than retry the deleted recording.');
        setRecentEasyLoad(newEasyLoad);
        setFatigueScore(fatigueAfter);

        set(state => ({
          completedWorkouts: [...state.completedWorkouts, completionKey],
          history:           [...state.history, record],
        }));
        useActivityStore.getState().addActivity(activityFromWorkoutRecord(record, false));

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
        if (!captureOwnerLease()) throw new Error('Local training data is locked until its owner is confirmed');
        if (get().completedWorkouts.includes(completionKey)) return;

        // Skipping = rest effect: no additional fatigue, slight recovery delta
        const recoveryDelta = 2;

        const record: CompletedWorkoutRecord = {
          ...newPerformanceIdentity(completionKey, 'workout', useActivityStore.getState().deletedActivities),
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
        useActivityStore.getState().addActivity(activityFromWorkoutRecord(record, false));

        syncWorkoutLog(record).catch(console.warn);
      },

      // ── Edit a logged record ──────────────────────────────────────────────────

      editLog: (id, updates) => {
        if (!captureOwnerLease()) throw new Error('Local training data is locked until its owner is confirmed');
        const existing = get().history.find(record => (record.id === id || record.completionKey === id));
        set(state => ({
          history: state.history.map(r =>
            (r.id === id || r.completionKey === id) ? { ...r, ...updates } : r,
          ),
        }));
        if (existing) {
          const updated = { ...existing, ...updates };
          useActivityStore.getState().addActivity(activityFromWorkoutRecord(updated, false));
          syncWorkoutLog(updated).catch(console.warn);
        }
      },

      // ── Delete a logged record ────────────────────────────────────────────────

      deleteLog: async (id, expectedOwner) => {
        const lease = expectedOwner ?? captureOwnerLease();
        if (!lease || !ownerLeaseIsCurrent(lease)) throw new Error('Local training data is locked until its owner is confirmed');
        const record = get().history.find(item => (item.id === id || item.completionKey === id));
        const projection = record ? activityFromWorkoutRecord(record, false) : null;
        const activityIds = projection ? useActivityStore.getState().activities
          .filter(activity => sameRecording(activity, projection)).map(activity => activity.id) : [];
        if (!activityIds.length) activityIds.push(`activity_workout_${id}`);
        for (const activityId of activityIds) await useActivityStore.getState().removeActivityAndPersist(activityId, lease);
        if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed during deletion');
        set(state => ({
          completedWorkouts: state.completedWorkouts.filter(k => k !== id && k !== record?.id && k !== record?.completionKey),
          history:           state.history.filter(r => r.id !== (record?.id ?? id)),
        }));
        deleteWorkoutLog(record?.id ?? id).catch(console.warn);
      },

      // ── Hydrate from Supabase ─────────────────────────────────────────────────

      hydrateWorkouts: (records) => {
        records = records.filter(row => !workoutWasDeleted(useActivityStore.getState().deletedActivities, 'workout_logs', row));
        if (!captureOwnerLease()) throw new Error('Local training data is locked until its owner is confirmed');
        set(state => {
          const existingIds = new Set(state.history.map(row => row.id));
          const newRecords  = records.filter(r => !existingIds.has(r.id)).map(migrateRecord);
          if (newRecords.length === 0) return state;
          return {
            completedWorkouts: [...state.completedWorkouts, ...newRecords.map(completionKeyFor)],
            history:           [...state.history, ...newRecords],
          };
        });
        useActivityStore.getState().importLegacyWorkouts(records);
      },

      // ── Manual log ────────────────────────────────────────────────────────────

      manualLog: (
        entry, currentWeek, currentFatigue, currentRecovery,
        setFatigueScore, setRecentEasyLoad,
      ) => {
        const lease = captureOwnerLease();
        if (entry.raceLink && (!lease || !isValidRaceActivityLink(entry.raceLink, lease.ownerUserId))) {
          throw new Error('The race link does not belong to this recording owner');
        }
        if (!lease) throw new Error('Local training data is locked until its owner is confirmed');
        if (entry.ownerUserId && entry.ownerUserId !== lease.ownerUserId) throw new Error('Run belongs to a different local account');
        if (entry.workoutInstanceId && workoutWasDeleted(useActivityStore.getState().deletedActivities, 'activity_logs', { id: `activity_workout_${entry.completionKey}`, legacyWorkoutId: entry.completionKey, workoutInstanceId: entry.workoutInstanceId })) throw new Error('This exact recording was deleted. Start a new recording.');
        const existing = get().history.find(record => (record.id === entry.completionKey || record.completionKey === entry.completionKey)
          || (entry.workoutInstanceId && record.workoutInstanceId === entry.workoutInstanceId));
        if (existing) {
          if (existing.ownerUserId && existing.ownerUserId !== lease.ownerUserId) throw new Error('Saved run belongs to a different local account');
          const projection = activityFromWorkoutRecord(existing, false);
          const activity = useActivityStore.getState().activities.find(activity => sameRecording(activity, projection));
          if (!activity) throw new Error('Saved run Activity is missing. Use Restore saved recording to explicitly restore it.');
          const evidence = matchingWatchRecording(entry.watchRecording, existing.workoutInstanceId, existing.actualStartTime);
          if (evidence && (!existing.watchRecording || existing.watchRecording.confirmedAt < evidence.confirmedAt)) {
            const enriched = { ...existing, watchRecording: evidence };
            set(state => ({ history: state.history.map(record => record.id === existing.id ? enriched : record) }));
            useActivityStore.getState().updateActivity(activity.id, { watchRecording: evidence });
          }
          return;
        }
        if (get().completedWorkouts.includes(entry.completionKey)) return;
        const now = Date.now();
        if (entry.workoutInstanceId && get().history.some(record => record.workoutInstanceId === entry.workoutInstanceId)) return;

        const intensity = entry.rpe !== undefined
          ? rpeToIntensity(entry.rpe) : entry.intensity;

        const history = get().history;
        const { estimatedLoad, fatigueAfter, fatigueDelta, recoveryDelta, newEasyLoad } =
          computeLoadFields(entry.durationMinutes, intensity, currentFatigue, history, entry.type);

        const record: RunWorkoutRecord = {
          ...(entry.workoutInstanceId ? { id: entry.completionKey } : newPerformanceIdentity(entry.completionKey, 'workout', useActivityStore.getState().deletedActivities)),
          workoutId:              entry.workoutId ?? entry.type,
          workoutInstanceId:      entry.workoutInstanceId,
          watchRecording:         matchingWatchRecording(entry.watchRecording, entry.workoutInstanceId, entry.actualStartTime),
          actualStartTime:        entry.actualStartTime,
          actualEndTime:          entry.actualEndTime,
          scheduledSessionId:     entry.scheduledSessionId,
          ownerUserId:            lease.ownerUserId,
          ...(entry.raceLink ? { raceLink: JSON.parse(JSON.stringify(entry.raceLink)) } : {}),
          distanceSource:         entry.distanceSource,
          associatedTrainingBlockId: entry.associatedTrainingBlockId,
          associatedGoalId:       entry.associatedGoalId,
          activityMetrics:        entry.activityMetrics,
          runningQualityPrescription: normalizeRunningQualityPrescription(entry.runningQualityPrescription),
          indoor:                 entry.indoor,
          activitySubtype:        entry.activitySubtype,
          routeCoordinates:       entry.routeCoordinates,
          type:                   entry.type,
          intensity,
          durationMinutes:        entry.durationMinutes,
          estimatedLoad,
          estimatedDistanceMiles: entry.distanceMiles,
          timestamp:              now,
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
          source:                 entry.source ?? 'manual',
        };

        if (workoutWasDeleted(useActivityStore.getState().deletedActivities, 'activity_logs', activityFromWorkoutRecord(record, false))) throw new Error('This exact workout was deleted. Start a new recording rather than retry the deleted recording.');
        setRecentEasyLoad(newEasyLoad);
        setFatigueScore(fatigueAfter);

        set(state => ({
          completedWorkouts: [...state.completedWorkouts, entry.completionKey],
          history:           [...state.history, record],
        }));
        useActivityStore.getState().addActivity(activityFromWorkoutRecord(record, false));

        syncWorkoutLog(record).catch(console.warn);
        syncCompletedWorkoutToExternalServices(record).catch(console.warn);
      },
    }),
    {
      name:       'workout-store',
      storage:    createAppJSONStorage(),
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

/** One explicit report on an exact saved run. Do not publish training evidence
 * until its local bytes are confirmed, or reconstruct it from a planned label. */
export function saveRunningQualityFeedback(id: string, feedback: RunningQualityFeedback | null, lease: OwnerLease,
  response?: CompletedWorkoutRecord['runningQualityResponse'], guard?: { expectedRecord: CompletedWorkoutRecord; isCurrent: () => boolean }): Promise<void> {
  const signature = (record: CompletedWorkoutRecord | undefined) => JSON.stringify(record ? {
    id: record.id, workoutId: record.workoutId, timestamp: record.timestamp, actualDurationMinutes: record.actualDurationMinutes,
    prescription: normalizeRunningQualityPrescription(record.runningQualityPrescription),
  } : null);
  // Capture before entering the queue; a later same-ID record is not the editor's original.
  const expectedSignature = guard ? signature(guard.expectedRecord) : null;
  const guardCurrent = () => !guard || guard.isCurrent()
    && useWorkoutStore.getState().history.find(record => (record.id === id || record.completionKey === id)) === guard.expectedRecord
    && signature(guard.expectedRecord) === expectedSignature;
  return serializedCompletion(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!ownerLeaseIsCurrent(lease) || !useWorkoutStore.persist.hasHydrated()) throw new Error('Run history is not ready for this account');
      if (!guardCurrent()) throw new Error('Workout or athlete changed. Reopen feedback for the current saved run.');
      const state = useWorkoutStore.getState();
      const original = state.history.find(record => (record.id === id || record.completionKey === id));
      if (!canReportRunningQuality(original) || (original?.ownerUserId && original.ownerUserId !== lease.ownerUserId)) throw new Error('This saved run cannot accept a quality report');
      const quality = feedback === null ? undefined : normalizeRunningQuality(feedback, original!.actualDurationMinutes);
      if (feedback !== null && !quality) throw new Error('Check the completed repeats, work time and effort against the actual run duration');
      const normalizedResponse = response ? normalizeRunningQualityResponse(response) : undefined;
      if (response && !normalizedResponse) throw new Error('Workout feedback is invalid');
      if (normalizedResponse && (normalizedResponse.value === 'as_planned') !== !!quality) throw new Error('Feedback and confirmed work must agree');
      if (normalizedResponse?.value === 'as_planned') {
        const plan = normalizeRunningQualityPrescription(original!.runningQualityPrescription);
        if (!plan || !quality || plan.rung !== quality.rung || plan.completedReps !== quality.completedReps || plan.workSeconds !== quality.workSeconds) {
          throw new Error('Confirmed work no longer matches the original workout. Reopen feedback.');
        }
      }
      const updated = { ...original!, runningQuality: quality,
        ...(normalizedResponse ? { runningQualityResponse: normalizedResponse } : {}) };
      const history = state.history.map(record => (record.id === id || record.completionKey === id) ? updated : record);
      const encode = (value: Pick<WorkoutStore, 'history' | 'completedWorkouts'>) => JSON.stringify({ state: { history: value.history, completedWorkouts: value.completedWorkouts }, version: 0 });
      const encoded = encode({ history, completedWorkouts: state.completedWorkouts });
      const storage = getAppStorage();
      async function rejectRetiredDraft() {
        if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed while saving the report');
        if (guardCurrent()) return;
        // The rejected write may already be on disk. Restore this owner's latest
        // unmodified state, never the editor's old history over a newer record.
        for (let retry = 0; retry < 3 && ownerLeaseIsCurrent(lease); retry++) {
          const latest = useWorkoutStore.getState();
          await storage.setItem('workout-store', encode(latest));
          if (!ownerLeaseIsCurrent(lease)) break;
          const current = useWorkoutStore.getState();
          if (current.history === latest.history && current.completedWorkouts === latest.completedWorkouts) break;
        }
        throw new Error('Workout or athlete changed. Reopen feedback; the saved run was retained.');
      }
      await storage.setItem('workout-store', encoded);
      await rejectRetiredDraft();
      if (useWorkoutStore.getState().history !== state.history || useWorkoutStore.getState().completedWorkouts !== state.completedWorkouts) continue;
      const saved = await storage.getItemOnce('workout-store');
      await rejectRetiredDraft();
      if (saved !== encoded) throw new Error('Report saving could not be confirmed. Your run was kept; retry Save.');
      if (useWorkoutStore.getState().history !== state.history || useWorkoutStore.getState().completedWorkouts !== state.completedWorkouts) continue;
      useWorkoutStore.setState({ history });
      syncWorkoutLog(updated).catch(console.warn);
      return;
    }
    throw new Error('Run history changed while saving. Retry the report.');
  });
}
