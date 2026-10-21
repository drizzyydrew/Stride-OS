import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeHealthDistanceEvidence } from '../../src/utils/healthDistanceImport';
import { mergeHealthDistanceEvidence } from '../../src/utils/healthDistanceRefresh';
import { buildHealthKitActivityDraft } from '../../src/utils/healthKitImport';
import { sanitizeActivityMetrics } from '../../src/utils/activityLoad';
import type { Activity } from '../../src/types/activity';

const startTime = Date.parse('2026-10-01T07:00:00Z');
const context = { uuid: '11111111-1111-4111-8111-111111111111', sourceBundleIdentifier: 'synthetic.watch',
  startTime, endTime: startTime + 60_000, durationSeconds: 60, distanceMeters: 180, activityType: 'running' as const };
const eventTypes = { pause: 1, resume: 2, motionPaused: 5, motionResumed: 6 };
const sample = (id = 'distance-1', offset = 0, distance = 90) => ({ uuid: id, quantity: distance,
  startDate: new Date(startTime + offset), endDate: new Date(startTime + offset + 30_000),
  sourceRevision: { source: { bundleIdentifier: context.sourceBundleIdentifier } } });
const evidence = () => decodeHealthDistanceEvidence([sample(), sample('distance-2', 30_000)], context, [], eventTypes);
function activity() { return { ...buildHealthKitActivityDraft({ candidate: context }), id: 'canonical',
  notes: 'Keep notes', rpe: 6, createdAt: startTime, updatedAt: startTime,
  trainingLoad: { wholeBody: 123 }, metrics: { durationSeconds: 59, distanceMeters: 175,
    metricSources: { distance: 'manual_entry' }, distanceSource: 'manual_entry',
    routeCoordinates: [{ latitude: 45, longitude: -120, timestamp: startTime }],
    recordingPauses: [{ startTime: startTime + 2_000, endTime: startTime + 3_000 }] } } as Activity; }

test('Health distance decoder scopes provenance, collapses identical IDs, and never contributes manual/other-source samples', () => {
  const a = sample();
  const e = decodeHealthDistanceEvidence([a, a, sample('distance-2', 30_000),
    { ...a, uuid: 'manual', metadata: { HKWasUserEntered: true } },
    { ...a, uuid: 'phone', sourceRevision: { source: { bundleIdentifier: 'other' } } }], context, [], eventTypes);
  assert.equal(e.samples.length, 2);
  assert.ok(e.samples.every(s => s.sourceBundleIdentifier === context.sourceBundleIdentifier));
  assert.equal(e.totalDistanceMeters, 180);
  assert.equal(e.version, 1);
  assert.throws(() => decodeHealthDistanceEvidence([a, { ...a, quantity: 91 }], context, [], eventTypes), /conflicting/);
});

test('malformed, outside-workout, missing-ID and oversized distance evidence fail explicitly', () => {
  for (const invalid of [{ ...sample(), uuid: undefined }, { ...sample(), quantity: NaN },
    { ...sample(), startDate: new Date(startTime - 1) }, { ...sample(), endDate: new Date(startTime + 61_000) }]) {
    assert.throws(() => decodeHealthDistanceEvidence([invalid], context, [], eventTypes), /safely/);
  }
  assert.throws(() => decodeHealthDistanceEvidence(Array.from({ length: 100_001 }, () => sample()), context, [], eventTypes), /safe import size/);
});

test('native pause/resume events remain separate from the existing phone recording pauses', () => {
  const event = (type: number, offset: number) => ({ type, startDate: new Date(startTime + offset), endDate: new Date(startTime + offset) });
  const e = decodeHealthDistanceEvidence([sample()], context, [event(1, 10_000), event(2, 20_000), event(5, 50_000)], eventTypes);
  assert.deepEqual(e.recordingPauses, [{ startTime: startTime + 10_000, endTime: startTime + 20_000 },
    { startTime: startTime + 50_000, endTime: context.endTime }]);
  assert.throws(() => decodeHealthDistanceEvidence([], context, [event(2, 20_000)], eventTypes), /incomplete/);
  assert.throws(() => decodeHealthDistanceEvidence([], context, [event(1, 20_000)]), /not supported/);
});

test('evidence-only merge preserves exact identity, summaries, load, phone routes/pauses and edits', () => {
  const row = activity(), before = JSON.stringify(row), e = evidence();
  const next = mergeHealthDistanceEvidence(row, e);
  assert.equal(JSON.stringify(row), before);
  const { healthKitDistance: _evidence, ...retainedMetrics } = next.metrics;
  assert.deepEqual({ ...next, metrics: retainedMetrics, updatedAt: row.updatedAt }, row);
  assert.equal(next.metrics.routeCoordinates, row.metrics.routeCoordinates);
  assert.equal(next.metrics.recordingPauses, row.metrics.recordingPauses);
  assert.equal(next.trainingLoad, row.trainingLoad);
  assert.deepEqual(sanitizeActivityMetrics('running', next.metrics).healthKitDistance, e);
});

test('less evidence, conflicting identities, changed sample content and stale refreshes never overwrite saved evidence', () => {
  const first = evidence(), row = mergeHealthDistanceEvidence(activity(), first);
  const next = () => ({ ...evidence(), retrievedAt: first.retrievedAt + 1 });
  for (const e of [{ ...next(), samples: [] }, { ...next(), samples: next().samples.slice(1) },
    { ...next(), samples: next().samples.map((s, i) => i ? s : { ...s, distanceMeters: 95 }) },
    { ...next(), workoutUuid: 'different' }, { ...next(), sourceBundleIdentifier: 'other' },
    { ...next(), durationSeconds: 59 }, { ...next(), totalDistanceMeters: 181 }, { ...next(), totalDistanceMeters: undefined },
    { ...next(), startTime: context.startTime + 1 }, { ...next(), endTime: context.endTime + 1 },
    { ...next(), retrievedAt: first.retrievedAt - 1 }]) assert.throws(() => mergeHealthDistanceEvidence(row, e));
  assert.throws(() => mergeHealthDistanceEvidence({ ...row, workoutInstanceId: 'phone',
    healthKit: { ...row.healthKit!, workoutInstanceId: 'conflicting' } }, next()), /conflicting/);
  assert.equal(row.metrics.healthKitDistance, first);
});

test('first-link allows only exact consistent instance, activity or legacy-workout proof and never rewrites summaries', () => {
  const original = activity();
  const metadata = original.healthKit!;
  const base = { ...original, healthKit: undefined, source: 'tracked' as const };
  for (const [row, link] of [
    [{ ...base, workoutInstanceId: 'exact' }, { ...metadata, workoutInstanceId: 'exact' }],
    [base, { ...metadata, strideOSActivityId: base.id }],
    [{ ...base, legacyWorkoutId: 'legacy' }, { ...metadata, strideOSWorkoutId: 'legacy' }],
  ] as const) {
    const linked = mergeHealthDistanceEvidence(row, evidence(), link.workoutInstanceId, { activityType: 'running', metadata: link });
    assert.equal(linked.healthKit, link);
    assert.equal(linked.id, base.id);
    assert.equal(linked.metrics.distanceMeters, base.metrics.distanceMeters);
    assert.equal(linked.trainingLoad, base.trainingLoad);
  }
  const matching = { ...metadata, workoutInstanceId: 'exact' };
  for (const [row, link] of [
    [base, metadata],
    [{ ...base, workoutInstanceId: 'exact' }, { ...matching, strideOSActivityId: 'different-row' }],
    [{ ...base, workoutInstanceId: 'exact', legacyWorkoutId: 'known-workout' }, { ...matching, strideOSWorkoutId: 'different-workout' }],
    [{ ...base, workoutInstanceId: 'exact' }, { ...matching, workoutInstanceId: 'conflicting' }],
    [{ ...base, healthKit: {} }, matching],
  ] as const) assert.throws(() => mergeHealthDistanceEvidence(row as Activity, evidence(), link.workoutInstanceId, { activityType: 'running', metadata: link }));
});
