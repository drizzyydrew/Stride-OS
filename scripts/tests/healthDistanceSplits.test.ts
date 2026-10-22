import test from 'node:test';
import assert from 'node:assert/strict';
import type { Activity, HealthKitDistanceEvidence } from '../../src/types/activity';
import { buildHealthDistanceSplits } from '../../src/utils/healthDistanceSplits';

const START = 1_700_000_000_000;
const UUID = '11111111-2222-4333-8444-555555555555';
const BUNDLE = 'com.apple.workout';
const MILE = 1609.344;

function evidence(distances = Array<number>(60).fill(1000 / 60)): HealthKitDistanceEvidence {
  return { version: 1, retrievedAt: START + distances.length * 10_000 + 1000,
    workoutUuid: UUID, sourceBundleIdentifier: BUNDLE, startTime: START,
    endTime: START + distances.length * 10_000, durationSeconds: distances.length * 10,
    totalDistanceMeters: distances.reduce((sum, distance) => sum + distance, 0), recordingPauses: [],
    samples: distances.map((distanceMeters, index) => ({ id: `sample-${index}`, sourceBundleIdentifier: BUNDLE,
      startTime: START + index * 10_000, endTime: START + (index + 1) * 10_000, distanceMeters })) };
}

function activity(data = evidence()): Activity {
  return { id: 'retained-run', activityType: 'running', source: 'healthkit', status: 'completed', scheduled: false,
    startTime: data.startTime, endTime: data.endTime, indoor: false, createdAt: START, updatedAt: START,
    trainingLoad: { method: 'estimated', wholeBody: 25, running: 25, walking: 0, strength: 0,
      crossTraining: 0, impactBearing: 25, nonImpactAerobic: 0, confidence: 'low' },
    metrics: { healthKitDistance: data }, healthKit: { workoutUuid: data.workoutUuid,
      sourceBundleIdentifier: data.sourceBundleIdentifier, originalStartTime: data.startTime,
      originalEndTime: data.endTime, localCalendarDate: '2023-11-14', importedAt: START,
      importedByStrideOS: false, routeStatus: 'not_available' } };
}

function withheld(run: Activity, reason: RegExp, status = 'partial') {
  const result = buildHealthDistanceSplits(run, 'metric');
  assert.equal(result?.status, status);
  assert.deepEqual(result?.splits, []);
  assert.match(result?.reason ?? '', reason);
}

function close(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('only absent evidence returns undefined, regardless of GPS', () => {
  const run = activity();
  delete run.metrics.healthKitDistance;
  run.metrics.routeCoordinates = [{ latitude: 0, longitude: 0, timestamp: START }];
  assert.equal(buildHealthDistanceSplits(run, 'metric'), undefined);
});

test('derives kilometers and final partial distance with linear interval boundaries', () => {
  const run = activity(evidence(Array<number>(75).fill(20)));
  const result = buildHealthDistanceSplits(run, 'metric')!;
  assert.equal(result.status, 'complete');
  assert.equal(result.splits.length, 2);
  assert.deepEqual(result.splits.map(split => [split.index, split.complete, split.reliable]), [[1, true, true], [2, false, true]]);
  close(result.splits[0]!.seconds, 500);
  close(result.splits[1]!.seconds, 250);
  close(result.splits[1]!.distanceMeters, 500);
  assert.equal(result.splits[0]!.paceLabel, '8:20 /km');
});

test('imperial boundaries interpolate within samples without changing total or time', () => {
  const result = buildHealthDistanceSplits(activity(evidence(Array<number>(100).fill(40))), 'imperial')!;
  assert.equal(result.status, 'complete');
  assert.equal(result.splits.length, 3);
  close(result.splits[0]!.distanceMeters, MILE);
  close(result.splits[0]!.seconds, MILE / 4);
  close(result.splits[2]!.distanceMeters, 4000 - 2 * MILE);
  close(result.splits.reduce((sum, split) => sum + split.seconds, 0), 1000);
  close(result.splits.reduce((sum, split) => sum + split.distanceMeters, 0), 4000);
});

test('Health 13.1-mile evidence ignores missing, inflated, or thinned GPS and edited summaries', () => {
  const data = evidence(Array<number>(800).fill(13.1 * MILE / 800));
  const run = activity(data);
  const expected = buildHealthDistanceSplits(run, 'imperial')!;
  run.startTime += 1000;
  run.endTime! -= 1000;
  run.metrics.durationSeconds = 99;
  run.metrics.distanceMeters = 13.4 * MILE;
  run.metrics.routeCoordinates = [{ latitude: 0, longitude: 0, timestamp: START },
    { latitude: 0, longitude: 1, timestamp: data.endTime }];
  assert.deepEqual(buildHealthDistanceSplits(run, 'imperial'), expected);
  assert.equal(expected.status, 'complete');
  assert.equal(expected.splits.length, 14);
  close(expected.splits[13]!.distanceMeters, 0.1 * MILE);
  assert.equal(expected.splits[13]!.complete, false);
});

test('sorts and collapses identical UUID duplicates without mutating inputs', () => {
  const run = activity();
  const data = run.metrics.healthKitDistance!;
  const expected = buildHealthDistanceSplits(run, 'metric');
  data.samples = [...data.samples].reverse();
  data.samples.push({ ...data.samples[0]! });
  const before = JSON.stringify(run);
  Object.freeze(data.samples);
  data.samples.forEach(Object.freeze);
  assert.deepEqual(buildHealthDistanceSplits(run, 'metric'), expected);
  assert.equal(JSON.stringify(run), before);
});

test('conflicting duplicate UUIDs reject the entire timeline', () => {
  const run = activity();
  const data = run.metrics.healthKitDistance!;
  data.samples.push({ ...data.samples[0]!, distanceMeters: 99 });
  withheld(run, /conflicting duplicate/);
});

test('different UUIDs with overlapping or identical intervals reject the entire timeline', () => {
  for (const shift of [0, 1]) {
    const run = activity();
    run.metrics.healthKitDistance!.samples.push({ ...run.metrics.healthKitDistance!.samples[0]!,
      id: 'another-device', startTime: START + shift });
    withheld(run, /overlap/);
  }
});

test('unknown offsets at start, middle, or end never produce GPS fallback or later splits', () => {
  for (const index of [0, 30, 59]) {
    const run = activity();
    run.metrics.routeCoordinates = [{ latitude: 0, longitude: 0, timestamp: START },
      { latitude: 0, longitude: 0.02, timestamp: run.endTime! }];
    run.metrics.healthKitDistance!.samples.splice(index, 1);
    withheld(run, /gap/);
  }
});

test('even a one-millisecond internal gap is not assumed to be zero distance', () => {
  const run = activity();
  run.metrics.healthKitDistance!.samples[30]!.startTime += 1;
  withheld(run, /gap/);
});

test('30 seconds is accepted; longer intervals are explicitly partial', () => {
  const data = evidence([100]);
  data.endTime = data.samples[0]!.endTime = START + 30_000;
  data.durationSeconds = 30;
  assert.equal(buildHealthDistanceSplits(activity(data), 'metric')?.status, 'complete');
  data.endTime = data.samples[0]!.endTime = START + 30_001;
  data.durationSeconds = 30.001;
  withheld(activity(data), /30-second/);
  const reason = buildHealthDistanceSplits(activity(data), 'metric')!.reason!;
  assert.match(reason, /Finer-grained distance data is unavailable to this build/);
  assert.doesNotMatch(reason, /delete|reimport|re-import/i);
});

test('zero-distance intervals retain stationary active time, including trailing whole-unit time', () => {
  const result = buildHealthDistanceSplits(activity(evidence([0, 500, 500, 0])), 'metric')!;
  assert.equal(result.status, 'complete');
  assert.equal(result.splits.length, 1);
  close(result.splits[0]!.seconds, 40);
  assert.equal(result.splits[0]!.complete, true);
  const stationary = buildHealthDistanceSplits(activity(evidence([0, 0])), 'metric');
  assert.deepEqual(stationary, { status: 'complete', splits: [] });
});

test('a zero sum cannot conceal a small missing positive total within the meter tolerance', () => {
  const run = activity(evidence([0, 0]));
  run.metrics.healthKitDistance!.totalDistanceMeters = 1;
  withheld(run, /distance total/);
});

test('confirmed pauses bridge coverage but never contribute active duration or split pace', () => {
  const data = evidence([500, 500]);
  data.samples[1]!.startTime += 60_000;
  data.samples[1]!.endTime += 60_000;
  data.endTime += 60_000;
  data.recordingPauses = [{ startTime: START + 10_000, endTime: START + 50_000 },
    { startTime: START + 30_000, endTime: START + 70_000 }];
  const before = JSON.stringify(data);
  const result = buildHealthDistanceSplits(activity(data), 'metric')!;
  assert.equal(result.status, 'complete');
  close(result.splits[0]!.seconds, 20);
  assert.equal(JSON.stringify(data), before);
});

test('sample crossing any part of a pause is rejected, even for zero distance', () => {
  for (const distance of [100, 0]) {
    const run = activity(evidence([distance, 100]));
    run.metrics.healthKitDistance!.recordingPauses = [{ startTime: START + 5000, endTime: START + 10_000 }];
    withheld(run, /overlap.*pause/);
  }
});

test('only duration rounding permits up to two seconds; no time or distance is rescaled', () => {
  const run = activity();
  const expected = buildHealthDistanceSplits(run, 'metric');
  for (const delta of [-2, 2]) {
    run.metrics.healthKitDistance!.durationSeconds = 600 + delta;
    assert.deepEqual(buildHealthDistanceSplits(run, 'metric'), expected);
  }
  run.metrics.healthKitDistance!.durationSeconds = 602.001;
  withheld(run, /active duration/);
});

test('distance total tolerance is max 5 meters or 0.05%, without modifying samples', () => {
  for (const [distance, allowed] of [[1000, 5], [20_000, 9.99]]) {
    const run = activity(evidence(Array<number>(100).fill(distance! / 100)));
    const before = buildHealthDistanceSplits(run, 'metric');
    run.metrics.healthKitDistance!.totalDistanceMeters = distance! - allowed!;
    assert.deepEqual(buildHealthDistanceSplits(run, 'metric'), before);
    run.metrics.healthKitDistance!.totalDistanceMeters = distance! - allowed! - 0.01;
    withheld(run, /distance total/);
  }
});

test('requires exact UUID, bundle, and original Health time context, not current edited times', () => {
  const mutations: ((run: Activity) => void)[] = [
    run => { delete run.healthKit; },
    run => { run.healthKit!.workoutUuid = '99999999-2222-4333-8444-555555555555'; },
    run => { run.healthKit!.sourceBundleIdentifier = 'other.source'; },
    run => { run.metrics.healthKitDistance!.workoutUuid = run.healthKit!.workoutUuid = 'invalid'; },
    run => { run.metrics.healthKitDistance!.sourceBundleIdentifier = run.healthKit!.sourceBundleIdentifier = 'unknown'; },
    run => { run.healthKit!.originalStartTime += 1; },
    run => { run.healthKit!.originalEndTime -= 1; },
    run => { run.metrics.healthKitDistance!.retrievedAt = NaN; },
    run => { (run.metrics.healthKitDistance as unknown as { version: number }).version = 2; },
  ];
  for (const mutate of mutations) {
    const run = activity();
    mutate(run);
    withheld(run, /match|invalid|unsupported/, 'unavailable');
  }
});

test('missing samples or original total are unavailable, never inferred from the activity summary', () => {
  const run = activity();
  run.metrics.distanceMeters = 1000;
  delete run.metrics.healthKitDistance!.totalDistanceMeters;
  withheld(run, /total.*unavailable/, 'unavailable');
  run.metrics.healthKitDistance = evidence();
  run.metrics.healthKitDistance.samples = [];
  withheld(run, /evidence.*unavailable/, 'unavailable');
});

test('invalid sample numbers, identifiers, bounds and nonpositive intervals fail closed', () => {
  const mutations: ((data: HealthKitDistanceEvidence) => void)[] = [
    data => { data.samples[0]!.id = ''; },
    data => { data.samples[0]!.distanceMeters = -1; },
    data => { data.samples[0]!.distanceMeters = NaN; },
    data => { data.samples[0]!.distanceMeters = Infinity; },
    data => { data.samples[0]!.startTime -= 1; },
    data => { data.samples[0]!.endTime = data.samples[0]!.startTime; },
    data => { data.samples[0]!.endTime = NaN; },
    data => { data.samples.at(-1)!.endTime += 1; },
  ];
  for (const mutate of mutations) {
    const run = activity();
    mutate(run.metrics.healthKitDistance!);
    withheld(run, /invalid interval/);
  }
});

test('invalid pause evidence is not silently ignored', () => {
  for (const pause of [{ startTime: START - 1, endTime: START },
    { startTime: START, endTime: Infinity }, { startTime: START, endTime: START }]) {
    const run = activity();
    run.metrics.healthKitDistance!.recordingPauses = [pause];
    withheld(run, /invalid recording pause/);
  }
});

test('weighted HR uses actual split times and the evidence pauses rather than edited activity pauses', () => {
  const run = activity(evidence(Array<number>(80).fill(25)));
  run.metrics.rawHeartRateSamples = Array.from({ length: 80 }, (_, index) => ({ timestamp: START + index * 10_000,
    bpm: index < 40 ? 140 : 180, source: 'healthkit' as const }));
  run.metrics.recordingPauses = [{ startTime: START, endTime: run.endTime! }];
  let result = buildHealthDistanceSplits(run, 'metric')!;
  assert.deepEqual(result.splits.map(split => split.averageHeartRateBpm), [140, 180]);
  run.metrics.rawHeartRateSamples = run.metrics.rawHeartRateSamples.slice(0, 10);
  result = buildHealthDistanceSplits(run, 'metric')!;
  assert.deepEqual(result.splits.map(split => split.averageHeartRateBpm), [undefined, undefined]);
});

test('speed-based sports reuse existing speed units instead of pace labels', () => {
  const run = activity(evidence(Array<number>(100).fill(100)));
  run.activityType = 'cycling';
  assert.equal(buildHealthDistanceSplits(run, 'metric')!.splits[0]!.paceLabel, '36.0 km/h');
  assert.equal(buildHealthDistanceSplits(run, 'imperial')!.splits[0]!.paceLabel, '22.4 mph');
});

test('a very small measured final partial remains present, not rounded up or discarded', () => {
  const result = buildHealthDistanceSplits(activity(evidence([500, 500, 1])), 'metric')!;
  assert.equal(result.splits.length, 2);
  assert.equal(result.splits[1]!.distanceMeters, 1);
  assert.equal(result.splits[1]!.complete, false);
  assert.equal(result.splits[1]!.seconds, 10);
});

test('pathological split counts terminate without emitting a partial timeline', () => {
  withheld(activity(evidence([1e12])), /calculation size/);
});

test('wrong or absent per-sample provenance rejects the whole timeline', () => {
  for (const source of ['other.source', '']) {
    const run = activity();
    run.metrics.healthKitDistance!.samples[0]!.sourceBundleIdentifier = source;
    withheld(run, /different or unknown source/);
  }
});

test('v2 exact-workout scope accepts known actual writers but not missing proof, unknown writers or duplicate-writer conflicts', () => {
  const scoped = (): HealthKitDistanceEvidence => ({ ...evidence(), version: 2,
    sampleScope: { kind: 'exact_workout', workoutUuid: UUID },
    samples: evidence().samples.map((s, index) => ({ ...s, sourceBundleIdentifier: index % 2 ? 'synthetic.sensor' : BUNDLE })) });
  const run = activity(scoped());
  assert.equal(buildHealthDistanceSplits(run, 'metric')?.status, 'complete');
  for (const scope of [undefined, { kind: 'date', workoutUuid: UUID }, { kind: 'exact_workout', workoutUuid: 'other' }]) {
    withheld(activity({ ...scoped(), sampleScope: scope } as any), /unsupported version|provenance/, 'unavailable');
  }
  for (const writer of ['', 'unknown']) {
    const invalid = scoped(); invalid.samples[0].sourceBundleIdentifier = writer;
    withheld(activity(invalid), /different or unknown source/);
  }
  const conflict = scoped();
  conflict.samples.push({ ...conflict.samples[0], sourceBundleIdentifier: 'different.writer' });
  withheld(activity(conflict), /conflicting duplicate/);
  const overlap = scoped();
  overlap.samples.push({ ...overlap.samples[0], id: 'additional', sourceBundleIdentifier: 'another.writer' });
  withheld(activity(overlap), /overlap/);
});

test('interpolated boundaries expose worst-case allocation timing bounds, not exact Apple timing', () => {
  const result = buildHealthDistanceSplits(activity(evidence(Array<number>(100).fill(40))), 'imperial')!;
  const fraction = (MILE % 40) / 40;
  close(result.splits[0]!.boundaryUncertaintySeconds, Math.max(fraction, 1 - fraction) * 10);
  close(result.splits[0]!.durationUncertaintySeconds, result.splits[0]!.boundaryUncertaintySeconds);
  close(result.splits[1]!.durationUncertaintySeconds,
    result.splits[0]!.boundaryUncertaintySeconds + result.splits[1]!.boundaryUncertaintySeconds);
  assert.equal(result.splits[2]!.boundaryUncertaintySeconds, 0);
  close(result.splits[2]!.durationUncertaintySeconds, result.splits[1]!.boundaryUncertaintySeconds);
  const exact = buildHealthDistanceSplits(activity(evidence([500, 500, 500, 500])), 'metric')!;
  assert.ok(exact.splits.every(split => split.boundaryUncertaintySeconds === 0 && split.durationUncertaintySeconds === 0));
});
