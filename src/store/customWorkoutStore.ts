// ─── Custom Workout Store ─────────────────────────────────────────────────────
//
// Persists custom and backdated workout logs.
// Integrates with athleteStore via callback pattern (same as workoutStore).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CustomRunDefinition, CustomWorkoutLog, OverrideRecord } from '../types/customWorkout';
import { buildCustomWorkoutLog } from '../utils/customWorkoutEngine';
import {
  dismissCustomRunForDate,
  restoreCustomRunForDate,
  selectCustomRunForDate,
} from '../utils/customRunSelection';
import { syncCustomLog, deleteCustomLog } from '../lib/syncService';

type CustomWorkoutStore = {
  logs:      CustomWorkoutLog[];
  overrides: OverrideRecord[];
  notTodayLogIds: string[];
  customRuns: CustomRunDefinition[];
  selectedTodayCustomRunId: string | null;
  selectedTodayDate: string | null;
  dismissedTodayCustomRunId: string | null;

  addLog: (
    partial:           Omit<CustomWorkoutLog, 'id' | 'completedAt' | 'estimatedLoad' | 'fatigueImpact'>,
    currentFatigue:    number,
    setFatigueScore:   (score: number) => void,
    setRecentEasyLoad: (load: number) => void,
    recentEasyLoad:    number,
  ) => string;  // returns generated id

  editLog:   (id: string, patch: Partial<CustomWorkoutLog>) => void;
  deleteLog: (id: string) => void;
  markNotToday: (id: string) => void;
  restoreLegacyLogToday: (id: string) => void;
  saveCustomRun: (run: Omit<CustomRunDefinition, 'id' | 'createdAt' | 'updatedAt'>, editId?: string) => string;
  selectCustomRunToday: (id: string, date: string) => void;
  dismissCustomRunToday: (date: string) => void;
  restoreCustomRunToday: (date: string) => void;

  addOverride:  (override: Omit<OverrideRecord, 'id' | 'createdAt'>) => string;
  linkOverride: (overrideId: string, logId: string) => void;

  hydrateLogs: (records: CustomWorkoutLog[]) => void;

  // Queries
  getLogsForDate:     (date: string) => CustomWorkoutLog[];
  getLogsForRange:    (fromDate: string, toDate: string) => CustomWorkoutLog[];
  getRecentOverrides: (days: number) => OverrideRecord[];
};

const EASY_FATIGUE_THRESHOLD = 5;   // fatigue delta ≤ this → counts as easy load

export const useCustomWorkoutStore = create<CustomWorkoutStore>()(
  persist(
    (set, get) => ({
      logs:      [],
      overrides: [],
      notTodayLogIds: [],
      customRuns: [],
      selectedTodayCustomRunId: null,
      selectedTodayDate: null,
      dismissedTodayCustomRunId: null,

      addLog: (partial, currentFatigue, setFatigueScore, setRecentEasyLoad, recentEasyLoad) => {
        const id  = `cw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const log = buildCustomWorkoutLog({ ...partial, id, completedAt: Date.now() });

        // Update fatigue score
        const newFatigue = Math.min(100, currentFatigue + log.fatigueImpact);
        setFatigueScore(newFatigue);

        // Track easy load for recovery calculation
        if (log.fatigueImpact <= EASY_FATIGUE_THRESHOLD) {
          setRecentEasyLoad(recentEasyLoad + log.estimatedLoad);
        }

        set(state => ({ logs: [log, ...state.logs] }));
        syncCustomLog(log).catch(console.warn);
        return id;
      },

      editLog: (id, patch) =>
        set(state => ({
          logs: state.logs.map(l => l.id === id ? { ...l, ...patch } : l),
        })),

      deleteLog: (id) => {
        set(state => ({
          logs: state.logs.filter(l => l.id !== id),
          notTodayLogIds: state.notTodayLogIds.filter(logId => logId !== id),
        }));
        deleteCustomLog(id).catch(console.warn);
      },

      markNotToday: (id) => set(state => ({
        notTodayLogIds: state.notTodayLogIds.includes(id)
          ? state.notTodayLogIds
          : [...state.notTodayLogIds, id],
      })),

      restoreLegacyLogToday: (id) => set(state => ({
        notTodayLogIds: state.notTodayLogIds.filter(logId => logId !== id),
      })),

      saveCustomRun: (run, editId) => {
        const now = Date.now();
        const existing = editId ? get().customRuns.find(item => item.id === editId) : undefined;
        const id = existing?.id ?? `cr_${now}_${Math.random().toString(36).slice(2, 7)}`;
        const next: CustomRunDefinition = {
          ...run,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        set(state => ({
          customRuns: existing
            ? state.customRuns.map(item => item.id === id ? next : item)
            : [next, ...state.customRuns],
        }));
        return id;
      },

      selectCustomRunToday: (id, date) => set(state => selectCustomRunForDate(state, id, date)),
      dismissCustomRunToday: (date) => set(state => dismissCustomRunForDate(state, date)),
      restoreCustomRunToday: (date) => set(state => restoreCustomRunForDate(state, date)),

      addOverride: (partial) => {
        const id = `ov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const rec: OverrideRecord = { ...partial, id, createdAt: Date.now() };
        set(state => ({ overrides: [rec, ...state.overrides] }));
        return id;
      },

      linkOverride: (overrideId, logId) =>
        set(state => ({
          overrides: state.overrides.map(o =>
            o.id === overrideId ? { ...o, loggedWorkoutId: logId } : o,
          ),
        })),

      hydrateLogs: (records) => {
        set(state => {
          const existingIds = new Set(state.logs.map(l => l.id));
          const newLogs = records.filter(r => !existingIds.has(r.id));
          if (newLogs.length === 0) return state;
          return { logs: [...newLogs, ...state.logs] };
        });
      },

      getLogsForDate: (date) => get().logs.filter(l => l.date === date),

      getLogsForRange: (fromDate, toDate) =>
        get().logs.filter(l => l.date >= fromDate && l.date <= toDate),

      getRecentOverrides: (days) => {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return get().overrides.filter(o => o.createdAt >= cutoff);
      },
    }),
    {
      name:    'custom-workout-store',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<CustomWorkoutStore> | undefined),
        notTodayLogIds: (persisted as Partial<CustomWorkoutStore> | undefined)?.notTodayLogIds ?? [],
        customRuns: (persisted as Partial<CustomWorkoutStore> | undefined)?.customRuns ?? [],
        selectedTodayCustomRunId: (persisted as Partial<CustomWorkoutStore> | undefined)?.selectedTodayCustomRunId ?? null,
        selectedTodayDate: (persisted as Partial<CustomWorkoutStore> | undefined)?.selectedTodayDate ?? null,
        dismissedTodayCustomRunId: (persisted as Partial<CustomWorkoutStore> | undefined)?.dismissedTodayCustomRunId ?? null,
      }),
    },
  ),
);
