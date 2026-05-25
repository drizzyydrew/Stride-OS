// Return types for src/utils/historyUtils functions.
// The core record type lives in src/types/training.ts (CompletedWorkoutRecord).

import type { WorkoutType, WorkoutIntensity } from './training';

// Returned by getLast7DaysLoad / getLast30DaysLoad.
// totalLoad is the sum of estimatedLoad (TSS-analog) for the window.
export type HistoryWindow = {
  totalLoad:   number;
  totalMiles:  number;
  recordCount: number;
  startMs:     number;   // timestamp of earliest record in window (or Date.now() if empty)
  endMs:       number;   // Date.now() at query time
};

// One entry per training week that has at least one completed workout.
// Grouped by the `week` field on each CompletedWorkoutRecord.
export type WeeklyHistorySummary = {
  week:              number;
  totalLoad:         number;
  totalMiles:        number;
  recordCount:       number;
  dominantType:      WorkoutType | null;       // type with most completions that week
  dominantIntensity: WorkoutIntensity | null;  // intensity with most completions that week
};

// Count-based breakdown of workout variety.
// Partial: a key is absent if no workouts of that type/intensity exist in the window.
export type TrainingDistribution = {
  byType:      Partial<Record<WorkoutType, number>>;
  byIntensity: Partial<Record<WorkoutIntensity, number>>;
  totalCount:  number;
};
