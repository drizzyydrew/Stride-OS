import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const watchManager = readFileSync('targets/StrideOSWatch/StrideWatchWorkoutManager.swift', 'utf8');
const moduleIndex = readFileSync('modules/stride-watch-connectivity/src/index.ts', 'utf8');
const bridge = readFileSync('src/components/watch/WatchWorkoutBridge.tsx', 'utf8');
const activeOutdoorStore = readFileSync('src/store/activeActivityStore.ts', 'utf8');
const activeStrengthStore = readFileSync('src/store/activeStrengthSessionStore.ts', 'utf8');
const runScreen = readFileSync('app/(tabs)/training/index.tsx', 'utf8');
const outdoorStartScreen = readFileSync('app/(tabs)/activity/start.tsx', 'utf8');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

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

test('watch face keeps controls above rounded bottom edge and applies latest phone command context', () => {
  const watchApp = read('targets/StrideOSWatch/StrideOSWatchApp.swift');
  const watchManager = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const watchModule = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');

  assert.match(watchApp, /topPadding = isCompact \? 4 : 6/);
  assert.match(watchApp, /bottomPadding = isCompact \? 16 : 18/);
  assert.match(watchManager, /didReceiveApplicationContext/);
  assert.match(watchModule, /updateApplicationContext/);
});

test('phone session stores can reuse watch-provided workout instance ids', () => {
  assert.match(activeOutdoorStore, /workoutInstanceId\?: string/);
  assert.match(activeOutdoorStore, /input\.workoutInstanceId \?\? buildWorkoutInstanceId/);
  assert.match(activeStrengthStore, /workoutInstanceId\?: string/);
  assert.match(activeStrengthStore, /input\.workoutInstanceId \?\? buildWorkoutInstanceId/);
});

test('watch and phone completion handling is idempotent for duplicate stop events', () => {
  const endWorkoutBody = watchManager.slice(
    watchManager.indexOf('func endWorkout()'),
    watchManager.indexOf('private func beginWorkout', watchManager.indexOf('func endWorkout()')),
  );
  assert.match(watchManager, /private var endedStateSentForWorkoutInstanceId/);
  assert.match(watchManager, /sendEndedStateOnce\(\)/);
  assert.doesNotMatch(endWorkoutBody, /sendWorkoutState\("ended"\)/);
  assert.match(watchManager, /lastHandledPhoneCommandKey/);
  assert.match(bridge, /completedWatchWorkoutEvents/);
  assert.match(bridge, /rememberCompletedWatchWorkout\(id, event\.timestamp\)/);
});

test('live run and outdoor activity saves do not create fresh ids for repeated finish events', () => {
  assert.match(runScreen, /function liveRunCompletionKey/);
  assert.match(runScreen, /liveRunCompletionKey\('gps_run', finalState\.workoutInstanceId, finalState\.startTime\)/);
  assert.match(runScreen, /liveRunCompletionKey\(\s*'treadmill_run',/);
  assert.doesNotMatch(runScreen, /const id = `gps_run_\$\{Date\.now\(\)\}`/);
  assert.doesNotMatch(runScreen, /const id = `treadmill_run_\$\{Date\.now\(\)\}`/);
  assert.match(runScreen, /stopInFlightRef/);
  assert.match(outdoorStartScreen, /saveInFlightRef/);
});
