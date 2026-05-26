// ─── Custom Workout Engine ────────────────────────────────────────────────────
//
// Computes load and fatigue impact for custom-logged workouts.
// Mirrors the TSS-analog used by workoutStore for generated workouts.
// All calculations are deterministic — no backend, no AI.

import type {
  CustomWorkoutLog,
  CustomWorkoutCategory,
  RunWorkoutType,
  IntervalEntry,
} from '../types/customWorkout';

// ─── RPE → intensity factor ────────────────────────────────────────────────────
//
// Maps subjective effort (1–10 CR-10 scale) to a multiplier for load estimation.
// Source: Foster et al., 2001 "A new approach to monitoring exercise training".

function rpeToFactor(rpe: number): number {
  // 1–2: very light  3–4: light  5–6: moderate  7–8: hard  9–10: max
  if (rpe <= 2)  return 0.30;
  if (rpe <= 4)  return 0.50;
  if (rpe <= 6)  return 0.70;
  if (rpe <= 8)  return 0.90;
  return 1.10;
}

// ─── Run type → baseline intensity ───────────────────────────────────────────

const RUN_TYPE_BASE_RPE: Record<RunWorkoutType, number> = {
  recovery:      3,
  easy:          4,
  long_run:      5,
  fartlek:       6,
  marathon_pace: 6,
  tempo:         7,
  threshold:     7,
  hills:         8,
  intervals:     8,
  vo2:           9,
  time_trial:    9,
  race:          10,
};

// ─── Load calculations ────────────────────────────────────────────────────────

export function calculateRunLoad(
  durationMin: number,
  rpe:         number,
): number {
  return Math.round(durationMin * rpeToFactor(rpe) * 10);
}

export function calculateIntervalLoad(intervals: IntervalEntry[]): number {
  let totalLoad = 0;
  for (const seg of intervals) {
    const workMin = (seg.workDurationSec ?? 0) / 60;
    const recMin  = (seg.recoveryDurationSec ?? 0) / 60;
    const rpe     = seg.rpe ?? 8;
    totalLoad += seg.reps * (workMin * rpeToFactor(rpe) * 10 + recMin * rpeToFactor(3) * 10);
  }
  return Math.round(totalLoad);
}

export function calculateStrengthLoad(
  durationMin:  number,
  rpe:          number,
  exerciseCount: number,
): number {
  // Strength TSS-analog: lower per-minute load than running, scaled by exercise density
  const densityFactor = Math.min(1, 0.5 + exerciseCount * 0.05);
  return Math.round(durationMin * rpeToFactor(rpe) * 7 * densityFactor);
}

export function calculateCrossTrainingLoad(
  durationMin: number,
  rpe:         number,
): number {
  return Math.round(durationMin * rpeToFactor(rpe) * 8);
}

export function calculateMobilityLoad(durationMin: number): number {
  return Math.round(durationMin * rpeToFactor(2) * 3);
}

// ─── Fatigue impact ───────────────────────────────────────────────────────────
//
// Translates estimated load → fatigue score change (0–20 points).
// Calibrated so: easy 30min ≈ +2, threshold 60min ≈ +7, race ≈ +15

export function loadToFatigueImpact(load: number): number {
  // load is 0–300+; fatigue delta is 0–20
  return Math.min(20, Math.round(load / 15));
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildCustomWorkoutLog(
  partial: Omit<CustomWorkoutLog, 'estimatedLoad' | 'fatigueImpact'>,
): CustomWorkoutLog {
  let load = 0;

  switch (partial.category) {
    case 'running': {
      const dur = partial.durationMinutes ?? 0;
      const rpe = partial.rpe
        ?? (partial.runType ? RUN_TYPE_BASE_RPE[partial.runType] : 5);
      if (partial.intervals?.length) {
        load = calculateIntervalLoad(partial.intervals);
      } else {
        load = calculateRunLoad(dur, rpe);
      }
      break;
    }
    case 'strength': {
      const dur  = partial.strengthDurationMin ?? 0;
      const rpe  = partial.rpe ?? 7;
      const exes = partial.exercises?.length ?? 0;
      load = calculateStrengthLoad(dur, rpe, exes);
      break;
    }
    case 'cross_training': {
      const dur = partial.crossDurationMin ?? 0;
      const rpe = partial.rpe ?? 6;
      load = calculateCrossTrainingLoad(dur, rpe);
      break;
    }
    case 'mobility': {
      const dur = partial.mobilityDurationMin ?? 0;
      load = calculateMobilityLoad(dur);
      break;
    }
    default: {
      const dur = partial.otherDurationMin ?? 0;
      const rpe = partial.rpe ?? 5;
      load = calculateRunLoad(dur, rpe);
    }
  }

  return {
    ...partial,
    estimatedLoad: load,
    fatigueImpact: loadToFatigueImpact(load),
  };
}

// ─── Workout category label ───────────────────────────────────────────────────

export function categoryLabel(cat: CustomWorkoutCategory): string {
  switch (cat) {
    case 'running':        return 'Run';
    case 'strength':       return 'Strength';
    case 'cross_training': return 'Cross Training';
    case 'mobility':       return 'Mobility';
    case 'other':          return 'Other';
  }
}

export function runTypeLabel(type: RunWorkoutType): string {
  switch (type) {
    case 'recovery':      return 'Recovery';
    case 'easy':          return 'Easy';
    case 'long_run':      return 'Long Run';
    case 'intervals':     return 'Intervals';
    case 'tempo':         return 'Tempo';
    case 'threshold':     return 'Threshold';
    case 'marathon_pace': return 'Marathon Pace';
    case 'vo2':           return 'VO₂ Max';
    case 'hills':         return 'Hills';
    case 'fartlek':       return 'Fartlek';
    case 'race':          return 'Race';
    case 'time_trial':    return 'Time Trial';
  }
}
