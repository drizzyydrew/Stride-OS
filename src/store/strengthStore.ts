import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage, getAppStorage } from './persistStorage';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from '../lib/localDataOwner';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  StrengthLogRecord,
  CompletedExercise,
  ExerciseSessionDetail,
  StrengthSessionType,
  StrengthGoal,
} from '../types/strength';
import { estimateSessionLoad } from '../utils/strengthEngine';
import { syncStrengthLog, deleteStrengthLog } from '../lib/syncService';
import { syncStrengthSessionToExternalServices } from '../lib/externalIntegrations';
import { useActivityStore } from './activityStore';
import { activityFromStrengthRecord } from '../utils/activityMigration';
import type { CompletionClassification } from '../types/activity';
import { useProfileStore } from './profileStore';
import { normalizePlyometricResponse, type PlyometricResponseFeedback } from '../utils/plyometricFeedback';
import { reportablePlyometricExercises } from '../utils/plyometricReporting';

let confirmedStrengthWrites: Promise<unknown> = Promise.resolve();
const strengthJSONStorage = createAppJSONStorage();
const strengthStorage: typeof strengthJSONStorage = strengthJSONStorage && {
  ...strengthJSONStorage,
  setItem: (name, value) => {
    const lease = captureOwnerLease();
    const write = confirmedStrengthWrites.catch(() => undefined).then(() => {
      if (!lease || !ownerLeaseIsCurrent(lease)) return;
      return strengthJSONStorage.setItem(name, value);
    });
    confirmedStrengthWrites = write;
    return write;
  },
};

type StrengthLogEdits = Partial<Pick<StrengthLogRecord,
  'actualDuration' | 'overallRpe' | 'notes' | 'exercises'>>;

type ManualStrengthEntry = {
  templateId?: string;
  completionKey:   string;
  scheduledSessionId?: string;
  sessionType:     StrengthSessionType;
  goal:            StrengthGoal;
  week:            number;
  plannedDuration: number;
  actualDuration:  number;
  exercises:       CompletedExercise[];
  exerciseDetails?: ExerciseSessionDetail[];
  overallRpe?:     number;
  notes?:          string;
  completionClassification?: CompletionClassification;
  source?:         'generated' | 'manual' | 'preset';
  presetId?:       string;
  workoutName?:    string;
};

type StrengthStore = {
  completedSessions: string[];
  history:           StrengthLogRecord[];

  logSession: (
    completionKey:    string,
    sessionId:        string,
    sessionType:      StrengthSessionType,
    goal:             StrengthGoal,
    week:             number,
    plannedDuration:  number,
    exercises:        CompletedExercise[],
    fatigueBefore:    number,
    overallRpe?:      number,
    notes?:           string,
    exerciseDetails?: ExerciseSessionDetail[],
  ) => void;

  skipSession: (
    completionKey: string,
    sessionId:     string,
    sessionType:   StrengthSessionType,
    goal:          StrengthGoal,
    week:          number,
    fatigueBefore: number,
    reason?:       string,
  ) => void;

  editLog:   (id: string, updates: StrengthLogEdits) => void;
  deleteLog: (id: string)                            => void;

  manualLog: (entry: ManualStrengthEntry, fatigueBefore: number) => void;

  hydrateStrength: (records: StrengthLogRecord[]) => void;
};

function migrateStrengthRecord(r: Partial<StrengthLogRecord>): StrengthLogRecord {
  return {
    templateId: typeof r.templateId==='string'?r.templateId:undefined,
    id:              r.id              ?? '',
    sessionId:       r.sessionId       ?? '',
    scheduledSessionId: r.scheduledSessionId,
    sessionType:     r.sessionType     ?? 'full_body',
    goal:            r.goal            ?? 'maintenance',
    week:            r.week            ?? 1,
    timestamp:       r.timestamp       ?? 0,
    completed:       true,
    skipped:         r.skipped,
    skippedReason:   r.skippedReason,
    completionClassification: r.completionClassification,
    plannedDuration:  r.plannedDuration  ?? 0,
    actualDuration:   r.actualDuration,
    exercises:        (r.exercises ?? []).map(exercise => {
      if (!exercise.impactResponse) return exercise;
      const { impactResponse, ...performed } = exercise;
      const normalized = normalizePlyometricResponse(impactResponse, r.timestamp ?? 0);
      return normalized ? { ...performed, impactResponse: normalized } : performed;
    }),
    exerciseDetails:  r.exerciseDetails,
    overallRpe:       r.overallRpe,
    notes:            r.notes,
    source:          r.source          ?? 'generated',
    presetId:        r.presetId,
    workoutName:     r.workoutName,
    fatigueBefore:   r.fatigueBefore   ?? 0,
    fatigueAfter:    r.fatigueAfter    ?? 0,
    fatigueDelta:    r.fatigueDelta    ?? 0,
    estimatedLoad:   r.estimatedLoad   ?? 0,
  };
}

function computeStrengthFatigue(
  fatigueBefore: number,
  estimatedLoad: number,
  overallRpe?: number,
): { fatigueAfter: number; fatigueDelta: number } {
  // Strength sessions add ~40–70% of the load impact compared to equivalent
  // running load (concurrent training interference is bidirectional but smaller).
  const rpeFactor     = overallRpe !== undefined ? (overallRpe - 3) / 7 : 0.5;
  const scaledImpact  = estimatedLoad * 0.008 * (0.7 + rpeFactor * 0.3);
  const fatigueDelta  = Math.round(scaledImpact);
  const fatigueAfter  = Math.min(100, fatigueBefore + fatigueDelta);
  return { fatigueAfter, fatigueDelta };
}

export const useStrengthStore = create<StrengthStore>()(
  persist(
    (set, get) => ({
      completedSessions: [],
      history:           [],

      // ── Log completed session ─────────────────────────────────────────────────

      logSession: (
        completionKey, sessionId, sessionType, goal, week,
        plannedDuration, exercises, fatigueBefore, overallRpe, notes, exerciseDetails,
      ) => {
        if (get().completedSessions.includes(completionKey)) return;

        const estimatedLoad = estimateSessionLoad(exercises);
        const { fatigueAfter, fatigueDelta } =
          computeStrengthFatigue(fatigueBefore, estimatedLoad, overallRpe);

        const record: StrengthLogRecord = {
          id:              completionKey,
          sessionId,
          sessionType,
          goal,
          week,
          timestamp:       Date.now(),
          completed:       true,
          plannedDuration,
          exercises,
          exerciseDetails,
          overallRpe,
          notes,
          source:          'generated',
          fatigueBefore,
          fatigueAfter,
          fatigueDelta,
          estimatedLoad,
        };

        set(state => ({
          completedSessions: [...state.completedSessions, completionKey],
          history:           [...state.history, record],
        }));
        useActivityStore.getState().addActivity(activityFromStrengthRecord(record, false));

        syncStrengthLog(record).catch(console.warn);
        syncStrengthSessionToExternalServices(record).catch(console.warn);
      },

      // ── Skip session ──────────────────────────────────────────────────────────

      skipSession: (
        completionKey, sessionId, sessionType, goal, week, fatigueBefore, reason,
      ) => {
        if (get().completedSessions.includes(completionKey)) return;

        const record: StrengthLogRecord = {
          id:              completionKey,
          sessionId,
          sessionType,
          goal,
          week,
          timestamp:       Date.now(),
          completed:       true,
          skipped:         true,
          skippedReason:   reason,
          plannedDuration: 0,
          exercises:       [],
          source:          'generated',
          fatigueBefore,
          fatigueAfter:    fatigueBefore,
          fatigueDelta:    0,
          estimatedLoad:   0,
        };

        set(state => ({
          completedSessions: [...state.completedSessions, completionKey],
          history:           [...state.history, record],
        }));
        useActivityStore.getState().addActivity(activityFromStrengthRecord(record, false));

        syncStrengthLog(record).catch(console.warn);
        syncStrengthSessionToExternalServices(record).catch(console.warn);
      },

      // ── Edit a logged record ──────────────────────────────────────────────────

      editLog: (id, updates) => {
        const existing = get().history.find(record => record.id === id);
        set(state => ({
          history: state.history.map(r =>
            r.id === id ? { ...r, ...updates } : r,
          ),
        }));
        if (existing) {
          useActivityStore.getState().addActivity(
            activityFromStrengthRecord({ ...existing, ...updates }, false),
          );
        }
      },

      // ── Delete a logged record ────────────────────────────────────────────────

      deleteLog: (id) => {
        set(state => ({
          completedSessions: state.completedSessions.filter(k => k !== id),
          history:           state.history.filter(r => r.id !== id),
        }));
        useActivityStore.getState().removeActivity(`activity_strength_${id}`);
        deleteStrengthLog(id).catch(console.warn);
      },

      // ── Manual log ────────────────────────────────────────────────────────────

      manualLog: (entry, fatigueBefore) => {
        if (get().completedSessions.includes(entry.completionKey)) return;

        const estimatedLoad = estimateSessionLoad(entry.exercises);
        const { fatigueAfter, fatigueDelta } =
          computeStrengthFatigue(fatigueBefore, estimatedLoad, entry.overallRpe);

        const record: StrengthLogRecord = {
          templateId:      entry.templateId,
          id:              entry.completionKey,
          sessionId:       entry.completionKey,
          scheduledSessionId: entry.scheduledSessionId,
          sessionType:     entry.sessionType,
          goal:            entry.goal,
          week:            entry.week,
          timestamp:       Date.now(),
          completed:       true,
          plannedDuration: entry.plannedDuration,
          actualDuration:  entry.actualDuration,
          exercises:       entry.exercises,
          exerciseDetails: entry.exerciseDetails,
          overallRpe:      entry.overallRpe,
          notes:           entry.notes,
          completionClassification: entry.completionClassification,
          source:          entry.source ?? 'manual',
          presetId:        entry.presetId,
          workoutName:     entry.workoutName,
          fatigueBefore,
          fatigueAfter,
          fatigueDelta,
          estimatedLoad,
        };

        set(state => ({
          completedSessions: [...state.completedSessions, entry.completionKey],
          history:           [...state.history, record],
        }));
        useActivityStore.getState().addActivity(activityFromStrengthRecord(record, false));

        syncStrengthLog(record).catch(console.warn);
        syncStrengthSessionToExternalServices(record).catch(console.warn);
      },

      // ── Hydrate from Supabase ─────────────────────────────────────────────────

      hydrateStrength: (records) => {
        set(state => {
          const existingIds = new Set(state.completedSessions);
          const newRecords  = records.filter(r => !existingIds.has(r.id)).map(migrateStrengthRecord);
          if (newRecords.length === 0) return state;
          return {
            completedSessions: [...state.completedSessions, ...newRecords.map(r => r.id)],
            history:           [...state.history, ...newRecords],
          };
        });
        useActivityStore.getState().importLegacyStrength(records);
      },
    }),
    {
      name:       'strength-store',
      storage:    strengthStorage,
      partialize: (state) => ({
        completedSessions: state.completedSessions,
        history:           state.history,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.history = state.history.map(migrateStrengthRecord);
        }
      },
    },
  ),
);


/** Keep the active draft until both strength history and its Activity project
 * have survived local readback. Retry uses the same completion identity. */
export function confirmStrengthCompletionSaved(completionKey: string, lease: OwnerLease): Promise<void> {
  const write = confirmedStrengthWrites.catch(() => undefined).then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!ownerLeaseIsCurrent(lease) || !useStrengthStore.persist.hasHydrated()) throw new Error('Strength history is not ready for this account');
      const state = useStrengthStore.getState();
      const record = state.history.find(item => item.id === completionKey);
      if (!record || !state.completedSessions.includes(completionKey)) throw new Error('The workout has not been recorded yet');
      const encoded = JSON.stringify({ state: { completedSessions: state.completedSessions, history: state.history }, version: 0 });
      const storage = getAppStorage();
      await storage.setItem('strength-store', encoded);
      if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed while saving the workout');
      const saved = await storage.getItemOnce('strength-store');
      if (!ownerLeaseIsCurrent(lease) || saved !== encoded) throw new Error('Workout saving could not be confirmed. Your active workout was kept; retry Finish.');
      await useActivityStore.getState().addActivityAndPersist(activityFromStrengthRecord(record, false), lease, { onlyIfMissing: true });
      if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed while saving the workout');
      if (useStrengthStore.getState().history === state.history && useStrengthStore.getState().completedSessions === state.completedSessions) return;
    }
    throw new Error('Strength history changed while saving. Your active workout was kept; retry Finish.');
  });
  confirmedStrengthWrites = write;
  return write;
}

/** Publish an explicit per-exercise response only after the exact local history
 * bytes survive readback. This never edits sets, prescriptions or Activity metrics. */
export function savePlyometricResponse(recordId: string, exerciseId: string, feedback: PlyometricResponseFeedback | null, lease: OwnerLease): Promise<void> {
  const ready = () => ownerLeaseIsCurrent(lease) && useStrengthStore.persist.hasHydrated()
    && useProfileStore.persist.hasHydrated() && useProfileStore.getState().activeAthleteId === 'athlete_default';
  const write = confirmedStrengthWrites.catch(() => undefined).then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!ready()) throw new Error('Strength history is not ready for this account and athlete');
      const state = useStrengthStore.getState();
      const original = state.history.find(record => record.id === recordId);
      if (!original || !state.completedSessions.includes(recordId)
        || ('ownerUserId' in original && original.ownerUserId != null && original.ownerUserId !== lease.ownerUserId)
        || !reportablePlyometricExercises(original).some(exercise => exercise.exerciseId === exerciseId)) {
        throw new Error('This saved exercise cannot accept a jump response');
      }
      const response = feedback === null ? undefined : normalizePlyometricResponse(feedback, original.timestamp);
      if (feedback !== null && !response) throw new Error('Check your responses and report the next-day response only after 24 hours');
      const updated = { ...original, exercises: original.exercises.map(exercise => {
        if (exercise.exerciseId !== exerciseId) return exercise;
        const { impactResponse: _previous, ...performed } = exercise;
        return response ? { ...performed, impactResponse: response } : performed;
      }) };
      const history = state.history.map(record => record.id === recordId ? updated : record);
      const encoded = JSON.stringify({ state: { completedSessions: state.completedSessions, history }, version: 0 });
      const storage = getAppStorage();
      await storage.setItem('strength-store', encoded);
      if (!ready()) throw new Error('Account or athlete changed while saving the jump response');
      if (useStrengthStore.getState().history !== state.history || useStrengthStore.getState().completedSessions !== state.completedSessions) continue;
      const saved = await storage.getItemOnce('strength-store');
      if (!ready()) throw new Error('Account or athlete changed while confirming the jump response');
      if (saved !== encoded) throw new Error('Jump response saving could not be confirmed. Your workout was kept; retry Save.');
      if (useStrengthStore.getState().history !== state.history || useStrengthStore.getState().completedSessions !== state.completedSessions) continue;
      useStrengthStore.setState({ history });
      // The existing sync service rechecks this tag after its async auth lookup.
      // It is a dispatch fence, not an edit to the saved workout fields.
      const syncRecord = { ...updated, ownerUserId: lease.ownerUserId };
      syncStrengthLog(syncRecord).catch(console.warn);
      return;
    }
    throw new Error('Strength history changed while saving. Retry the jump response.');
  });
  confirmedStrengthWrites = write;
  return write;
}
