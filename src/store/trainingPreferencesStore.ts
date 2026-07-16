import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  CrossTrainingActivityPreference,
  CrossTrainingDecision,
  CrossTrainingPurpose,
  PrimaryEnduranceMode,
  TrainingPreferences,
} from '../types/trainingPreferences';
import {
  DEFAULT_TRAINING_PREFERENCES,
  migrateTrainingPreferencesState,
  TRAINING_PREFERENCES_SCHEMA_VERSION,
} from '../utils/trainingPreferences';

export {
  DEFAULT_TRAINING_PREFERENCES,
  migrateTrainingPreferencesState,
  TRAINING_PREFERENCES_SCHEMA_VERSION,
} from '../utils/trainingPreferences';

type TrainingPreferencesStore = TrainingPreferences & {
  setCrossTrainingDecision: (decision: CrossTrainingDecision) => void;
  setCrossTrainingFrequency: (frequency: number) => void;
  setCrossTrainingPurpose: (purpose: CrossTrainingPurpose[]) => void;
  upsertCrossTrainingActivity: (preference: CrossTrainingActivityPreference) => void;
  removeCrossTrainingActivity: (activityType: CrossTrainingActivityPreference['activityType']) => void;
  setPrimaryEnduranceMode: (mode: PrimaryEnduranceMode) => void;
  replacePreferences: (preferences: TrainingPreferences) => void;
};

export const useTrainingPreferencesStore = create<TrainingPreferencesStore>()(
  persist(
    set => ({
      ...DEFAULT_TRAINING_PREFERENCES,

      setCrossTrainingDecision: decision =>
        set(state => ({
          crossTrainingDecision: decision,
          crossTrainingFrequencyPerWeek:
            decision === 'yes' && state.crossTrainingFrequencyPerWeek <= 0
              ? 2
              : state.crossTrainingFrequencyPerWeek,
          updatedAt: Date.now(),
        })),

      setCrossTrainingFrequency: frequency =>
        set({
          crossTrainingFrequencyPerWeek: Math.max(1, Math.min(4, Math.round(frequency))),
          updatedAt: Date.now(),
        }),

      setCrossTrainingPurpose: purpose =>
        set({ crossTrainingPurpose: [...new Set(purpose)], updatedAt: Date.now() }),

      upsertCrossTrainingActivity: preference =>
        set(state => ({
          crossTrainingActivities: [
            ...state.crossTrainingActivities.filter(
              item => item.activityType !== preference.activityType,
            ),
            preference,
          ],
          updatedAt: Date.now(),
        })),

      removeCrossTrainingActivity: activityType =>
        set(state => ({
          crossTrainingActivities: state.crossTrainingActivities.filter(
            item => item.activityType !== activityType,
          ),
          updatedAt: Date.now(),
        })),

      setPrimaryEnduranceMode: mode =>
        set({ primaryEnduranceMode: mode, updatedAt: Date.now() }),

      replacePreferences: preferences =>
        set(migrateTrainingPreferencesState(preferences)),
    }),
    {
      name: 'training-preferences-store',
      version: TRAINING_PREFERENCES_SCHEMA_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        schemaVersion: state.schemaVersion,
        crossTrainingDecision: state.crossTrainingDecision,
        crossTrainingFrequencyPerWeek: state.crossTrainingFrequencyPerWeek,
        crossTrainingPurpose: state.crossTrainingPurpose,
        crossTrainingActivities: state.crossTrainingActivities,
        primaryEnduranceMode: state.primaryEnduranceMode,
        updatedAt: state.updatedAt,
      }),
      migrate: persisted => migrateTrainingPreferencesState(persisted),
      merge: (persisted, current) => ({
        ...current,
        ...migrateTrainingPreferencesState(persisted),
      }),
    },
  ),
);
