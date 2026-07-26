// ─── Indoor Cycling: Pure Logic ───────────────────────────────────────────
//
// Distance for an indoor ride is NEVER inferred from heart rate, power,
// cadence, or duration. It is either what the athlete entered from the
// bike/trainer's own display, or it is honestly absent
// (`distanceSource: 'unavailable'`). This module holds every pure
// computation the live indoor-ride store and screen depend on, so the
// honesty rule and the instance/interval bookkeeping are unit-testable
// without React or a live zustand store.

import type { RichWorkout } from '../types/workout';
import type { ActivityDraft, CompletionClassification, DistanceSource } from '../types/activity';
import { activityStatusForClassification } from './activityCompletion';
import { buildWorkoutInstanceId } from './workoutInstance';
import { flattenWorkoutSteps } from './workoutSteps';
import type { IndoorHeartRateSample } from './indoorHeartRate';
import type { HeartRateSummary } from '../types/activity';

export type EquipmentDistanceEntry = {
  value: number;
  unit: 'mi' | 'km';
};

function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

// ── Honest distance ─────────────────────────────────────────────────────

// The only two states an indoor ride's distance can honestly be in: a
// converted value from what the athlete entered off the equipment display,
// or absent. No estimator, no fallback derived from HR/power/duration.
export function resolveIndoorRideDistance(
  entry: EquipmentDistanceEntry | null | undefined,
): { distanceMeters: number | undefined; distanceSource: DistanceSource } {
  if (!entry || !isFiniteNumber(entry.value) || entry.value <= 0) {
    return { distanceMeters: undefined, distanceSource: 'unavailable' };
  }
  const distanceMeters = entry.unit === 'km' ? entry.value * 1000 : entry.value * 1609.344;
  return { distanceMeters, distanceSource: 'equipment_display' };
}

// ── Live workout instance / transient reset ────────────────────────────────

export type IndoorRideStartConfig = {
  scheduledSessionId?: string | null;
  plannedWorkout?: RichWorkout | null;
};

export type IndoorRideFreshState = {
  workoutInstanceId: string;
  isActive: boolean;
  isPaused: boolean;
  startedAt: number;
  pausedAt: null;
  pausedDurationMs: number;
  scheduledSessionId: string | null;
  plannedWorkout: RichWorkout | null;
  currentIntervalIndex: number;
  heartRateBpm: null;
  heartRateSamples: IndoorHeartRateSample[];
  cadenceRpm: null;
  powerWatts: null;
  resistanceLevel: null;
  rpe: null;
  equipmentDistance: null;
  completionRequestedAt: null;
};

// Every startRide() call builds this from scratch — never derived from
// whatever the previous session left behind — so a fresh instance id and a
// full transient reset are guaranteed rather than merely intended.
export function buildFreshIndoorRideState(
  config: IndoorRideStartConfig,
  now: number = Date.now(),
): IndoorRideFreshState {
  return {
    workoutInstanceId: buildWorkoutInstanceId(config.scheduledSessionId ?? null, now),
    isActive: true,
    isPaused: false,
    startedAt: now,
    pausedAt: null,
    pausedDurationMs: 0,
    scheduledSessionId: config.scheduledSessionId ?? null,
    plannedWorkout: config.plannedWorkout ?? null,
    currentIntervalIndex: 0,
    heartRateBpm: null,
    heartRateSamples: [],
    cadenceRpm: null,
    powerWatts: null,
    resistanceLevel: null,
    rpe: null,
    equipmentDistance: null,
    completionRequestedAt: null,
  };
}

// ── Interval navigation ────────────────────────────────────────────────────

export function rideIntervalStepCountForWorkout(workout: RichWorkout | null | undefined): number {
  if (!workout) return 0;
  return flattenWorkoutSteps(workout).length;
}

// Shared bound for both "advance" and "skip": never goes below 0, never past
// the last step. A workout-less ride (free ride / no interval structure) has
// zero steps, so the index simply stays at 0.
export function advanceRideIntervalIndex(currentIndex: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  const safeCurrent = Number.isFinite(currentIndex) ? Math.max(0, Math.floor(currentIndex)) : 0;
  return Math.min(stepCount - 1, safeCurrent + 1);
}

// ── Completion draft ────────────────────────────────────────────────────────

export type IndoorRideCompletionInput = {
  startedAtMs: number;
  elapsedSeconds: number;
  scheduledSessionId?: string | null;
  associatedTrainingBlockId?: string;
  associatedGoalId?: string;
  averageHeartRateBpm?: number;
  maximumHeartRateBpm?: number;
  heartRateSummary?: HeartRateSummary;
  cadenceRpm?: number | null;
  powerWatts?: number | null;
  resistanceLevel?: string | null;
  rpe?: number | null;
  notes?: string;
  equipmentDistance?: EquipmentDistanceEntry | null;
  completionClassification?: CompletionClassification;
};

// Builds the Activity draft written when an indoor ride finishes. Reuses the
// exact metrics field names the rest of the app already writes for
// cycling (cadenceRpm, cyclingPowerWatts) rather than inventing new ones.
// Never attaches coordinates or a route — indoor sessions have none.
export function buildIndoorRideActivityDraft(
  input: IndoorRideCompletionInput,
): ActivityDraft {
  const durationSeconds = Math.max(0, Math.round(input.elapsedSeconds));
  const { distanceMeters, distanceSource } = resolveIndoorRideDistance(input.equipmentDistance);
  const classification = input.completionClassification ?? 'completed_as_prescribed';

  return {
    activityType: 'indoor_cycling',
    subtype: 'stationary',
    source: input.scheduledSessionId ? 'training_plan' : 'tracked',
    status: activityStatusForClassification(classification),
    completionClassification: classification,
    scheduled: Boolean(input.scheduledSessionId),
    associatedTrainingBlockId: input.associatedTrainingBlockId,
    associatedGoalId: input.associatedGoalId,
    scheduledSessionId: input.scheduledSessionId ?? undefined,
    startTime: input.startedAtMs,
    endTime: input.startedAtMs + durationSeconds * 1000,
    rpe: input.rpe ?? undefined,
    notes: input.notes?.trim() || undefined,
    indoor: true,
    metrics: {
      durationSeconds,
      elapsedTimeSeconds: durationSeconds,
      activeTimeSeconds: durationSeconds,
      distanceMeters,
      distanceSource,
      averageHeartRateBpm: input.averageHeartRateBpm,
      maximumHeartRateBpm: input.maximumHeartRateBpm,
      heartRateZoneSeconds: input.heartRateSummary?.zoneSeconds,
      heartRateSummary: input.heartRateSummary,
      cadenceRpm: input.cadenceRpm ?? undefined,
      cyclingPowerWatts: input.powerWatts ?? undefined,
      resistanceLevel: input.resistanceLevel ?? undefined,
    },
  };
}
