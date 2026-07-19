import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ScheduledSessionSelectionStore = {
  selectedByDate: Record<string, string | undefined>;
  removedFromToday: Record<string, true | undefined>;
  selectForDate: (dateYMD: string, scheduledSessionId: string) => void;
  removeFromToday: (dateYMD: string, scheduledSessionId: string) => void;
  clearSelection: (dateYMD: string) => void;
  isRemovedFromToday: (dateYMD: string, scheduledSessionId: string) => boolean;
};

export const SCHEDULED_SESSION_SELECTION_VERSION = 1;

export const useScheduledSessionSelectionStore = create<ScheduledSessionSelectionStore>()(
  persist(
    (set, get) => ({
      selectedByDate: {},
      removedFromToday: {},

      selectForDate: (dateYMD, scheduledSessionId) =>
        set(state => {
          const removedFromToday = { ...state.removedFromToday };
          delete removedFromToday[`${dateYMD}:${scheduledSessionId}`];
          return {
            selectedByDate: { ...state.selectedByDate, [dateYMD]: scheduledSessionId },
            removedFromToday,
          };
        }),

      removeFromToday: (dateYMD, scheduledSessionId) =>
        set(state => {
          const selectedByDate = { ...state.selectedByDate };
          if (selectedByDate[dateYMD] === scheduledSessionId) delete selectedByDate[dateYMD];
          return {
            selectedByDate,
            removedFromToday: { ...state.removedFromToday, [`${dateYMD}:${scheduledSessionId}`]: true },
          };
        }),

      clearSelection: dateYMD =>
        set(state => {
          const selectedByDate = { ...state.selectedByDate };
          delete selectedByDate[dateYMD];
          return { selectedByDate };
        }),

      isRemovedFromToday: (dateYMD, scheduledSessionId) =>
        Boolean(get().removedFromToday[`${dateYMD}:${scheduledSessionId}`]),
    }),
    {
      name: 'scheduled-session-selection-store',
      version: SCHEDULED_SESSION_SELECTION_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        selectedByDate: state.selectedByDate,
        removedFromToday: state.removedFromToday,
      }),
    },
  ),
);
