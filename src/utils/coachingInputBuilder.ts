// ─── Coaching Input Builder ───────────────────────────────────────────────────
//
// Derives the full CoachingInput contract for coachEngine from real store
// data: completion history drives ACWR, adherence, long-run consistency,
// intensity distribution, and week-over-week slopes. Pure function — the
// caller collects store state and passes it in.

import { calculateACWR } from './training/calculateACWR';
import { computeConsistency, computeSlope } from './analyticsEngine';
import type { CoachingInput } from '../types/coaching';
import type {
  CompletedWorkoutRecord,
  ProgressionLevel,
  TrainingPhase,
  WorkoutType,
} from '../types/training';

export type CoachingInputSources = {
  athleteName:            string;
  goalRace:               string;
  currentWeek:            number;
  trainingPhase:          TrainingPhase;
  progressionLevel:       ProgressionLevel;
  weeklyMileage:          number;
  fatigueScore:           number;
  recoveryScore:          number;
  soreness:               number | null;
  motivation:             number | null;
  checkedIn:              boolean;
  todayWorkoutType:       WorkoutType;
  isRestDay:              boolean;
  isTodayComplete:        boolean;
  weeksRemaining:         number;
  plannedSessionsPerWeek: number;
  history:                CompletedWorkoutRecord[];
};

export function buildCoachingInput(src: CoachingInputSources): CoachingInput {
  const completed = src.history.filter(r => !r.skipped);

  const byWeek = new Map<number, CompletedWorkoutRecord[]>();
  for (const record of completed) {
    const group = byWeek.get(record.week) ?? [];
    group.push(record);
    byWeek.set(record.week, group);
  }
  const weeks = Array.from(byWeek.entries()).sort(([a], [b]) => a - b);
  const historyWeeks = weeks.length;

  const plannedPerWeek = Math.max(1, src.plannedSessionsPerWeek);
  const adherenceRate = historyWeeks === 0
    ? 0
    : Math.min(1, completed.length / (historyWeeks * plannedPerWeek));

  const longRunConsistency = historyWeeks === 0
    ? 0
    : weeks.filter(([, records]) => records.some(r => r.type === 'long_run')).length / historyWeeks;

  const easyProportion = completed.length === 0
    ? 0.8 // neutral default so a fresh athlete isn't scolded for imaginary intensity
    : completed.filter(r => r.intensity === 'easy' || r.intensity === 'very_easy' || r.intensity === 'rest').length / completed.length;

  const weeklyMiles = weeks.map(([, records]) =>
    records.reduce((s, r) => s + (r.actualDistanceMiles ?? r.estimatedDistanceMiles), 0),
  );
  const consistencyScore = computeConsistency(weeklyMiles);

  const weeklyFatigue = weeks.map(([, records]) =>
    records.reduce((s, r) => s + r.fatigueAfter, 0) / records.length,
  );
  const weeklyRecovery = weeks.map(([, records]) =>
    records.reduce((s, r) => s + (r.recoveryBefore + r.recoveryDelta), 0) / records.length,
  );
  const fatigueSlope = weeklyFatigue.length >= 2 ? computeSlope(weeklyFatigue) : 0;
  const recoverySlope = weeklyRecovery.length >= 2 ? computeSlope(weeklyRecovery) : 0;

  return {
    athleteName:      src.athleteName,
    goalRace:         src.goalRace,
    currentWeek:      src.currentWeek,
    trainingPhase:    src.trainingPhase,
    progressionLevel: src.progressionLevel,
    weeklyMileage:    src.weeklyMileage,
    fatigueScore:     src.fatigueScore,
    recoveryScore:    src.recoveryScore,
    soreness:         src.soreness,
    motivation:       src.motivation,
    checkedIn:        src.checkedIn,
    todayWorkoutType: src.todayWorkoutType,
    isRestDay:        src.isRestDay,
    isTodayComplete:  src.isTodayComplete,
    acwr:             calculateACWR(completed).acwr,
    adherenceRate,
    longRunConsistency,
    easyProportion,
    historyWeeks,
    consistencyScore,
    fatigueSlope,
    recoverySlope,
    weeksRemaining:   src.weeksRemaining,
  };
}
