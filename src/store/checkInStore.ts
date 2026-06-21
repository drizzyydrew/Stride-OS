import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyCheckIn, PostWorkoutNote } from '../types/checkin';
import { todayDateKey } from '../types/checkin';
import { syncCheckIn } from '../lib/syncService';

type CheckInStore = {
  todayCheckIn:     DailyCheckIn | null;
  postWorkoutNotes: PostWorkoutNote[];

  submitPreCheckIn:  (data: Omit<DailyCheckIn, 'date'>) => void;
  submitPostWorkout: (completionKey: string, rpe: number, notes: string) => void;
  getPostWorkoutNote: (completionKey: string) => PostWorkoutNote | undefined;
  hydrateCheckIns: (records: DailyCheckIn[]) => void;
};

export const useCheckInStore = create<CheckInStore>()(
  persist(
    (set, get) => ({
      todayCheckIn:     null,
      postWorkoutNotes: [],

      submitPreCheckIn: (data) => {
        const checkIn = { ...data, date: todayDateKey() };
        set({ todayCheckIn: checkIn });
        syncCheckIn(checkIn).catch(console.warn);
      },

      submitPostWorkout: (completionKey, rpe, notes) => {
        const note: PostWorkoutNote = {
          completionKey,
          rpe,
          notes,
          timestamp: Date.now(),
        };
        set((state) => ({
          postWorkoutNotes: [
            ...state.postWorkoutNotes.filter(n => n.completionKey !== completionKey),
            note,
          ],
        }));
      },

      getPostWorkoutNote: (completionKey) =>
        get().postWorkoutNotes.find(n => n.completionKey === completionKey),

      hydrateCheckIns: (records) => {
        set(state => {
          const today = todayDateKey();
          // Only restore today's check-in if we don't already have one locally
          const todayRemote = records.find(r => r.date === today);
          if (!state.todayCheckIn && todayRemote) {
            return { todayCheckIn: todayRemote };
          }
          return state;
        });
      },
    }),
    {
      name:    'checkin-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        todayCheckIn:     state.todayCheckIn,
        postWorkoutNotes: state.postWorkoutNotes,
      }),
    },
  ),
);
