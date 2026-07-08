// ─── Plan Spine Types ─────────────────────────────────────────────────────────
//
// Macro-level plan types layered on top of the existing periodization system.
// A MacroPlan is a date-anchored sequence of MacroWeeks spanning the athlete's
// entire training horizon (60+ weeks), independent of any single week's
// generated content. buildWeekPlan() (trainingEngine.ts) consumes the current
// MacroWeek to decide trainingPhase + currentWeek instead of relying on the
// legacy athleteStore.currentWeek counter.

import type { TrainingPhase, RaceDistance } from './training';

// ─── Goal & race types ────────────────────────────────────────────────────────

export type TrainingGoalType =
  | 'general_running'
  | 'general_strength'
  | 'race_prep'
  | 'hybrid';

export type RacePriority = 'A' | 'B' | 'tune_up';

export type Race = {
  id:        string;
  name:      string;
  date:      string;          // "YYYY-MM-DD"
  distance:  RaceDistance;
  priority:  RacePriority;
  notes?:    string;
};

// ─── Macro week / plan ────────────────────────────────────────────────────────

export type MacroWeek = {
  weekNumber:  number;
  startDate:   string;         // Sunday, "YYYY-MM-DD"
  phase:       TrainingPhase;
  isDeload:    boolean;
  isTaper:     boolean;
  isRaceWeek:  boolean;
  raceId?:     string;
  focus:       string;
};

export type MacroPlan = {
  goalType:        TrainingGoalType;
  startDate:       string;      // Sunday, "YYYY-MM-DD"
  totalWeeks:      number;
  weeks:           MacroWeek[];
  targetRaceId?:   string;
  limitationNote?: string;
  generatedAt:     number;
};
