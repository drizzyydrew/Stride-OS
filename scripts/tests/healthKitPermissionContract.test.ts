import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const healthKitSource = readFileSync('src/lib/healthKit.ts', 'utf8');

function shareTypesBlock(): string {
  const match = healthKitSource.match(/const SHARE_TYPES = \[([\s\S]*?)\] as const;/);
  assert.ok(match, 'SHARE_TYPES block should exist');
  return match[1];
}

test('HealthKit write permissions match workout totals StrideOS saves', () => {
  const block = shareTypesBlock();
  assert.match(block, /HKQuantityTypeIdentifierDistanceWalkingRunning/);
  assert.match(block, /HKQuantityTypeIdentifierDistanceCycling/);
  assert.match(block, /WORKOUT_TYPE/);
  // writeWorkout saves a real distance total to Apple Health.
  assert.match(healthKitSource, /totals\.distance\s*=/);
  // ...but it must NOT fabricate calories from estimatedLoad (a TSS-analog
  // training-load number, not kilocalories). See Build 49 audit A04.
  assert.doesNotMatch(healthKitSource, /estimatedLoad\s*\*/);
  assert.doesNotMatch(healthKitSource, /energyBurned:\s*Math/);
});

test('HealthKit does not request unsupported write categories', () => {
  const block = shareTypesBlock();
  assert.doesNotMatch(block, /HKQuantityTypeIdentifierActiveEnergyBurned/);
  assert.doesNotMatch(block, /HKQuantityTypeIdentifierHeartRate/);
  assert.doesNotMatch(block, /HKQuantityTypeIdentifierStepCount/);
  assert.doesNotMatch(block, /HKWorkoutRouteTypeIdentifier/);
});
