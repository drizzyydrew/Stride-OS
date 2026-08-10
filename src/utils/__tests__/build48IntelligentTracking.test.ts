import assert from 'node:assert/strict';
import test from 'node:test';

import {
  liveActivityCommandMatchesSession,
  normalizeOutdoorLiveActivitySnapshot,
} from '../../lib/liveActivityContracts';
import { initialAutoPauseState, reduceAutoPause, type AutoPauseSample } from '../autoPause';
import { initialDetectionState, reduceActivityDetection } from '../activityDetection';
import { buildHealthKitActivityDraft, isDuplicateHealthKitWorkout, reconcileHealthKitWorkout, type HealthKitWorkoutCandidate } from '../healthKitImport';
import { labelForMetricSource } from '../metricSources';
import { buildStrideReport, buildStrideReportSharePayload, strideReportHighlightsForUnits } from '../strideReport';
import { treadmillMetricAvailability } from '../treadmillPlacement';
import { workoutKitEligibilityForSession } from '../workoutKit';
import type { Activity } from '../../types/activity';
import type { ScheduledSession } from '../scheduledSessions';

function sample(atMs: number, overrides: Partial<Omit<AutoPauseSample, 'atMs'>> = {}): AutoPauseSample {
  return {
    atMs,
    speedMps: 0.1,
    displacementMeters: 1,
    horizontalAccuracyMeters: 8,
    motion: 'stationary' as const,
    ...overrides,
  };
}

function runDetector<TState, TDecision extends { state: TState }>(
  state: TState,
  reducer: (state: TState, atMs: number) => TDecision,
  samples: readonly number[],
): TDecision {
  let decision = reducer(state, samples[0] ?? 0);
  for (const atMs of samples.slice(1)) decision = reducer(decision.state, atMs);
  return decision;
}

const scheduledRun = {
  scheduledSessionId: 'week:2026-08-01:run:w1:0',
  date: '2026-08-01',
  originalDate: '2026-08-01',
  activityType: 'run',
  subtype: 'easy_run',
  title: 'Easy Run',
  purpose: 'Aerobic',
  priority: 'primary',
  durationMinutes: 45,
  distanceMiles: 5,
  target: 'Easy',
  status: 'today',
} as ScheduledSession;

test('Build 48 Live Activity payload is keyed to workoutInstanceId and rejects wrong instance commands', () => {
  const payload = normalizeOutdoorLiveActivitySnapshot({
    sessionId: 'legacy-run-id',
    workoutInstanceId: 'week:2026-08-01:run:w1:0:1000',
    sessionSource: 'running',
    activityName: 'Easy Run',
    activityType: 'running',
    elapsedSeconds: 61,
    distanceMiles: 0.5,
    averagePace: '9:01',
    heartRateBpm: 142,
    isPaused: false,
  });

  assert.equal(payload.workoutInstanceId, 'week:2026-08-01:run:w1:0:1000');
  assert.equal(payload.sessionId, 'legacy-run-id');
  assert.equal(liveActivityCommandMatchesSession(
    { workoutInstanceId: payload.workoutInstanceId, sessionSource: 'running' },
    { sessionId: payload.workoutInstanceId, sessionSource: 'running' },
  ), true);
  assert.equal(liveActivityCommandMatchesSession(
    { workoutInstanceId: 'different-workout', sessionSource: 'running' },
    { sessionId: payload.workoutInstanceId, sessionSource: 'running' },
  ), false);
});

test('Build 48 auto-pause uses two-second GPS stop and movement windows for run and ride tracking', () => {
  const state = initialAutoPauseState('running', 'running_and_cycling');
  const poorGps = reduceAutoPause(state, sample(0, { horizontalAccuracyMeters: 80 }));
  assert.equal(poorGps.action, 'none');
  assert.equal(poorGps.state.stationarySamples, 0);

  const briefStop = runDetector(state, (next, atMs) => reduceAutoPause(next, sample(atMs)), [0, 1_000]);
  assert.equal(briefStop.action, 'none');

  const paused = runDetector(state, (next, atMs) => reduceAutoPause(next, sample(atMs)), [0, 2_000]);
  assert.equal(paused.action, 'auto_pause');
  assert.equal(paused.state.paused, true);

  const resumed = runDetector(paused.state, (next, atMs) => reduceAutoPause(next, sample(atMs, {
    speedMps: 1.4,
    displacementMeters: 20,
    motion: 'running',
    cadenceRpm: 165,
  })), [3_000, 5_000]);
  assert.equal(resumed.action, 'auto_resume');
  assert.equal(resumed.state.paused, false);

  const ride = runDetector(initialAutoPauseState('cycling', 'running_and_cycling'), (next, atMs) => reduceAutoPause(next, sample(atMs, {
    speedMps: 0,
    displacementMeters: 0.5,
    horizontalAccuracyMeters: 8,
  })), [0, 2_000]);
  assert.equal(ride.action, 'auto_pause');
});

test('Build 48 activity detection suggests only after sustained opt-in evidence and cooldown blocks repeats', () => {
  const state = initialDetectionState('suggest_running_and_cycling');
  const decision = runDetector(state, (next, atMs) => reduceActivityDetection(next, sample(atMs, {
    speedMps: 3.1,
    displacementMeters: 30,
    horizontalAccuracyMeters: 12,
    motion: 'running',
    cadenceRpm: 166,
  })), [0, 70_000, 140_000, 210_000, 280_000, 350_000, 420_000, 490_000]);
  assert.equal(decision.action, 'suggest');
  if (decision.action === 'suggest') {
    assert.equal(decision.title, 'Running detected');
  }

  const cooldown = reduceActivityDetection(decision.state, sample(500_000, {
    speedMps: 3.0,
    horizontalAccuracyMeters: 10,
    motion: 'running',
  }));
  assert.equal(cooldown.action, 'none');

  const disabled = reduceActivityDetection(initialDetectionState('off'), sample(0, {
    speedMps: 6,
    motion: 'cycling',
  }));
  assert.equal(disabled.action, 'none');
});

test('Build 48 treadmill placement prevents stationary-phone motion metrics', () => {
  const resting = treadmillMetricAvailability({ placement: 'resting_on_treadmill' });
  assert.equal(resting.distance, 'unavailable');
  assert.equal(resting.cadence, 'unavailable');
  assert.equal(resting.autoPauseAvailable, false);
  assert.equal(labelForMetricSource(resting.distance), 'Unavailable');

  const onBody = treadmillMetricAvailability({ placement: 'on_body' });
  assert.equal(onBody.distance, 'phone_motion');
  assert.equal(onBody.cadence, 'phone_motion');

  const connected = treadmillMetricAvailability({ placement: 'connected_sensor', connectedSource: 'ftms_treadmill' });
  assert.equal(connected.distance, 'ftms_treadmill');
});

test('Build 48 WorkoutKit eligibility supports honest run exports and rejects unsupported types', () => {
  const run = workoutKitEligibilityForSession(scheduledRun);
  assert.equal(run.supported, true);
  if (run.supported) assert.equal(run.workoutKind, 'running');

  const strength = workoutKitEligibilityForSession({
    ...scheduledRun,
    scheduledSessionId: 'strength',
    activityType: 'strength',
    durationMinutes: 35,
  } as ScheduledSession);
  assert.equal(strength.supported, false);
});

test('Build 48 HealthKit import dedupes by uuid/source and reconciles high-confidence planned workouts', () => {
  const candidate: HealthKitWorkoutCandidate = {
    uuid: 'hk-1',
    sourceBundleIdentifier: 'com.apple.health',
    sourceName: 'Apple Watch',
    deviceName: 'Apple Watch',
    startTime: new Date(2026, 7, 1, 7, 30).getTime(),
    endTime: new Date(2026, 7, 1, 8, 15).getTime(),
    activityType: 'running',
    durationSeconds: 45 * 60,
    distanceMeters: 5 * 1609.344,
    energyKcal: 410,
    averageHeartRateBpm: 145,
    routeAvailable: true,
  };
  const reconciliation = reconcileHealthKitWorkout(candidate, [scheduledRun]);
  assert.equal(reconciliation.status, 'matched');

  const draft = buildHealthKitActivityDraft({ candidate, reconciliation, importedAt: 123 });
  assert.equal(draft.scheduledSessionId, scheduledRun.scheduledSessionId);
  assert.equal(draft.metrics.metricSources?.distance, 'apple_watch');
  assert.equal(draft.healthKit?.localCalendarDate, '2026-08-01');
  assert.equal(draft.healthKit?.routeStatus, 'available');

  assert.equal(isDuplicateHealthKitWorkout(candidate, [draft as Activity]), true);
  assert.equal(isDuplicateHealthKitWorkout({ ...candidate, uuid: 'hk-2' }, [draft as Activity]), false);
});

test('Build 48 Stride Report formats Most climbing in selected units and has shoe share payload', () => {
  const activity = {
    id: 'run-1',
    activityType: 'running',
    subtype: 'outdoor',
    source: 'tracked',
    status: 'completed',
    scheduled: false,
    startTime: new Date(2026, 7, 1, 8).getTime(),
    endTime: new Date(2026, 7, 1, 9).getTime(),
    shoeId: 'shoe-1',
    metrics: {
      durationSeconds: 3600,
      distanceMeters: 10 * 1609.344,
      elevationGainMeters: 100,
      distanceSource: 'gps',
    },
  } as Activity;
  const report = buildStrideReport({
    period: 'weekly',
    activities: [activity],
    shoes: [{ id: 'shoe-1', brand: 'Saucony', model: 'Ride', active: true, addedAt: 1 }],
    now: new Date(2026, 7, 1, 12),
  });
  const imperialHighlight = strideReportHighlightsForUnits(report, 'imperial').find(item => item.label === 'Most climbing');
  const metricHighlight = strideReportHighlightsForUnits(report, 'metric').find(item => item.label === 'Most climbing');
  assert.equal(imperialHighlight?.value, '328 ft');
  assert.equal(metricHighlight?.value, '100 m');

  const share = buildStrideReportSharePayload(report, 'shoe_report', 'imperial');
  assert.equal(share.variant, 'shoe_report');
  assert.equal(share.shoeReport.privacyDefaults.includePhotos, false);
  assert.equal(share.headline, 'Saucony Ride · 10.0 mi');
});
