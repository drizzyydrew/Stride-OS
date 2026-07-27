import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
  type FuelingReminderIntervalMin,
} from '../constants/hydrationConfig';
import type { ExperienceMode } from '../utils/experienceMode';

export type UnitSystem = 'imperial' | 'metric';
export type { ExperienceMode };
export type VoiceCueMode = 'silent' | 'minimal' | 'standard' | 'coach';
export type VoiceCuePreferences = {
  interval: boolean;
  pace: boolean;
  heartRate: boolean;
  runWalk: boolean;
  motivation: boolean;
  technique: boolean;
  fueling: boolean;
  hydration: boolean;
  navigation: boolean;
};

export const DEFAULT_VOICE_CUE_PREFERENCES: VoiceCuePreferences = {
  interval: true,
  pace: true,
  heartRate: true,
  runWalk: true,
  motivation: true,
  technique: true,
  fueling: true,
  hydration: true,
  navigation: true,
};

type SettingsStore = {
  units: UnitSystem;
  experienceMode: ExperienceMode;
  fuelingReminderIntervalMin: FuelingReminderIntervalMin;
  voiceCueMode: VoiceCueMode;
  voiceCuePreferences: VoiceCuePreferences;
  setUnits: (units: UnitSystem) => void;
  setExperienceMode: (mode: ExperienceMode) => void;
  setFuelingReminderIntervalMin: (minutes: FuelingReminderIntervalMin) => void;
  setVoiceCueMode: (mode: VoiceCueMode) => void;
  setVoiceCuePreference: (cue: keyof VoiceCuePreferences, enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      units: 'imperial',
      experienceMode: 'balanced',
      fuelingReminderIntervalMin: DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
      // Coach preserves the complete pre-Build-2 cue behavior. Athletes can
      // deliberately reduce it to Standard/Minimal/Silent.
      voiceCueMode: 'coach',
      voiceCuePreferences: DEFAULT_VOICE_CUE_PREFERENCES,
      setUnits: (units) => set({ units }),
      setExperienceMode: (experienceMode) => set({ experienceMode }),
      setFuelingReminderIntervalMin: (fuelingReminderIntervalMin) => set({ fuelingReminderIntervalMin }),
      setVoiceCueMode: (voiceCueMode) => set({ voiceCueMode }),
      setVoiceCuePreference: (cue, enabled) => set(state => ({
        voiceCuePreferences: { ...state.voiceCuePreferences, [cue]: enabled },
      })),
    }),
    {
      name:    'settings-store',
      storage: createAppJSONStorage(),
      merge: (persisted, current) => {
        const saved = persisted as Partial<SettingsStore> | undefined;
        return {
          ...current,
          ...saved,
          experienceMode: saved?.experienceMode ?? 'balanced',
          fuelingReminderIntervalMin: saved?.fuelingReminderIntervalMin ?? DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
          // Additive migration: old settings keep the complete pre-existing
          // cue behavior rather than silently losing uncategorized legacy
          // cues (which conservatively default to motivation).
          voiceCueMode: saved?.voiceCueMode ?? 'coach',
          voiceCuePreferences: {
            ...DEFAULT_VOICE_CUE_PREFERENCES,
            ...(saved?.voiceCuePreferences ?? {}),
          },
        };
      },
    },
  ),
);
