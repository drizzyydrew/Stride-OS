import type { TrainingPreferences } from '../types/trainingPreferences';

export const TRAINING_PREFERENCES_SCHEMA_VERSION = 1;

export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  schemaVersion: TRAINING_PREFERENCES_SCHEMA_VERSION,
  crossTrainingDecision: 'no',
  crossTrainingFrequencyPerWeek: 0,
  crossTrainingPurpose: [],
  crossTrainingActivities: [],
  primaryEnduranceMode: 'running',
  updatedAt: 0,
};

export function migrateTrainingPreferencesState(persisted: unknown): TrainingPreferences {
  const state = (persisted ?? {}) as Partial<TrainingPreferences>;
  return {
    ...DEFAULT_TRAINING_PREFERENCES,
    ...state,
    schemaVersion: TRAINING_PREFERENCES_SCHEMA_VERSION,
    crossTrainingPurpose: Array.isArray(state.crossTrainingPurpose)
      ? state.crossTrainingPurpose
      : [],
    crossTrainingActivities: Array.isArray(state.crossTrainingActivities)
      ? state.crossTrainingActivities
      : [],
  };
}

