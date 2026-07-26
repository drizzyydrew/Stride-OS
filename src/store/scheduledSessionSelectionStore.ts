import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';

type ScheduledSessionSelectionStore = {
  selectedByDate: Record<string, string | undefined>;
  removedFromToday: Record<string, true | undefined>;
  // Reschedule ("move date"): scheduledSessionId -> the YYYY-MM-DD it was
  // moved to. Applied in useScheduledSessions.ts so the session disappears
  // from its original date and reappears (with `date` reassigned) on the new
  // one, everywhere in the current week — Calendar, Today, Running, Strength.
  dateOverrides: Record<string, string | undefined>;
  selectForDate: (dateYMD: string, scheduledSessionId: string) => void;
  removeFromToday: (dateYMD: string, scheduledSessionId: string) => void;
  clearSelection: (dateYMD: string) => void;
  isRemovedFromToday: (dateYMD: string, scheduledSessionId: string) => boolean;
  rescheduleSession: (scheduledSessionId: string, newDateYMD: string) => void;
  clearReschedule: (scheduledSessionId: string) => void;
};

export const SCHEDULED_SESSION_SELECTION_VERSION = 1;

export const useScheduledSessionSelectionStore = create<ScheduledSessionSelectionStore>()(
  persist(
    (set, get) => ({
      selectedByDate: {},
      removedFromToday: {},
      dateOverrides: {},

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

      rescheduleSession: (scheduledSessionId, newDateYMD) =>
        set(state => ({
          dateOverrides: { ...state.dateOverrides, [scheduledSessionId]: newDateYMD },
        })),

      clearReschedule: (scheduledSessionId) =>
        set(state => {
          const dateOverrides = { ...state.dateOverrides };
          delete dateOverrides[scheduledSessionId];
          return { dateOverrides };
        }),
    }),
    {
      name: 'scheduled-session-selection-store',
      version: SCHEDULED_SESSION_SELECTION_VERSION,
      storage: createAppJSONStorage(),
      partialize: state => ({
        selectedByDate: state.selectedByDate,
        removedFromToday: state.removedFromToday,
        dateOverrides: state.dateOverrides,
      }),
    },
  ),
);
