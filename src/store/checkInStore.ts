import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyCheckIn, PostWorkoutNote } from '../types/checkin';
import { todayDateKey } from '../types/checkin';

type CheckInStore = {
  todayCheckIn:     DailyCheckIn | null;
  postWorkoutNotes: PostWorkoutNote[];

  submitPreCheckIn:  (data: Omit<DailyCheckIn, 'date'>) => void;
  submitPostWorkout: (completionKey: string, rpe: number, notes: string) => void;
  getPostWorkoutNote: (completionKey: string) => PostWorkoutNote | undefined;
};

export const useCheckInStore = create<CheckInStore>()(
  persist(
    (set, get) => ({
      todayCheckIn:     null,
      postWorkoutNotes: [],

      submitPreCheckIn: (data) => {
        set({ todayCheckIn: { ...data, date: todayDateKey() } });
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
