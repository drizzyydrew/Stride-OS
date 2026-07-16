import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

type StrengthLogEdits = Partial<Pick<StrengthLogRecord,
  'actualDuration' | 'overallRpe' | 'notes' | 'exercises'>>;

type ManualStrengthEntry = {
  completionKey:   string;
  sessionType:     StrengthSessionType;
  goal:            StrengthGoal;
  week:            number;
  plannedDuration: number;
  actualDuration:  number;
  exercises:       CompletedExercise[];
  overallRpe?:     number;
  notes?:          string;
  source?:         'manual' | 'preset';
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
    id:              r.id              ?? '',
    sessionId:       r.sessionId       ?? '',
    sessionType:     r.sessionType     ?? 'full_body',
    goal:            r.goal            ?? 'maintenance',
    week:            r.week            ?? 1,
    timestamp:       r.timestamp       ?? 0,
    completed:       true,
    skipped:         r.skipped,
    skippedReason:   r.skippedReason,
    plannedDuration:  r.plannedDuration  ?? 0,
    actualDuration:   r.actualDuration,
    exercises:        r.exercises        ?? [],
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
          id:              entry.completionKey,
          sessionId:       entry.completionKey,
          sessionType:     entry.sessionType,
          goal:            entry.goal,
          week:            entry.week,
          timestamp:       Date.now(),
          completed:       true,
          plannedDuration: entry.plannedDuration,
          actualDuration:  entry.actualDuration,
          exercises:       entry.exercises,
          overallRpe:      entry.overallRpe,
          notes:           entry.notes,
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
      storage:    createJSONStorage(() => AsyncStorage),
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
