// ─── Workout Step Flattening ───────────────────────────────────────────────
//
// Pure helper that turns a RichWorkout's warmup/mainSet/cooldown structure
// into a flat, indexable list of steps. Used by the treadmill live panel (no
// GPS distance markers indoors, so progress is tracked by workout step
// instead) and reuses `activeRunStore.currentIntervalIndex` /
// `advanceInterval()` as the index into this list.
//
// Segment durations are free-text ("15 min", "2 miles", "Easy/conversational")
// — only ones that parse as "<number> min" contribute to a remaining-time
// countdown. Non-minute segments (distance-based, or free text) are shown
// with a null duration rather than a fabricated number.

import type { RichWorkout, WorkoutSegment } from '../types/workout';

export type FlatWorkoutStep = {
  index: number;
  label: string;
  instructions: string;
  paceGuide?: string;
  hrZone?: number;
  durationMinutes: number | null;
};

function parseDurationMinutes(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+(?:\.\d+)?)\s*min/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function toStep(index: number, label: string, segment: WorkoutSegment): FlatWorkoutStep {
  return {
    index,
    label,
    instructions: segment.instructions,
    paceGuide: segment.paceGuide,
    hrZone: segment.hrZone,
    durationMinutes: parseDurationMinutes(segment.duration),
  };
}

export function flattenWorkoutSteps(workout: Pick<RichWorkout, 'warmup' | 'mainSet' | 'cooldown'>): FlatWorkoutStep[] {
  const steps: FlatWorkoutStep[] = [];
  steps.push(toStep(0, workout.warmup.label || 'Warmup', workout.warmup));
  workout.mainSet.forEach((segment, i) => {
    steps.push(toStep(steps.length, segment.label || `Main Set ${i + 1}`, segment));
  });
  steps.push(toStep(steps.length, workout.cooldown.label || 'Cooldown', workout.cooldown));
  return steps;
}

// Sum of remaining steps' durations, from `currentIndex` (inclusive) to the
// end. Returns null (never a wrong partial number) if any remaining step's
// duration couldn't be parsed as minutes.
export function totalRemainingMinutes(steps: FlatWorkoutStep[], currentIndex: number): number | null {
  const remaining = steps.slice(Math.max(0, currentIndex));
  if (remaining.length === 0) return 0;
  if (remaining.some(step => step.durationMinutes == null)) return null;
  return remaining.reduce((sum, step) => sum + (step.durationMinutes ?? 0), 0);
}

export function clampStepIndex(steps: FlatWorkoutStep[], index: number): number {
  if (steps.length === 0) return 0;
  return Math.max(0, Math.min(steps.length - 1, index));
}
