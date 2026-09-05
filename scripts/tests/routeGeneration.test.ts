import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildGeneratedRouteWaypoints,
  generatedRouteDistanceMiles,
} from '../../src/utils/routeGeneration';

type RoutePoint = {
  latitude: number;
  longitude: number;
};

const bendStart: RoutePoint = { latitude: 44.0582, longitude: -121.3153 };

test('auto route generator creates closed loop waypoints near the requested distance', () => {
  const generated = buildGeneratedRouteWaypoints({
    start: bendStart,
    distanceMiles: 5,
    surface: 'mixed',
    hills: 'rolling',
    elevation: 'moderate',
    shape: 'loop',
    seed: 42,
  });

  assert.equal(generated.waypoints.length, 5);
  assert.deepEqual(generated.waypoints[0], bendStart);
  assert.deepEqual(generated.waypoints.at(-1), bendStart);
  assert.ok(Math.abs(generatedRouteDistanceMiles(generated.waypoints) - 5) < 0.75);
  assert.match(generated.name, /5\.0 mi Rolling Mixed Loop/);
});

test('auto route generator creates out-and-back waypoints with the same start and finish', () => {
  const generated = buildGeneratedRouteWaypoints({
    start: bendStart,
    distanceMiles: 8,
    surface: 'trail',
    hills: 'hilly',
    elevation: 'high',
    shape: 'out_and_back',
    seed: 99,
  });

  assert.equal(generated.waypoints.length, 3);
  assert.deepEqual(generated.waypoints[0], bendStart);
  assert.deepEqual(generated.waypoints[2], bendStart);
  assert.ok(generatedRouteDistanceMiles(generated.waypoints) > 7.8);
  assert.match(generated.notes, /trail surface, hilly hills, high elevation intent/);
});

test('Route Builder exposes search-backed route generation modes', () => {
  const source = readFileSync('app/(tabs)/training/route-builder.tsx', 'utf8');

  assert.match(source, /Location\.geocodeAsync/);
  assert.match(source, /Location\.reverseGeocodeAsync/);
  assert.match(source, /Run to place/);
  assert.match(source, /From place/);
  assert.match(source, /Around place/);
});
