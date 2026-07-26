import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDistance,
  formatPaceSec,
  formatSpeed,
  kmToMiles,
  kmhToMph,
  milesToKm,
  mphToKmh,
  mphToMps,
  mpsToMph,
  paceSecPerKmToSecPerMile,
  paceSecPerMileToSecPerKm,
  paceSecPerMileToSpeedMph,
  paceToSpeedPerUnit,
  speedMphToPaceSecPerMile,
  speedToPaceSecPerUnit,
} from '../units';

test('distance round-trips miles <-> km', () => {
  assert.ok(Math.abs((milesToKm(1) ?? 0) - 1.609344) < 1e-9);
  assert.ok(Math.abs((kmToMiles(1.609344) ?? 0) - 1) < 1e-9);
  const miles = 13.1;
  assert.ok(Math.abs((kmToMiles(milesToKm(miles)!)!) - miles) < 1e-9);
});

test('speed round-trips mph <-> km/h', () => {
  assert.ok(Math.abs((mphToKmh(10) ?? 0) - 16.09344) < 1e-9);
  assert.ok(Math.abs((kmhToMph(16.09344) ?? 0) - 10) < 1e-9);
});

test('mps <-> mph', () => {
  assert.ok(Math.abs((mpsToMph(1) ?? 0) - 2.236936) < 1e-6);
  assert.ok(Math.abs((mphToMps(2.236936) ?? 0) - 1) < 1e-5);
});

test('pace <-> speed are reciprocal via 3600', () => {
  const paceFromSpeed = speedToPaceSecPerUnit(6); // 6 mph -> 10:00/mi
  assert.equal(paceFromSpeed, 600);
  const speedFromPace = paceToSpeedPerUnit(600);
  assert.equal(speedFromPace, 6);
  assert.equal(speedMphToPaceSecPerMile(6), 600);
  assert.equal(paceSecPerMileToSpeedMph(600), 6);
});

test('pace mile <-> km conversion', () => {
  // 8:00/mi ~= 4:58/km
  const secPerKm = paceSecPerMileToSecPerKm(480)!;
  assert.ok(Math.abs(secPerKm - 298.26) < 0.5);
  const secPerMile = paceSecPerKmToSecPerMile(secPerKm)!;
  assert.ok(Math.abs(secPerMile - 480) < 1e-6);
});

test('invalid inputs return null, never NaN/Infinity', () => {
  assert.equal(milesToKm(NaN), null);
  assert.equal(milesToKm(-1), null);
  assert.equal(milesToKm(Infinity), null);
  assert.equal(mphToKmh(-5), null);
  assert.equal(speedToPaceSecPerUnit(0), null);
  assert.equal(speedToPaceSecPerUnit(-3), null);
  assert.equal(speedToPaceSecPerUnit(Infinity), null);
  assert.equal(paceToSpeedPerUnit(0), null);
  assert.equal(paceToSpeedPerUnit(NaN), null);
});

test('formatting guards invalid/zero input', () => {
  assert.equal(formatPaceSec(null), '--:--');
  assert.equal(formatPaceSec(undefined), '--:--');
  assert.equal(formatPaceSec(0), '--:--');
  assert.equal(formatPaceSec(NaN), '--:--');
  assert.equal(formatPaceSec(600), '10:00');
  assert.equal(formatPaceSec(65), '1:05');

  assert.equal(formatSpeed(null), '--');
  assert.equal(formatSpeed(-1), '--');
  assert.equal(formatSpeed(6.25, 1), '6.3');

  assert.equal(formatDistance(null), '--');
  assert.equal(formatDistance(-1), '--');
  assert.equal(formatDistance(3.14159, 2), '3.14');
});
