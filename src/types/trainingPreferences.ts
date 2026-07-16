import type { ActivityType } from './activity';

export type CrossTrainingDecision = 'no' | 'yes' | 'not_sure';
export type PrimaryEnduranceMode = 'running' | 'walking' | 'run_walk' | 'general_endurance';
export type CrossTrainingPurpose =
  | 'aerobic_development'
  | 'lower_impact_substitute'
  | 'variety'
  | 'sport_specific_preparation'
  | 'recovery'
  | 'general_fitness';
export type ExperienceLevel = 'new' | 'some_experience' | 'experienced';
export type CrossTrainingUse = 'replace_easy_aerobic' | 'additional_training' | 'either';

export const CROSS_TRAINING_ACTIVITY_TYPES = [
  'cycling',
  'indoor_cycling',
  'swimming',
  'hiking',
  'walking',
  'downhill_skiing',
  'cross_country_skiing',
  'elliptical',
  'rowing',
  'stair_climbing',
  'hiit',
  'mixed_modal',
  'other',
] as const satisfies readonly ActivityType[];

export type CrossTrainingActivityType = typeof CROSS_TRAINING_ACTIVITY_TYPES[number];

export type CrossTrainingActivityPreference = {
  activityType: CrossTrainingActivityType;
  preferredDays: number[];
  equipment: string[];
  setting: 'indoor' | 'outdoor' | 'either';
  typicalDurationMinutes: number;
  experienceLevel: ExperienceLevel;
  use: CrossTrainingUse;
  seasonalMonths?: number[];
  restrictions?: string;
};

export type TrainingPreferences = {
  schemaVersion: 1;
  crossTrainingDecision: CrossTrainingDecision;
  crossTrainingFrequencyPerWeek: number;
  crossTrainingPurpose: CrossTrainingPurpose[];
  crossTrainingActivities: CrossTrainingActivityPreference[];
  primaryEnduranceMode: PrimaryEnduranceMode;
  updatedAt: number;
};

