import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import type { ScheduledSession } from '../utils/scheduledSessions';
import type { ScheduleMoveLedger } from '../utils/scheduleMoveLedger';
import { legacyOverridesToMoveLedger } from '../utils/scheduleMoveLedger';

type ScheduledSessionSelectionStore = {
  selectedByDate: Record<string, string | undefined>;
  removedFromToday: Record<string, true | undefined>;
  // Reschedule ("move date"): scheduledSessionId -> the YYYY-MM-DD it was
  // moved to. Applied in useScheduledSessions.ts so the session disappears
  // from its original date and reappears (with `date` reassigned) on the new
  // one, everywhere in the current week — Calendar, Today, Running, Strength.
  dateOverrides: Record<string, string | undefined>;
  // v2 source of truth for moved sessions. Keyed by canonical origin
  // scheduledSessionId so completion linking remains identity-stable even
  // when date changes across week boundaries.
  moveLedger: ScheduleMoveLedger;
  selectForDate: (dateYMD: string, scheduledSessionId: string) => void;
  removeFromToday: (dateYMD: string, scheduledSessionId: string) => void;
  clearSelection: (dateYMD: string) => void;
  isRemovedFromToday: (dateYMD: string, scheduledSessionId: string) => boolean;
  rescheduleSession: (scheduledSessionId: string, newDateYMD: string, snapshot?: ScheduledSession, reason?: string) => void;
  clearReschedule: (scheduledSessionId: string) => void;
};

export const SCHEDULED_SESSION_SELECTION_VERSION = 2;

export const useScheduledSessionSelectionStore = create<ScheduledSessionSelectionStore>()(
  persist(
    (set, get) => ({
      selectedByDate: {},
      removedFromToday: {},
      dateOverrides: {},
      moveLedger: {},

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

      rescheduleSession: (scheduledSessionId, newDateYMD, snapshot, reason) =>
        set(state => ({
          dateOverrides: { ...state.dateOverrides, [scheduledSessionId]: newDateYMD },
          moveLedger: {
            ...state.moveLedger,
            [scheduledSessionId]: {
              targetDate: newDateYMD,
              movedAt: Date.now(),
              reason,
              snapshot,
            },
          },
        })),

      clearReschedule: (scheduledSessionId) =>
        set(state => {
          const dateOverrides = { ...state.dateOverrides };
          const moveLedger = { ...state.moveLedger };
          delete dateOverrides[scheduledSessionId];
          delete moveLedger[scheduledSessionId];
          return { dateOverrides, moveLedger };
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
        moveLedger: state.moveLedger,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Partial<ScheduledSessionSelectionStore> | undefined;
        if (!state) return state;
        if (version < 2) {
          return {
            ...state,
            moveLedger: {
              ...legacyOverridesToMoveLedger(state.dateOverrides),
              ...(state.moveLedger ?? {}),
            },
          };
        }
        return state;
      },
    },
  ),
);
