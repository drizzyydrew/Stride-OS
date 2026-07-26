import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceRideIntervalIndex,
  buildFreshIndoorRideState,
  buildIndoorRideActivityDraft,
  resolveIndoorRideDistance,
  rideIntervalStepCountForWorkout,
} from '../indoorRide';
import { calculateActivityLoad, sanitizeActivityMetrics } from '../activityLoad';
import type { RichWorkout } from '../../types/workout';

// ── Honest distance ─────────────────────────────────────────────────────

test('resolveIndoorRideDistance: no entry -> unavailable, no distanceMeters', () => {
  const result = resolveIndoorRideDistance(null);
  assert.equal(result.distanceSource, 'unavailable');
  assert.equal(result.distanceMeters, undefined);

  const undefinedEntry = resolveIndoorRideDistance(undefined);
  assert.equal(undefinedEntry.distanceSource, 'unavailable');
  assert.equal(undefinedEntry.distanceMeters, undefined);
});

test('resolveIndoorRideDistance: zero/negative/NaN entries are treated as absent, not fabricated', () => {
  assert.equal(resolveIndoorRideDistance({ value: 0, unit: 'mi' }).distanceSource, 'unavailable');
  assert.equal(resolveIndoorRideDistance({ value: -5, unit: 'mi' }).distanceSource, 'unavailable');
  assert.equal(resolveIndoorRideDistance({ value: NaN, unit: 'km' }).distanceSource, 'unavailable');
});

test('resolveIndoorRideDistance: equipment-display entry converts km -> mi and stamps equipment_display', () => {
  const fromKm = resolveIndoorRideDistance({ value: 20, unit: 'km' });
  assert.equal(fromKm.distanceSource, 'equipment_display');
  assert.ok(Math.abs((fromKm.distanceMeters ?? 0) - 20_000) < 1e-6);

  const fromMi = resolveIndoorRideDistance({ value: 10, unit: 'mi' });
  assert.equal(fromMi.distanceSource, 'equipment_display');
  assert.ok(Math.abs((fromMi.distanceMeters ?? 0) - 10 * 1609.344) < 1e-6);
});

test('buildIndoorRideActivityDraft: no equipment entry -> unavailable even with HR and power present', () => {
  const draft = buildIndoorRideActivityDraft({
    startedAtMs: 1_000_000,
    elapsedSeconds: 1800,
    averageHeartRateBpm: 142,
    maximumHeartRateBpm: 165,
    powerWatts: 210,
    cadenceRpm: 88,
    rpe: 6,
    equipmentDistance: null,
  });
  assert.equal(draft.metrics.distanceSource, 'unavailable');
  assert.equal(draft.metrics.distanceMeters, undefined);
  assert.equal(draft.activityType, 'indoor_cycling');
  assert.equal(draft.subtype, 'stationary');
  assert.equal(draft.indoor, true);
  assert.equal(draft.metrics.routeId, undefined);
  assert.equal(draft.metrics.routeCoordinates, undefined);
  // HR and power were provided but must never seed a distance value.
  assert.equal(draft.metrics.averageHeartRateBpm, 142);
  assert.equal(draft.metrics.cyclingPowerWatts, 210);
});

test('buildIndoorRideActivityDraft: HR alone or power alone never produces a distance', () => {
  const hrOnly = buildIndoorRideActivityDraft({
    startedAtMs: 0,
    elapsedSeconds: 1200,
    averageHeartRateBpm: 150,
    equipmentDistance: undefined,
  });
  assert.equal(hrOnly.metrics.distanceSource, 'unavailable');
  assert.equal(hrOnly.metrics.distanceMeters, undefined);

  const powerOnly = buildIndoorRideActivityDraft({
    startedAtMs: 0,
    elapsedSeconds: 1200,
    powerWatts: 220,
    equipmentDistance: undefined,
  });
  assert.equal(powerOnly.metrics.distanceSource, 'unavailable');
  assert.equal(powerOnly.metrics.distanceMeters, undefined);
});

test('buildIndoorRideActivityDraft: equipment-display entry stamps equipment_display and converts correctly', () => {
  const draft = buildIndoorRideActivityDraft({
    startedAtMs: 0,
    elapsedSeconds: 3600,
    equipmentDistance: { value: 15, unit: 'mi' },
    scheduledSessionId: 'week:2026-07-25:cycling:ride',
  });
  assert.equal(draft.metrics.distanceSource, 'equipment_display');
  assert.ok(Math.abs((draft.metrics.distanceMeters ?? 0) - 15 * 1609.344) < 1e-6);
  assert.equal(draft.scheduledSessionId, 'week:2026-07-25:cycling:ride');
  assert.equal(draft.scheduled, true);
  assert.equal(draft.source, 'training_plan');
});

test('buildIndoorRideActivityDraft: unscheduled free ride is tracked source, not scheduled', () => {
  const draft = buildIndoorRideActivityDraft({
    startedAtMs: 0,
    elapsedSeconds: 1800,
    equipmentDistance: null,
  });
  assert.equal(draft.scheduled, false);
  assert.equal(draft.source, 'tracked');
  assert.equal(draft.scheduledSessionId, undefined);
});

// ── Load computation: duration/HR/RPE only, never distance ────────────────

test('indoor_cycling load: session-RPE method is finite and > 0 with no distance at all', () => {
  const load = calculateActivityLoad({ activityType: 'indoor_cycling', durationMinutes: 45, rpe: 6 });
  assert.equal(load.method, 'session_rpe');
  assert.ok(Number.isFinite(load.wholeBody));
  assert.ok(load.wholeBody > 0);
  assert.equal(load.wholeBody, 45 * 6);
  assert.equal(load.nonImpactAerobic, load.wholeBody);
  assert.equal(load.crossTraining, load.wholeBody);
});

test('indoor_cycling load: HR-zone method is finite and > 0 with no distance and no RPE', () => {
  const load = calculateActivityLoad({
    activityType: 'indoor_cycling',
    durationMinutes: 40,
    heartRateZoneMinutes: { 2: 30, 3: 10 },
  });
  assert.equal(load.method, 'heart_rate_zones');
  assert.ok(Number.isFinite(load.wholeBody));
  assert.ok(load.wholeBody > 0);
});

test('indoor_cycling load: estimated fallback (no RPE, no HR zones) is still finite and > 0', () => {
  const load = calculateActivityLoad({ activityType: 'indoor_cycling', durationMinutes: 50 });
  assert.equal(load.method, 'estimated');
  assert.ok(Number.isFinite(load.wholeBody));
  assert.ok(load.wholeBody > 0);
});

test('sanitizeActivityMetrics preserves distanceSource/resistanceLevel for indoor_cycling round-trips', () => {
  const clean = sanitizeActivityMetrics('indoor_cycling', {
    durationSeconds: 1800,
    distanceSource: 'unavailable',
    resistanceLevel: '12',
    cyclingPowerWatts: 200,
  });
  assert.equal(clean.distanceSource, 'unavailable');
  assert.equal(clean.resistanceLevel, '12');
  assert.equal(clean.cyclingPowerWatts, 200);
  assert.equal(clean.distanceMeters, undefined);
});

// ── Instance identity / transient reset ─────────────────────────────────────

test('buildFreshIndoorRideState always produces a fresh instance id and a full transient reset', () => {
  const first = buildFreshIndoorRideState({ scheduledSessionId: 'week:2026-07-25:cycling:x' }, 1000);
  const second = buildFreshIndoorRideState({ scheduledSessionId: 'week:2026-07-25:cycling:x' }, 2000);
  assert.notEqual(first.workoutInstanceId, second.workoutInstanceId);
  assert.equal(first.workoutInstanceId, 'week:2026-07-25:cycling:x:1000');

  for (const state of [first, second]) {
    assert.equal(state.isActive, true);
    assert.equal(state.isPaused, false);
    assert.equal(state.pausedAt, null);
    assert.equal(state.pausedDurationMs, 0);
    assert.equal(state.currentIntervalIndex, 0);
    assert.equal(state.heartRateBpm, null);
    assert.equal(state.cadenceRpm, null);
    assert.equal(state.powerWatts, null);
    assert.equal(state.resistanceLevel, null);
    assert.equal(state.rpe, null);
    assert.equal(state.equipmentDistance, null);
    assert.equal(state.completionRequestedAt, null);
  }
});

test('buildFreshIndoorRideState: adhoc (free ride) instance id when no scheduledSessionId', () => {
  const fresh = buildFreshIndoorRideState({}, 5000);
  assert.equal(fresh.scheduledSessionId, null);
  assert.equal(fresh.workoutInstanceId, 'adhoc:5000');
});

// ── Interval navigation bounds ───────────────────────────────────────────

const workoutWithThreeSteps: RichWorkout = {
  id: 'w1',
  type: 'easy_run',
  richType: 'easy_run',
  title: 'Ride',
  purpose: 'Aerobic',
  durationMinutes: 30,
  hrZoneTarget: 2,
  rpeRange: [3, 4],
  paceGuidance: { targetPace: 'n/a', context: '' },
  score: { intendedLoad: 10, difficulty: 'easy' },
  paceRange: { minSecPerMi: 600, maxSecPerMi: 700 },
  dayIndex: 0,
  warmup: { label: 'Warmup', duration: '5 min', paceGuide: 'Easy', hrZone: 1, rpe: [2, 3], instructions: 'Spin easy.' },
  mainSet: [
    { label: 'Main Set', duration: '20 min', paceGuide: 'Steady', hrZone: 2, rpe: [4, 5], instructions: 'Steady effort.' },
  ],
  cooldown: { label: 'Cooldown', duration: '5 min', paceGuide: 'Easy', hrZone: 1, rpe: [2, 3], instructions: 'Spin down.' },
} as unknown as RichWorkout;

test('rideIntervalStepCountForWorkout: null workout has zero steps; a warmup/main/cooldown workout has 3', () => {
  assert.equal(rideIntervalStepCountForWorkout(null), 0);
  assert.equal(rideIntervalStepCountForWorkout(undefined), 0);
  assert.equal(rideIntervalStepCountForWorkout(workoutWithThreeSteps), 3);
});

test('advanceRideIntervalIndex: stays at 0 with no steps (free ride)', () => {
  assert.equal(advanceRideIntervalIndex(0, 0), 0);
  assert.equal(advanceRideIntervalIndex(5, 0), 0);
});

test('advanceRideIntervalIndex: advances one step at a time and clamps at the last step', () => {
  const stepCount = 3;
  assert.equal(advanceRideIntervalIndex(0, stepCount), 1);
  assert.equal(advanceRideIntervalIndex(1, stepCount), 2);
  // Already at the last step (index 2 of 3) — stays put, never overruns.
  assert.equal(advanceRideIntervalIndex(2, stepCount), 2);
  assert.equal(advanceRideIntervalIndex(99, stepCount), 2);
});

test('advanceRideIntervalIndex: negative/non-finite current index treated as 0 before advancing', () => {
  assert.equal(advanceRideIntervalIndex(-3, 3), 1);
  assert.equal(advanceRideIntervalIndex(NaN, 3), 1);
});
