import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
  type FuelingReminderIntervalMin,
} from '../constants/hydrationConfig';

export type UnitSystem = 'imperial' | 'metric';

type SettingsStore = {
  units: UnitSystem;
  fuelingReminderIntervalMin: FuelingReminderIntervalMin;
  setUnits: (units: UnitSystem) => void;
  setFuelingReminderIntervalMin: (minutes: FuelingReminderIntervalMin) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      units: 'imperial',
      fuelingReminderIntervalMin: DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
      setUnits: (units) => set({ units }),
      setFuelingReminderIntervalMin: (fuelingReminderIntervalMin) => set({ fuelingReminderIntervalMin }),
    }),
    {
      name:    'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SettingsStore> | undefined),
        fuelingReminderIntervalMin:
          (persisted as Partial<SettingsStore> | undefined)?.fuelingReminderIntervalMin
          ?? DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
      }),
    },
  ),
);
