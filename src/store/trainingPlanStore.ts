// ─── Training Plan Store ────────────────────────────────────────────────────
//
// Persists the athlete's goal type, program start date, and race calendar.
// This is the anchor for the macro planner (src/utils/plan/macroPlanner.ts):
// every derived week number and phase comes from `programStartDate` + `races`,
// never from a manually-advanced counter.
//
// Migration note: existing users (pre-Build 33) get `ensureInitialized()`
// called once from the tabs layout with inferred defaults so their derived
// `currentWeek` lines up with `athleteStore.currentWeek` (both = 1) and
// existing completion keys (`w1_…`) keep matching.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TrainingGoalType, Race } from '../types/plan';

function uid(): string {
  return `race_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

type TrainingPlanState = {
  goalType:          TrainingGoalType;
  programStartDate:  string | null;
  races:             Race[];
  initialized:       boolean;

  setGoalType:         (goalType: TrainingGoalType) => void;
  setProgramStartDate: (date: string) => void;
  addRace:             (race: Omit<Race, 'id'>) => string;
  updateRace:          (id: string, patch: Partial<Omit<Race, 'id'>>) => void;
  removeRace:          (id: string) => void;

  // Sets goalType/programStartDate ONLY if not already initialized, then
  // marks initialized. Safe to call on every launch — no-op after first run.
  ensureInitialized: (defaults: { goalType: TrainingGoalType; programStartDate: string }) => void;
};

export const useTrainingPlanStore = create<TrainingPlanState>()(
  persist(
    (set, get) => ({
      goalType:         'general_running',
      programStartDate: null,
      races:            [],
      initialized:      false,

      setGoalType:         (goalType) => set({ goalType }),
      setProgramStartDate: (date)     => set({ programStartDate: date }),

      addRace: (race) => {
        const id = uid();
        set(state => ({ races: [...state.races, { ...race, id }] }));
        return id;
      },

      updateRace: (id, patch) =>
        set(state => ({
          races: state.races.map(r => r.id === id ? { ...r, ...patch } : r),
        })),

      removeRace: (id) =>
        set(state => ({ races: state.races.filter(r => r.id !== id) })),

      ensureInitialized: (defaults) => {
        if (get().initialized) return;
        set({
          goalType:         defaults.goalType,
          programStartDate: defaults.programStartDate,
          initialized:      true,
        });
      },
    }),
    {
      name:    'training-plan-store',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const state = persisted as Partial<TrainingPlanState> | undefined;
        return {
          ...current,
          ...state,
          goalType:         state?.goalType         ?? current.goalType,
          programStartDate: state?.programStartDate ?? current.programStartDate,
          races:            state?.races             ?? current.races,
          initialized:      state?.initialized       ?? current.initialized,
        };
      },
    },
  ),
);
