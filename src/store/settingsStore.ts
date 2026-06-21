import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UnitSystem = 'imperial' | 'metric';

type SettingsStore = {
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      units: 'imperial',
      setUnits: (units) => set({ units }),
    }),
    {
      name:    'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
