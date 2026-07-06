import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { todayDateKey } from '../types/checkin';
import { calculateReadinessScore } from '../utils/readinessScore';
import type { DailyReadiness, ReadinessInputs } from '../types/readiness';

const HISTORY_LIMIT = 120; // ~4 months of daily check-ins

type ReadinessStore = {
  todayReadiness:  DailyReadiness | null;
  history:         DailyReadiness[]; // ascending by date, one entry per day
  reminderEnabled: boolean;

  submitReadiness:    (inputs: ReadinessInputs) => void;
  setReminderEnabled: (enabled: boolean) => void;
};

export const useReadinessStore = create<ReadinessStore>()(
  persist(
    (set) => ({
      todayReadiness:  null,
      history:         [],
      reminderEnabled: false,

      submitReadiness: (inputs) => {
        const entry: DailyReadiness = {
          ...inputs,
          date:  todayDateKey(),
          score: calculateReadinessScore(inputs),
        };
        set(state => ({
          todayReadiness: entry,
          // Re-submitting on the same day replaces that day's entry.
          history: [...state.history.filter(r => r.date !== entry.date), entry]
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-HISTORY_LIMIT),
        }));
      },

      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
    }),
    {
      name:    'readiness-store',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Older persisted stores predate `history`; seed it from the last
          // check-in so no user data pathway is lost.
          if (!Array.isArray(state.history)) state.history = [];
          if (state.todayReadiness && !state.history.some(r => r.date === state.todayReadiness!.date)) {
            state.history = [...state.history, state.todayReadiness]
              .sort((a, b) => a.date.localeCompare(b.date));
          }
        }
      },
    },
  ),
);
