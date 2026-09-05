import test from 'node:test';
import assert from 'node:assert/strict';

import type { Activity } from '../../src/types/activity';
import { buildRunSplits } from '../../src/utils/activitySplits';

const M_PER_MI = 1609.344;
const EARTH_RADIUS_M = 6371000;
const DEG_PER_METER = 180 / (Math.PI * EARTH_RADIUS_M);

function pointAt(distanceMeters: number, timestamp: number) {
  return {
    latitude: 0,
    longitude: distanceMeters * DEG_PER_METER,
    timestamp,
  };
}

function activity(partial: Partial<Activity>): Activity {
  return {
    id: 'run',
    activityType: 'running',
    status: 'completed',
    source: 'tracked',
    startTime: 1_000,
    endTime: 1_000,
    trainingLoad: { musculoskeletal: 0, cardiovascular: 0, wholeBody: 0 },
    metrics: {},
    ...partial,
  } as Activity;
}

test('run splits render per-mile paces and faster/slower deltas from route timing', () => {
  const run = activity({
    metrics: {
      routeCoordinates: [
        pointAt(0, 1_000),
        pointAt(M_PER_MI, 601_000),
        pointAt(2 * M_PER_MI, 1_181_000),
        pointAt(3 * M_PER_MI, 1_801_000),
      ],
    },
  });

  const splits = buildRunSplits(run, 'imperial');
  assert.equal(splits.length, 3);
  assert.equal(splits[0]?.label, 'Mile 1');
  assert.equal(splits[0]?.paceLabel, '10:00 /mi');
  assert.equal(splits[0]?.trend, 'baseline');
  assert.equal(splits[1]?.paceLabel, '9:40 /mi');
  assert.equal(splits[1]?.trend, 'faster');
  assert.equal(splits[1]?.deltaLabel, '0:20 faster');
  assert.equal(splits[2]?.paceLabel, '10:20 /mi');
  assert.equal(splits[2]?.trend, 'slower');
  assert.equal(splits[2]?.deltaLabel, '0:40 slower');
});

test('metric run splits compare kilometer paces without changing activity identity', () => {
  const run = activity({
    metrics: {
      routeCoordinates: [
        pointAt(0, 1_000),
        pointAt(1000, 321_000),
        pointAt(2000, 651_000),
      ],
    },
  });

  const splits = buildRunSplits(run, 'metric');
  assert.equal(splits.length, 2);
  assert.equal(splits[0]?.label, 'Km 1');
  assert.equal(splits[0]?.paceLabel, '5:20 /km');
  assert.equal(splits[1]?.paceLabel, '5:30 /km');
  assert.equal(splits[1]?.trend, 'slower');
  assert.equal(splits[1]?.deltaLabel, '0:10 slower');
});

test('non-running activities do not show run splits', () => {
  const ride = activity({ activityType: 'cycling' });
  assert.deepEqual(buildRunSplits(ride, 'imperial'), []);
});
