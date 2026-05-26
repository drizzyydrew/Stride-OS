// ─── Custom Workout Store ─────────────────────────────────────────────────────
//
// Persists custom and backdated workout logs.
// Integrates with athleteStore via callback pattern (same as workoutStore).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CustomWorkoutLog, OverrideRecord } from '../types/customWorkout';
import { buildCustomWorkoutLog } from '../utils/customWorkoutEngine';

type CustomWorkoutStore = {
  logs:      CustomWorkoutLog[];
  overrides: OverrideRecord[];

  addLog: (
    partial:           Omit<CustomWorkoutLog, 'id' | 'completedAt' | 'estimatedLoad' | 'fatigueImpact'>,
    currentFatigue:    number,
    setFatigueScore:   (score: number) => void,
    setRecentEasyLoad: (load: number) => void,
    recentEasyLoad:    number,
  ) => string;  // returns generated id

  editLog:   (id: string, patch: Partial<CustomWorkoutLog>) => void;
  deleteLog: (id: string) => void;

  addOverride:  (override: Omit<OverrideRecord, 'id' | 'createdAt'>) => string;
  linkOverride: (overrideId: string, logId: string) => void;

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
        return id;
      },

      editLog: (id, patch) =>
        set(state => ({
          logs: state.logs.map(l => l.id === id ? { ...l, ...patch } : l),
        })),

      deleteLog: (id) =>
        set(state => ({ logs: state.logs.filter(l => l.id !== id) })),

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
    },
  ),
);
