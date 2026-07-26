import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';

import { todayDateKey } from '../types/checkin';
import { calculateReadiness, type ReadinessContext } from '../utils/readinessScore';
import { migrateReadinessState, READINESS_STORE_SCHEMA_VERSION } from '../utils/readinessMigration';
import type { DailyReadiness, ReadinessInputs } from '../types/readiness';

const HISTORY_LIMIT = 120; // ~4 months of daily check-ins

type ReadinessStore = {
  schemaVersion: number;
  todayReadiness: DailyReadiness | null;
  history: DailyReadiness[]; // ascending by date, one entry per day
  reminderEnabled: boolean;

  submitReadiness: (inputs: ReadinessInputs, context?: ReadinessContext) => void;
  setReminderEnabled: (enabled: boolean) => void;
};

export const useReadinessStore = create<ReadinessStore>()(
  persist(
    (set) => ({
      schemaVersion: READINESS_STORE_SCHEMA_VERSION,
      todayReadiness: null,
      history: [],
      reminderEnabled: false,

      submitReadiness: (inputs, context = {}) => {
        set(state => {
          const today = todayDateKey();
          const existingHistory = state.history.filter(entry => entry.date !== today);
          const priorDay = [...existingHistory].reverse().find(entry => entry.score !== undefined);
          const result = calculateReadiness(inputs, existingHistory, {
            ...context,
            referenceDateKey: context.referenceDateKey ?? today,
            priorDayScore: context.priorDayScore ?? priorDay?.score,
          });
          const entry: DailyReadiness = {
            ...inputs,
            schemaVersion: READINESS_STORE_SCHEMA_VERSION,
            date: today,
            score: result.score,
            sleepMinutesTotal: result.sleepMinutesTotal,
            details: result.details,
          };
          return {
            todayReadiness: entry,
            history: [...existingHistory, entry].sort((a, b) => a.date.localeCompare(b.date)).slice(-HISTORY_LIMIT),
          };
        });
      },

      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
    }),
    {
      name: 'readiness-store',
      version: READINESS_STORE_SCHEMA_VERSION,
      storage: createAppJSONStorage(),
      migrate: persisted => migrateReadinessState(persisted),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const migrated = migrateReadinessState(state);
        state.schemaVersion = migrated.schemaVersion;
        state.todayReadiness = migrated.todayReadiness;
        state.history = migrated.history;
        state.reminderEnabled = migrated.reminderEnabled;
      },
    },
  ),
);
