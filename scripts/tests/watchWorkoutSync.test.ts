import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const watchManager = readFileSync('targets/StrideOSWatch/StrideWatchWorkoutManager.swift', 'utf8');
const moduleIndex = readFileSync('modules/stride-watch-connectivity/src/index.ts', 'utf8');
const bridge = readFileSync('src/components/watch/WatchWorkoutBridge.tsx', 'utf8');
const activeOutdoorStore = readFileSync('src/store/activeActivityStore.ts', 'utf8');
const activeStrengthStore = readFileSync('src/store/activeStrengthSessionStore.ts', 'utf8');

test('Apple Watch started workouts publish a shared workout identity and environment', () => {
  assert.match(watchManager, /workoutInstanceId \?\? "watch_\\\(kind\.rawValue\)_/);
  assert.match(watchManager, /private var workoutEnvironment: String = "outdoor"/);
  assert.match(watchManager, /"environment": workoutEnvironment/);
  assert.match(moduleIndex, /environment\?: string/);
  assert.match(moduleIndex, /environment: typeof event\?\.environment === 'string'/);
});

test('watch workout state events drive the phone active-session stores', () => {
  assert.match(bridge, /addStrideWatchWorkoutStateListener/);
  assert.match(bridge, /handleWatchWorkoutState\(event\)/);
  assert.match(bridge, /useActiveActivityStore\.getState\(\)\.start/);
  assert.match(bridge, /useActiveStrengthSessionStore\.getState\(\)\.startSession/);
  assert.match(bridge, /pause\('manual'\)/);
  assert.match(bridge, /resume\('manual'\)/);
  assert.match(bridge, /requestCompletion\(\)/);
  assert.match(bridge, /enqueueVoiceCue\('Pausing workout\.', 'interval'\)/);
  assert.match(bridge, /enqueueVoiceCue\('Resuming workout\.', 'interval'\)/);
});

test('phone session stores can reuse watch-provided workout instance ids', () => {
  assert.match(activeOutdoorStore, /workoutInstanceId\?: string/);
  assert.match(activeOutdoorStore, /input\.workoutInstanceId \?\? buildWorkoutInstanceId/);
  assert.match(activeStrengthStore, /workoutInstanceId\?: string/);
  assert.match(activeStrengthStore, /input\.workoutInstanceId \?\? buildWorkoutInstanceId/);
});
