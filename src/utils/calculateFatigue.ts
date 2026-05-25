import type { WorkoutIntensity, WorkoutType, CompletedWorkoutRecord } from '../types/training';

// ─── Model constants ──────────────────────────────────────────────────────────
//
// DECAY: 10% fatigue drop per idle day (exponential, ~6.5-day half-life).
//   Mirrors the ATL (Acute Training Load) time constant used in sports science.
//
// SCALE: converts TSS-analog load to fatigue points.
//   Tuned so a hard 60-min session adds ~26 points, an easy 45-min run ~9 points.
//
// INTENSITY_MULTIPLIER: how hard each zone stresses the system relative to
//   a moderate-intensity effort. Easy/very_easy are below 1.0 — they build
//   aerobic capacity without significant physiological stress.
//
// Long run multiplier (1.40): long runs cause disproportionate muscle damage
//   and glycogen depletion beyond what duration × intensity captures alone.
//
// Easy bonus (−2/−4): active recovery effect — low-intensity blood flow speeds
//   metabolite clearance, netting a small fatigue reduction vs sitting still.

const DAY_MS = 24 * 60 * 60 * 1000;
const DECAY  = 0.90;
const SCALE  = 0.32;

const INTENSITY_MULTIPLIER: Record<WorkoutIntensity, number> = {
  rest:      0,
  very_easy: 0.70,
  easy:      0.85,
  moderate:  1.00,
  hard:      1.20,
  max:       1.45,
};

export type FatigueInput = {
  currentFatigue: number;
  estimatedLoad:  number;
  workoutType:    WorkoutType;
  intensity:      WorkoutIntensity;
  history:        CompletedWorkoutRecord[];  // all prior completions (before this workout)
};

export function calculateUpdatedFatigue({
  currentFatigue,
  estimatedLoad,
  workoutType,
  intensity,
  history,
}: FatigueInput): number {
  // Time-based decay: how many days have passed since the most recent prior workout?
  // If no history, assume this is the first-ever workout (no decay to apply).
  const lastMs = history.length > 0
    ? Math.max(...history.map(r => r.timestamp))
    : Date.now();
  const daysSinceLast = Math.max(0, (Date.now() - lastMs) / DAY_MS);
  const decayed = currentFatigue * Math.pow(DECAY, daysSinceLast);

  if (intensity === 'rest') {
    // Rest day: natural decay + extra −5 recovery push
    return Math.max(0, Math.round(decayed - 5));
  }

  const longRunMultiplier = workoutType === 'long_run' ? 1.40 : 1.00;
  const stress = estimatedLoad * SCALE * INTENSITY_MULTIPLIER[intensity] * longRunMultiplier;

  // Active recovery bonus for aerobic base work
  const easyBonus = intensity === 'very_easy' ? -4 : intensity === 'easy' ? -2 : 0;

  return Math.max(0, Math.min(100, Math.round(decayed + stress + easyBonus)));
}
