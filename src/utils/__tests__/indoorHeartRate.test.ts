import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendIndoorHeartRateSample,
  summarizeIndoorHeartRate,
} from '../indoorHeartRate';

test('indoor HR summary uses timestamped, time-weighted observed intervals', () => {
  const summary = summarizeIndoorHeartRate({
    startedAtMs: 0,
    endedAtMs: 100_000,
    samples: [
      { timestamp: 0, bpm: 100, source: 'healthkit' },
      { timestamp: 20_000, bpm: 140, source: 'healthkit' },
      { timestamp: 50_000, bpm: 160, source: 'healthkit' },
      { timestamp: 80_000, bpm: 180, source: 'healthkit' },
    ],
    zones: [
      { zone: 1, minBPM: 90, maxBPM: 119 },
      { zone: 2, minBPM: 120, maxBPM: 149 },
      { zone: 3, minBPM: 150, maxBPM: 169 },
      { zone: 4, minBPM: 170, maxBPM: 189 },
    ],
  });

  assert.ok(summary);
  assert.equal(summary.averageReliable, true);
  assert.equal(summary.averageHeartRateBpm, 146); // (100×20 + 140×30 + 160×30 + 180×20) / 100
  assert.equal(summary.maximumHeartRateBpm, 180);
  assert.deepEqual(summary.zoneSeconds, { 1: 20, 2: 30, 3: 30, 4: 20 });
  assert.equal(summary.coverageRatio, 1);
});

test('indoor HR summary never fills long gaps and marks an average unreliable', () => {
  const summary = summarizeIndoorHeartRate({
    startedAtMs: 0,
    endedAtMs: 120_000,
    samples: [
      { timestamp: 0, bpm: 120, source: 'healthkit' },
      { timestamp: 90_000, bpm: 150, source: 'healthkit' },
    ],
  });

  assert.ok(summary);
  assert.equal(summary.coverageSeconds, 60); // capped to 30 seconds per observed sample
  assert.equal(summary.coverageRatio, 0.5);
  assert.equal(summary.averageReliable, false);
  assert.equal(summary.averageHeartRateBpm, undefined);
  assert.equal(summary.maximumHeartRateBpm, 150);
  assert.equal(summary.largestGapSeconds, 90);
});

test('indoor HR sampling deduplicates a repeated HealthKit observation and bounds history', () => {
  const first = appendIndoorHeartRateSample([], { timestamp: 1, bpm: 120, source: 'healthkit' });
  const duplicate = appendIndoorHeartRateSample(first, { timestamp: 1, bpm: 120, source: 'healthkit' });
  assert.equal(duplicate.length, 1);

  const bounded = appendIndoorHeartRateSample(duplicate, { timestamp: 2, bpm: 121, source: 'healthkit' }, 1);
  assert.deepEqual(bounded, [{ timestamp: 2, bpm: 121, source: 'healthkit' }]);
});
