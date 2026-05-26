// ─── Calendar / Planning Types ────────────────────────────────────────────────

import type { WorkoutType } from './training';
import type { CustomWorkoutCategory } from './customWorkout';

export type CalendarEntryStatus = 'planned' | 'completed' | 'skipped' | 'rest';

export type CalendarEntry = {
  date:             string;             // "YYYY-MM-DD"
  status:           CalendarEntryStatus;
  workoutType?:     WorkoutType;
  customCategory?:  CustomWorkoutCategory;
  label?:           string;
  durationMin?:     number;
  distanceMi?:      number;
  notes?:           string;
  workoutId?:       string;             // canonical generated workout id
  customWorkoutId?: string;            // links to CustomWorkoutLog
  isStrength?:      boolean;
};

export type CalendarView = 'week' | 'month';
