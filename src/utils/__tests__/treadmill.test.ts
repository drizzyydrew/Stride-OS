import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTreadmillSegments,
  closeOpenSegment,
  confirmSpeedChange,
  estimateDistanceMiles,
  estimateMilesFromPrescription,
  openSegment,
  resolveFinalDistance,
  safePaceSecPerMile,
  sanitizeSpeedKmh,
  sanitizeSpeedMph,
  segmentDistanceMiles,
} from '../treadmill';

const HOUR = 3_600_000;

test('segmentDistanceMiles: speed * elapsed hours, guards zero/negative duration', () => {
  const seg = { speedMph: 6, startedAtMs: 0, endedAtMs: HOUR / 2 }; // 30 min @ 6mph = 3mi
  assert.ok(Math.abs(segmentDistanceMiles(seg) - 3) < 1e-9);

  const zeroDuration = { speedMph: 6, startedAtMs: 1000, endedAtMs: 1000 };
  assert.equal(segmentDistanceMiles(zeroDuration), 0);

  const negativeDuration = { speedMph: 6, startedAtMs: 2000, endedAtMs: 1000 };
  assert.equal(segmentDistanceMiles(negativeDuration), 0);
});

test('segmentDistanceMiles: open segment accrues live from now()', () => {
  const seg = openSegment(6, 0);
  const distanceAt15Min = segmentDistanceMiles(seg, HOUR / 4);
  assert.ok(Math.abs(distanceAt15Min - 1.5) < 1e-9);
});

test('sanitizeSpeedMph rejects NaN/Infinity/negative by treating as 0', () => {
  assert.equal(sanitizeSpeedMph(NaN), 0);
  assert.equal(sanitizeSpeedMph(Infinity), 0);
  assert.equal(sanitizeSpeedMph(-5), 0);
  assert.equal(sanitizeSpeedMph(6.5), 6.5);
});

test('sanitizeSpeedKmh converts km/h input to internal mph canonical unit', () => {
  // 16.09344 km/h == 10 mph
  assert.ok(Math.abs(sanitizeSpeedKmh(16.09344) - 10) < 1e-9);
  assert.equal(sanitizeSpeedKmh(-1), 0);
});

test('confirmSpeedChange closes the open segment and opens a new one at the new speed', () => {
  let segments = [openSegment(5, 0)];
  segments = confirmSpeedChange(segments, 7, HOUR); // ran 5mph for 1hr, then 7mph
  assert.equal(segments.length, 2);
  assert.equal(segments[0].endedAtMs, HOUR);
  assert.equal(segments[0].speedMph, 5);
  assert.equal(segments[1].speedMph, 7);
  assert.equal(segments[1].endedAtMs, null);

  const total = estimateDistanceMiles(segments, HOUR + HOUR / 2); // + 30 min @ 7mph
  assert.ok(Math.abs(total - (5 + 3.5)) < 1e-9);
});

test('closeOpenSegment is a no-op on an already-closed segment or empty list', () => {
  assert.deepEqual(closeOpenSegment([], 100), []);
  const closed = [{ speedMph: 5, startedAtMs: 0, endedAtMs: 100 }];
  assert.deepEqual(closeOpenSegment(closed, 200), closed);
});

test('buildTreadmillSegments: full session with speed changes and a pause never spans the pause', () => {
  const events: Parameters<typeof buildTreadmillSegments>[0] = [
    { type: 'start', speedMph: 6, atMs: 0 },                    // 0-10min @ 6mph
    { type: 'confirmSpeed', speedMph: 8, atMs: 10 * 60_000 },   // 10-20min @ 8mph
    { type: 'pause', atMs: 20 * 60_000 },                       // pause closes segment
    { type: 'resume', atMs: 25 * 60_000 },                      // resume reopens @ 8mph (last speed)
  ];
  const segments = buildTreadmillSegments(events);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].speedMph, 6);
  assert.equal(segments[0].endedAtMs, 10 * 60_000);
  assert.equal(segments[1].speedMph, 8);
  assert.equal(segments[1].endedAtMs, 20 * 60_000);
  assert.equal(segments[2].speedMph, 8);
  assert.equal(segments[2].startedAtMs, 25 * 60_000);
  assert.equal(segments[2].endedAtMs, null);

  // No segment spans [20min, 25min) — the pause gap contributes 0 distance.
  const distanceAtPauseMidpoint = estimateDistanceMiles(segments, 22 * 60_000);
  const expectedAtCloseOfSegment2 = 6 * (10 / 60) + 8 * (10 / 60);
  assert.ok(Math.abs(distanceAtPauseMidpoint - expectedAtCloseOfSegment2) < 1e-9);
});

test('buildTreadmillSegments: rejects NaN/negative confirmed speeds without losing the segment', () => {
  const events: Parameters<typeof buildTreadmillSegments>[0] = [
    { type: 'start', speedMph: 6, atMs: 0 },
    { type: 'confirmSpeed', speedMph: NaN, atMs: HOUR },
  ];
  const segments = buildTreadmillSegments(events);
  assert.equal(segments.length, 2);
  assert.equal(segments[1].speedMph, 0);
  // distance stops accruing once speed is sanitized to 0
  assert.ok(Math.abs(estimateDistanceMiles(segments, HOUR + HOUR) - 6) < 1e-9);
});

test('estimateMilesFromPrescription: distance from prescribed pace midpoint x duration', () => {
  // 30 min at an 8:00-9:00/mi range (midpoint 8:30 = 510 sec/mi) -> ~3.53 mi
  const miles = estimateMilesFromPrescription(30, { minSecPerMi: 540, maxSecPerMi: 480 })!;
  assert.ok(Math.abs(miles - (30 * 60) / 510) < 1e-9);
});

test('estimateMilesFromPrescription guards missing/invalid input', () => {
  assert.equal(estimateMilesFromPrescription(30, null), null);
  assert.equal(estimateMilesFromPrescription(30, undefined), null);
  assert.equal(estimateMilesFromPrescription(0, { minSecPerMi: 540, maxSecPerMi: 480 }), null);
  assert.equal(estimateMilesFromPrescription(-5, { minSecPerMi: 540, maxSecPerMi: 480 }), null);
  assert.equal(estimateMilesFromPrescription(NaN, { minSecPerMi: 540, maxSecPerMi: 480 }), null);
  assert.equal(estimateMilesFromPrescription(30, { minSecPerMi: 0, maxSecPerMi: 480 }), null);
  assert.equal(estimateMilesFromPrescription(30, { minSecPerMi: NaN, maxSecPerMi: 480 }), null);
});

test('resolveFinalDistance: estimateSource lets the caller distinguish confirmed-speed vs prescribed estimates', () => {
  const confirmed = resolveFinalDistance({ estimateMiles: 3, choice: 'use_estimate' });
  assert.equal(confirmed.distanceSource, 'confirmed_speed_estimate');

  const prescribed = resolveFinalDistance({ estimateMiles: 3, choice: 'use_estimate', estimateSource: 'prescribed_estimate' });
  assert.equal(prescribed.distanceSource, 'prescribed_estimate');
  assert.equal(prescribed.distanceMiles, 3);

  // estimateSource is ignored for use_display/manual_entry — those have their own fixed sources.
  const display = resolveFinalDistance({ estimateMiles: 3, enteredMiles: 4, choice: 'use_display', estimateSource: 'prescribed_estimate' });
  assert.equal(display.distanceSource, 'equipment_display');
});

test('resolveFinalDistance: each choice preserves the original estimate', () => {
  const estimate = 5.2;

  const useEstimate = resolveFinalDistance({ estimateMiles: estimate, choice: 'use_estimate' });
  assert.equal(useEstimate.distanceMiles, estimate);
  assert.equal(useEstimate.distanceSource, 'confirmed_speed_estimate');
  assert.equal(useEstimate.originalEstimatedDistanceMiles, estimate);

  const useDisplay = resolveFinalDistance({ estimateMiles: estimate, enteredMiles: 5.5, choice: 'use_display' });
  assert.equal(useDisplay.distanceMiles, 5.5);
  assert.equal(useDisplay.distanceSource, 'equipment_display');
  assert.equal(useDisplay.originalEstimatedDistanceMiles, estimate);

  const manual = resolveFinalDistance({ estimateMiles: estimate, enteredMiles: 5.0, choice: 'manual_entry' });
  assert.equal(manual.distanceMiles, 5.0);
  assert.equal(manual.distanceSource, 'manual_entry');
  assert.equal(manual.originalEstimatedDistanceMiles, estimate);
});

test('resolveFinalDistance: invalid/missing entered value falls back to the estimate', () => {
  const result = resolveFinalDistance({ estimateMiles: 4, enteredMiles: null, choice: 'use_display' });
  assert.equal(result.distanceMiles, 4);
  assert.equal(result.distanceSource, 'confirmed_speed_estimate');

  const negativeEntry = resolveFinalDistance({ estimateMiles: 4, enteredMiles: -1, choice: 'manual_entry' });
  assert.equal(negativeEntry.distanceMiles, 4);
  assert.equal(negativeEntry.distanceSource, 'confirmed_speed_estimate');

  const prescribedFallback = resolveFinalDistance({
    estimateMiles: 4,
    enteredMiles: null,
    choice: 'use_display',
    estimateSource: 'prescribed_estimate',
  });
  assert.equal(prescribedFallback.distanceSource, 'prescribed_estimate');

  const nanEstimate = resolveFinalDistance({ estimateMiles: NaN, choice: 'use_estimate' });
  assert.equal(nanEstimate.distanceMiles, 0);
  assert.equal(nanEstimate.originalEstimatedDistanceMiles, 0);
});

test('safePaceSecPerMile guards zero/negative/NaN/Infinity, never returns NaN or Infinity', () => {
  assert.equal(safePaceSecPerMile(5, 3000), 600);
  assert.equal(safePaceSecPerMile(0, 3000), null);
  assert.equal(safePaceSecPerMile(5, 0), null);
  assert.equal(safePaceSecPerMile(-1, 3000), null);
  assert.equal(safePaceSecPerMile(5, -1), null);
  assert.equal(safePaceSecPerMile(NaN, 3000), null);
  assert.equal(safePaceSecPerMile(5, Infinity), null);
  assert.equal(safePaceSecPerMile(Infinity, 3000), null);
});
