import type { TrainingPhase, ProgressionLevel } from './training';

export type ForecastTrendDirection = 'improving' | 'stable' | 'declining';

export type RaceTimePrediction = {
  distanceLabel:    string;
  distanceMeters:   number;
  predictedMinutes: number;
  formattedTime:    string;
  confidence:       number;
  trend:            ForecastTrendDirection;
  explanation:      string;
};

export type TrajectoryPoint = {
  weeksFromNow: number;
  value:        number;
};

export type FatigueTrajectory = {
  current:         number;
  trajectory:      TrajectoryPoint[];
  peakFatigueWeek: number | null;
  explanation:     string;
};

export type RecoveryTrajectory = {
  current:     number;
  trajectory:  TrajectoryPoint[];
  explanation: string;
};

export type ReadinessForecast = {
  current:            number;
  trajectory:         TrajectoryPoint[];
  peakReadinessWeek:  number;
  projectedPeakValue: number;
  explanation:        string;
};

export type OverreachingRisk = {
  level:         'low' | 'moderate' | 'high';
  weeksToRisk:   number | null;
  projectedACWR: number;
  explanation:   string;
};

export type ForecastInput = {
  vdot:               number;
  weeklyMileage:      number;
  fatigueScore:       number;
  recoveryScore:      number;
  currentWeek:        number;
  trainingPhase:      TrainingPhase;
  progressionLevel:   ProgressionLevel;
  acwr:               number;
  adherenceRate:      number;
  longRunConsistency: number;
  easyProportion:     number;
  fatigueSlope:       number;
  recoverySlope:      number;
  historyWeeks:       number;
};

export type ForecastResult = {
  racePredictions:     RaceTimePrediction[];
  fatigueTrajectory:   FatigueTrajectory;
  recoveryTrajectory:  RecoveryTrajectory;
  readinessForecast:   ReadinessForecast;
  overreachingRisk:    OverreachingRisk;
  overallConfidence:   number;
};
