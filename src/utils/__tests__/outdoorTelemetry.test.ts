import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { appendTelemetrySamples, EMPTY_OUTDOOR_TELEMETRY, isFreshObservation, outdoorTelemetryMetrics, selectLiveTelemetry } from '../outdoorTelemetry';
import { liveCyclingPower } from '../liveCyclingPower';
import { capturedRunTelemetryMetrics } from '../capturedRunTelemetryMetrics';
import { sanitizeActivityMetrics } from '../activityLoad';
import { outdoorSportFromWatch, OUTDOOR_SPORTS } from '../outdoorSports';
import { normalizeOutdoorLiveActivitySnapshot } from '../../lib/liveActivityContracts';
import { isSourceAuthoritativeForMetric } from '../metricSources';
import { buildHealthKitActivityDraft, healthKitQuantity, healthKitRecordingIdentity, healthKitRecordingMetadata } from '../healthKitImport';
import type { PowerSample } from '../../types/activity';
import { watchRecordingForEvent } from '../watchRecordingEvidence';

test('observation freshness rejects pre-session, future, missing and stale timestamps', () => {
  assert.equal(isFreshObservation(12_000, 10_000, 20_000), true);
  for (const at of [9_999, 20_001, NaN, Infinity]) assert.equal(isFreshObservation(at, 10_000, 20_000), false);
  assert.equal(isFreshObservation(10_000, 0, 20_001), false);
});

test('telemetry retains observation timestamps and deduplicates by source and timestamp', () => {
  const sample = { timestamp: 12_000, bpm: 123, source: 'apple_watch' as const };
  const first = appendTelemetrySamples(EMPTY_OUTDOOR_TELEMETRY, { rawHeartRateSamples: [sample] }, 10_000, 20_000);
  const second = appendTelemetrySamples(first, { rawHeartRateSamples: [sample, { ...sample, timestamp: 13_000 }] }, 10_000, 20_000);
  assert.deepEqual(second.rawHeartRateSamples.map(value => value.timestamp), [12_000, 13_000]);
  assert.equal(first.rawHeartRateSamples.length, 1);
});

test('zero sensor cadence/power remain valid and model estimates need a version', () => {
  const result = appendTelemetrySamples(EMPTY_OUTDOOR_TELEMETRY, {
    cadenceSamples: [{ kind: 'steps', cadenceSpm: 0, timestamp: 10_000, source: 'phone_motion' }],
    powerSamples: [
      { timestamp: 10_000, sport: 'cycling', watts: 0, source: 'cycling_power_meter', kind: 'measured' },
      { timestamp: 11_000, sport: 'cycling', watts: 100, source: 'model_estimate', kind: 'model_estimated', modelVersion: '' },
    ],
  }, 1, 12_000);
  assert.equal(result.cadenceSamples.length, 1);
  assert.equal(result.powerSamples.length, 1);
  assert.equal(result.powerSamples[0]?.watts, 0);
});

test('live arbitration prefers fresh device data without blending model power', () => {
  const live = selectLiveTelemetry({ rawHeartRateSamples: [], cadenceSamples: [
    { timestamp: 12_000, kind: 'steps', cadenceSpm: 150, source: 'apple_watch' },
    { timestamp: 13_000, kind: 'steps', cadenceSpm: 100, source: 'phone_motion' },
  ], powerSamples: [
    { timestamp: 12_000, watts: 200, sport: 'cycling', kind: 'measured', source: 'cycling_power_meter' },
    { timestamp: 13_000, watts: 300, sport: 'cycling', kind: 'model_estimated', source: 'model_estimate', modelVersion: '1' },
  ] }, 1, 14_000);
  assert.equal(live.cadenceSample?.source, 'apple_watch');
  assert.equal(live.powerSample?.watts, 200);
});

const cyclingInput = {
  activityType: 'cycling', isPaused: false, recordingPauses: [], bodyMassKg: 70, bikeMassKg: 10, now: 11_000,
  points: [0, 1, 2].map(index => ({ latitude: 0, longitude: index * 0.0001, timestamp: 1_000 + index * 5_000, altitudeMeters: 0, accuracyMeters: 5 })),
};

test('live cycling estimate uses known altitude and explicit masses and keeps model provenance', () => {
  const result = liveCyclingPower(cyclingInput);
  assert.ok(result && result.watts > 0);
  assert.equal(result.kind, 'model_estimated');
  assert.equal(result.source, 'model_estimate');
  assert.equal(result.modelVersion, 'stride-road-load/2');
  assert.equal(result.timestamp, 11_000);
});

test('live cycling model rejects indoor/unsupported, pauses, stale, gaps and missing altitude/accuracy', () => {
  for (const activityType of ['running', 'indoor_cycling', 'ski_touring', 'snowboarding']) assert.equal(liveCyclingPower({ ...cyclingInput, activityType }), null);
  assert.equal(liveCyclingPower({ ...cyclingInput, isPaused: true }), null);
  assert.equal(liveCyclingPower({ ...cyclingInput, now: 16_001 }), null);
  assert.equal(liveCyclingPower({ ...cyclingInput, bodyMassKg: NaN }), null);
  assert.equal(liveCyclingPower({ ...cyclingInput, recordingPauses: [{ startTime: 2_000, endTime: 4_000 }] }), null);
  assert.equal(liveCyclingPower({ ...cyclingInput, points: cyclingInput.points.map(point => ({ ...point, altitudeMeters: undefined })) }), null);
  assert.equal(liveCyclingPower({ ...cyclingInput, points: cyclingInput.points.map(point => ({ ...point, accuracyMeters: undefined })) }), null);
  assert.equal(liveCyclingPower({ ...cyclingInput, points: cyclingInput.points.map(point => ({ ...point, accuracyMeters: 30 })) }), null);
  assert.equal(liveCyclingPower({ ...cyclingInput, points: cyclingInput.points.map((point, index) => ({ ...point, timestamp: index === 0 ? 0 : point.timestamp })) }), null);
});

test('summary excludes pauses and never carries the pre-pause HR into resumed time', () => {
  const result = outdoorTelemetryMetrics({
    ...EMPTY_OUTDOOR_TELEMETRY,
    rawHeartRateSamples: [
      { timestamp: 0, bpm: 100, source: 'apple_watch' },
      { timestamp: 20_000, bpm: 200, source: 'heart_rate_monitor' },
    ],
    startedAt: 0, recordingPauses: [{ startTime: 5_000, endTime: 15_000 }], isPaused: false, pausedAt: null,
  }, 25_000);
  assert.equal(result.heartRateSummary?.source, 'mixed');
  assert.equal(result.heartRateSummary?.sessionSeconds, 15);
  assert.equal(result.heartRateSummary?.coverageSeconds, 10);
  assert.equal(result.averageHeartRateBpm, 150);
});

test('sparse HR never fabricates a completion average', () => {
  const result = outdoorTelemetryMetrics({
    ...EMPTY_OUTDOOR_TELEMETRY, rawHeartRateSamples: [{ timestamp: 1, bpm: 123, source: 'healthkit' }],
    startedAt: 1, recordingPauses: [], isPaused: false, pausedAt: null,
  }, 120_001);
  assert.equal(result.averageHeartRateBpm, undefined);
  assert.equal(result.maximumHeartRateBpm, 123);
  assert.equal(result.heartRateSummary?.averageReliable, false);
});

test('captured run metrics survive finish reset and compute only covered cadence/power averages', () => {
  const powerSamples: PowerSample[] = [0, 10_000, 20_000].map(offset => ({ timestamp: 1 + offset, watts: 200,
    sport: 'running', source: 'apple_watch', kind: 'device_estimated' }));
  const result = capturedRunTelemetryMetrics({
    ...EMPTY_OUTDOOR_TELEMETRY, powerSamples,
    cadenceSamples: [0, 10_000, 20_000].map(offset => ({ timestamp: 1 + offset, kind: 'steps', cadenceSpm: 160, source: 'apple_watch' })),
    recordingPauses: [], startTime: null, telemetryStartedAt: 1, telemetryEndedAt: 30_001, isPaused: false, pausedAt: null,
  });
  assert.equal(result.cadenceSpm, 160);
  assert.equal(result.runningPowerWatts, 200);
  assert.deepEqual(result.powerSamples, powerSamples);
  assert.notEqual(result.powerSamples, powerSamples);
  assert.notEqual(result.powerSamples?.[0], powerSamples[0]);
});

test('outdoor scalar summaries keep cadence units and power sport/kind separate, including measured zero', () => {
  const offsets = [0, 10_000, 20_000];
  const result = outdoorTelemetryMetrics({ ...EMPTY_OUTDOOR_TELEMETRY, startedAt: 1,
    recordingPauses: [], isPaused: false, pausedAt: null,
    cadenceSamples: offsets.flatMap(offset => [
      { timestamp: 1 + offset, kind: 'steps' as const, cadenceSpm: 150, source: 'phone_motion' as const },
      { timestamp: 1 + offset, kind: 'cycling' as const, cadenceRpm: 80, source: 'cycling_cadence_sensor' as const },
    ]),
    powerSamples: offsets.flatMap(offset => [
      { timestamp: 1 + offset, sport: 'running' as const, kind: 'device_estimated' as const, watts: 200, source: 'apple_watch' as const },
      { timestamp: 1 + offset, sport: 'cycling' as const, kind: 'measured' as const, watts: 0, source: 'cycling_power_meter' as const },
      { timestamp: 1 + offset, sport: 'cycling' as const, kind: 'model_estimated' as const, watts: 300, source: 'model_estimate' as const, modelVersion: '2' },
    ]),
  }, 30_001);
  assert.equal(result.cadenceSpm, 150);
  assert.equal(result.cadenceRpm, 80);
  assert.equal(result.runningPowerWatts, 200);
  assert.equal(result.cyclingPowerWatts, 0);
});

test('numeric summaries cap sparse samples, merge pause overlap and never carry pre-pause values after resume', () => {
  const state = { ...EMPTY_OUTDOOR_TELEMETRY, startedAt: 0, isPaused: false, pausedAt: null,
    recordingPauses: [{ startTime: 5_000, endTime: 12_000 }, { startTime: 10_000, endTime: 15_000 }],
    cadenceSamples: [{ timestamp: 0, kind: 'steps' as const, cadenceSpm: 100, source: 'apple_watch' as const },
      { timestamp: 15_000, kind: 'steps' as const, cadenceSpm: 200, source: 'apple_watch' as const }],
  };
  const result = outdoorTelemetryMetrics(state, 20_000);
  assert.equal(result.cadenceSpm, 150);
  assert.deepEqual(result.recordingPauses, [{ startTime: 5_000, endTime: 15_000 }]);
  assert.equal(outdoorTelemetryMetrics({ ...state, recordingPauses: [] }, 100_000).cadenceSpm, undefined);
  assert.equal(outdoorTelemetryMetrics({ ...state, cadenceSamples: state.cadenceSamples.slice(0, 1) }, 20_000).cadenceSpm, undefined);
});

test('HealthKit exact lineage survives metadata and import without date-derived IDs', () => {
  const identity = { workoutInstanceId: 'instance/exact', strideOSActivityId: 'activity-exact', strideOSWorkoutId: 'workout-exact' };
  const decoded = healthKitRecordingIdentity(healthKitRecordingMetadata(identity));
  assert.deepEqual(decoded, identity);
  const draft = buildHealthKitActivityDraft({ candidate: { ...decoded, uuid: 'hk-uuid', sourceBundleIdentifier: 'app',
    startTime: 1, endTime: 10_001, durationSeconds: 10, activityType: 'running' } });
  assert.equal(draft.workoutInstanceId, identity.workoutInstanceId);
  for (const [key, value] of Object.entries(identity)) assert.equal(draft.healthKit?.[key as keyof typeof identity], value);
  assert.deepEqual(healthKitRecordingIdentity({ StrideOSWorkoutInstanceId: 123, StrideOSActivityId: ' ', StrideOSWorkoutId: null }),
    { workoutInstanceId: undefined, strideOSActivityId: undefined, strideOSWorkoutId: undefined });
});

test('Watch recording evidence requires native recording state and an exact ID, not connectivity or clock overlap', () => {
  const event = { workoutInstanceId: 'exact', state: 'running', timestamp: 123_000 };
  assert.deepEqual(watchRecordingForEvent('exact', event), { workoutInstanceId: 'exact', confirmedAt: 123_000, state: 'running' });
  assert.equal(watchRecordingForEvent('other', event), undefined);
  assert.equal(watchRecordingForEvent('exact', { ...event, workoutInstanceId: undefined }), undefined);
  assert.equal(watchRecordingForEvent('exact', { ...event, state: 'connected' }), undefined);
  assert.equal(watchRecordingForEvent('exact', { ...event, timestamp: NaN }), undefined);
  assert.equal(watchRecordingForEvent(undefined, event), undefined);
  assert.equal(watchRecordingForEvent('exact', { ...event, state: 'ended' })?.state, 'ended');
});

test('store sanitization preserves telemetry provenance and drops cadence/power for incompatible sports', () => {
  const rawHeartRateSamples = [{ timestamp: 1, bpm: 123, source: 'apple_watch' as const }];
  const metrics = { rawHeartRateSamples, cadenceSamples: [{ timestamp: 1, kind: 'steps' as const, cadenceSpm: 160, source: 'phone_motion' as const }],
    powerSamples: [{ timestamp: 1, sport: 'running' as const, watts: 200, kind: 'device_estimated' as const, source: 'apple_watch' as const }],
    metricSources: { power: 'apple_watch' as const } };
  assert.deepEqual(sanitizeActivityMetrics('running', metrics), metrics);
  const snow = sanitizeActivityMetrics('snowboard_touring', metrics);
  assert.equal(snow.powerSamples, undefined);
  assert.equal(snow.cadenceSamples, undefined);
  assert.equal(snow.rawHeartRateSamples, rawHeartRateSamples);
  assert.equal(isSourceAuthoritativeForMetric('model_estimate', 'power'), false);
});

test('all nine outdoor sport mappings round trip, and unknown sports do not become running', () => {
  assert.equal(Object.keys(OUTDOOR_SPORTS).length, 9);
  for (const [type, sport] of Object.entries(OUTDOOR_SPORTS)) assert.equal(outdoorSportFromWatch(sport.watchKind), type);
  assert.equal(outdoorSportFromWatch('unsupported'), null);
  assert.equal(outdoorSportFromWatch(undefined), null);
});

test('native live payload uses selected metric units without replacing canonical miles', () => {
  const payload = normalizeOutdoorLiveActivitySnapshot({ activityName: 'Ride', activityType: 'cycling', elapsedSeconds: 60,
    distanceMiles: 1, averageSpeedMph: 10, heartRateBpm: null, isPaused: false, unitSystem: 'metric',
    elevationGainMeters: 10, powerWatts: 200, powerKind: 'model_estimated', powerObservedAt: 123 });
  assert.equal(payload.metricUnit, 'km/h');
  assert.equal(payload.metricValue, '16.1');
  assert.equal(payload.distanceValue, '1.61');
  assert.equal(payload.distanceMiles, 1);
  assert.equal(payload.distanceUnit, 'km');
  assert.equal(payload.elevationDisplay, '10 m');
  assert.equal(payload.powerKind, 'model_estimated');
  assert.equal(payload.powerObservedAt, 123);
  const run = normalizeOutdoorLiveActivitySnapshot({ activityName: 'Run', activityType: 'running', elapsedSeconds: 60,
    distanceMiles: 1, averagePace: '8:00', heartRateBpm: null, isPaused: false, unitSystem: 'metric' });
  assert.equal(run.metricValue, '4:58');
  assert.equal(run.metricUnit, '/km');
  assert.equal(run.averagePace, '8:00');
});

test('watch changes retain the bounded Build 90 startup and 32-bit invariants', () => {
  const source = readFileSync('targets/StrideOSWatch/StrideWatchWorkoutManager.swift', 'utf8');
  assert.match(source, /Int64\(sentAt\.rounded\(\)\)/);
  assert.doesNotMatch(source, /\bInt\([^)]*(?:sentAt|timeIntervalSince1970)/);
  for (const guard of ['queued_start_ignored', 'handledPhoneCommandKeys.contains(commandKey)',
    'workoutSession === self.session', 'isDiscardingCurrentSession', 'provisionalTimeout',
    'guard !isEnding', 'sendEndedStateOnce', 'unsupported_workout_kind']) assert.ok(source.includes(guard), guard);
});

test('HealthKit object statistics are parsed without turning missing quantities into zero', () => {
  assert.equal(healthKitQuantity({ quantity: 123, unit: 'count/min' }), 123);
  assert.equal(healthKitQuantity(123), 123);
  assert.equal(healthKitQuantity({ quantity: 0, unit: 'm/s' }), 0);
  for (const value of [undefined, null, NaN, Infinity, '123', { quantity: null }]) assert.equal(healthKitQuantity(value), undefined);
});

test('recorded running dynamics, speed and steps survive HealthKit draft and store sanitization', () => {
  const metricsSummary = { stepCount: 1000, runningDynamics: { averageGroundContactTimeMs: 250,
    averageStrideLengthMeters: 1, averageVerticalOscillationMeters: 0.08 }, speed: { averageMetersPerSecond: 3 } };
  const draft = buildHealthKitActivityDraft({ candidate: { uuid: 'fixture', sourceBundleIdentifier: 'fixture',
    startTime: 1, endTime: 600_001, durationSeconds: 600, activityType: 'running', metricsSummary }, importedAt: 700_000 });
  const metrics = sanitizeActivityMetrics('running', draft.metrics);
  assert.deepEqual(metrics.runningDynamics, metricsSummary.runningDynamics);
  assert.deepEqual(metrics.speed, metricsSummary.speed);
  assert.equal(metrics.stepCount, 1000);
  assert.equal(metrics.metricSources?.steps, 'healthkit');
});
