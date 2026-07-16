import type { ActivityType } from './activity';
import type { PrimaryEnduranceMode } from './trainingPreferences';

export type BeginnerPlanGoal =
  | 'couch_to_5k'
  | 'couch_to_10k'
  | 'couch_to_half_marathon'
  | 'couch_to_marathon';

export type BeginnerStartingLevel = 'inactive' | 'walking' | 'run_walk' | 'running';

export type BeginnerPlanReadinessInput = {
  goal: BeginnerPlanGoal;
  startingLevel: BeginnerStartingLevel;
  continuousWalkMinutes: number;
  continuousRunMinutes: number;
  recentConsistentWeeks: number;
  availableDaysPerWeek: number;
  hasCurrentSymptoms: boolean;
  readinessScore?: number;
  crossTrainingExperience: boolean;
  requestedTargetDate?: string;
  startDate: string;
};

export type BeginnerPlanRecommendation = {
  recommendedWeeks: number;
  minimumSupportedWeeks: number;
  earliestSupportedTargetDate: string;
  reasoning: string[];
  progressionRequirements: string[];
  accelerated: boolean;
};

export type BeginnerPlanSessionKind =
  | 'walk'
  | 'run_walk'
  | 'easy_run'
  | 'long_session'
  | 'cross_training'
  | 'strength'
  | 'mobility'
  | 'rest';

export type BeginnerPlanSession = {
  id: string;
  dayIndex: number;
  kind: BeginnerPlanSessionKind;
  activityType: ActivityType;
  durationMinutes: number;
  intensity: 'recovery' | 'easy' | 'moderate';
  purpose: string;
  replacesSessionId?: string;
  supplements?: boolean;
  runSeconds?: number;
  walkSeconds?: number;
  repeats?: number;
  explanation: string;
};

export type BeginnerPlanWeek = {
  weekNumber: number;
  isRecoveryWeek: boolean;
  focus: string;
  sessions: BeginnerPlanSession[];
};

export type GeneratedBeginnerPlan = {
  id: string;
  goal: BeginnerPlanGoal;
  primaryEnduranceMode: PrimaryEnduranceMode;
  startDate: string;
  targetDate: string;
  durationWeeks: number;
  recommendation: BeginnerPlanRecommendation;
  acceleratedAcknowledgedAt?: number;
  weeks: BeginnerPlanWeek[];
  createdAt: number;
};

export type ActivePresetGoal = {
  goal: BeginnerPlanGoal;
  planId: string;
  selectedAt: number;
  targetDate: string;
  acceleratedAcknowledgedAt?: number;
};
