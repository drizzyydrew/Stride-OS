import type { TrainingPhase, ProgressionLevel } from './training';

export type DataPoint = {
  week: number;
  value: number;
};

export type TrendDirection = 'up' | 'down' | 'flat';

export type TrendSeverity = 'positive' | 'neutral' | 'warning' | 'critical';

export type MetricTrend = {
  current: number;
  previous: number;
  direction: TrendDirection;
  severity: TrendSeverity;
  slope: number;
  changePercent: number;
};

export type TrainingLoad = {
  acute: number;
  chronic: number;
  acwr: number;
  acwrSeverity: TrendSeverity;
};

export type AnalyticsSummary = {
  mileageTrend: DataPoint[];
  fatigueTrend: DataPoint[];
  recoveryTrend: DataPoint[];

  mileageMetric: MetricTrend;
  fatigueMetric: MetricTrend;
  recoveryMetric: MetricTrend;

  trainingLoad: TrainingLoad;

  consistency: number;
  planProgress: number;
  weeksRemaining: number;
  totalWeeks: number;
};

export type AnalyticsInput = {
  weeklyMileage: number;
  fatigueScore: number;
  recoveryScore: number;
  currentWeek: number;
  trainingPhase: TrainingPhase;
  progressionLevel: ProgressionLevel;
  goalRace: string;
};
