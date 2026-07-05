import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { todayDateKey } from '../types/checkin';
import { calculateReadinessScore } from '../utils/readinessScore';
import type { DailyReadiness, ReadinessInputs } from '../types/readiness';

type ReadinessStore = {
  todayReadiness:  DailyReadiness | null;
  reminderEnabled: boolean;

  submitReadiness:    (inputs: ReadinessInputs) => void;
  setReminderEnabled: (enabled: boolean) => void;
};

export const useReadinessStore = create<ReadinessStore>()(
  persist(
    (set) => ({
      todayReadiness:  null,
      reminderEnabled: false,

      submitReadiness: (inputs) => {
        set({
          todayReadiness: {
            ...inputs,
            date:  todayDateKey(),
            score: calculateReadinessScore(inputs),
          },
        });
      },

      setReminderEnabled: (enabled) => set({ reminderEnabled: enabled }),
    }),
    {
      name:    'readiness-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
