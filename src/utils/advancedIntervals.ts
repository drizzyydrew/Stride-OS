import type { TrainingPhase, ProgressionLevel } from '../types/training';

export type AdvancedIntervalEligibilityInput = {
  progressionLevel: ProgressionLevel;
  trainingPhase: TrainingPhase;
  recentConsistentWeeks: number;
  weeklyRunningMinutes: number;
  toleratedLowerIntensityIntervals: boolean;
  hasNearbyHardSession: boolean;
  readinessScore: number;
  hasCurrentSymptoms: boolean;
  beginnerFoundationPlanActive: boolean;
  featureFlagEnabled?: boolean;
};

export type Norwegian4x4Template = {
  id: 'norwegian_4x4';
  title: 'Norwegian 4×4 Intervals';
  warmup: string;
  workIntervals: number;
  workDurationMinutes: number;
  recoveryDurationMinutes: number;
  intensity: string;
  cooldown: string;
  automaticSchedulingEnabled: boolean;
};

export const NORWEGIAN_4X4_TEMPLATE: Norwegian4x4Template = {
  id: 'norwegian_4x4',
  title: 'Norwegian 4×4 Intervals',
  warmup: 'Progressive warm-up before the first work interval.',
  workIntervals: 4,
  workDurationMinutes: 4,
  recoveryDurationMinutes: 3,
  intensity: 'Approximately 85–95% of HRmax during work intervals when appropriate.',
  cooldown: 'Easy cooldown after the final recovery.',
  automaticSchedulingEnabled: false,
};

export function isEligibleForNorwegian4x4(input: AdvancedIntervalEligibilityInput): boolean {
  if (!input.featureFlagEnabled) return false;
  if (input.beginnerFoundationPlanActive) return false;
  if (input.progressionLevel === 'beginner') return false;
  if (input.trainingPhase === 'foundation' || input.trainingPhase === 'base') return false;
  if (input.recentConsistentWeeks < 8) return false;
  if (input.weeklyRunningMinutes < 180) return false;
  if (!input.toleratedLowerIntensityIntervals) return false;
  if (input.hasNearbyHardSession) return false;
  if (input.readinessScore < 70) return false;
  if (input.hasCurrentSymptoms) return false;
  return true;
}
