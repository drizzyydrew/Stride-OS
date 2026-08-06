import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  appendTrackingPoint,
  evaluateRunWalkCue,
  evaluateSustainedEffortCue,
  intervalAtElapsed,
  mergeSpokenCues,
  type EffortCueState,
} from '../../src/utils/activityTracking';

const empty = {
  points: [],
  distanceMeters: 0,
  elevationGainMeters: 0,
  elevationLossMeters: 0,
  currentMetersPerSecond: 0,
  averageMetersPerSecond: 0,
  maximumMetersPerSecond: 0,
};

test('activity tracking uses activity-specific speed acceptance', () => {
  const first = appendTrackingPoint(empty, { latitude: 0, longitude: 0, timestamp: 0 }, 'cycling', 0);
  const cycling = appendTrackingPoint(first, { latitude: 0, longitude: 0.0001, timestamp: 1_000 }, 'cycling', 1);
  const walking = appendTrackingPoint(first, { latitude: 0, longitude: 0.0001, timestamp: 1_000 }, 'walking', 1);
  assert.ok(cycling.distanceMeters > 10);
  assert.equal(walking.distanceMeters, 0);
});

test('run walk interval transitions and warnings are deterministic', () => {
  const intervals = [
    { kind: 'run' as const, durationSeconds: 120 },
    { kind: 'walk' as const, durationSeconds: 60 },
    { kind: 'run' as const, durationSeconds: 120 },
  ];
  assert.equal(intervalAtElapsed(intervals, 130).index, 1);
  assert.equal(evaluateRunWalkCue({ intervals, previousElapsedSeconds: 119, elapsedSeconds: 120 })?.text, 'Slow to a walk.');
  assert.equal(
    evaluateRunWalkCue({ intervals, previousElapsedSeconds: 149, elapsedSeconds: 150 })?.text,
    'Thirty seconds until the next running interval.',
  );
});

test('effort cue requires sustained samples and observes cooldown', () => {
  let state = { consecutiveHighSamples: 0, lastCueElapsedSeconds: -300 };
  for (let i = 1; i <= 4; i += 1) {
    const result = evaluateSustainedEffortCue({ state, elapsedSeconds: i * 10, isAboveTarget: true });
    assert.equal(result.text, undefined);
    state = result.state;
  }
  const due = evaluateSustainedEffortCue({ state, elapsedSeconds: 50, isAboveTarget: true });
  assert.match(due.text ?? '', /above today’s target/i);
  const suppressed = evaluateSustainedEffortCue({
    state: { consecutiveHighSamples: 4, lastCueElapsedSeconds: 50 },
    elapsedSeconds: 80,
    isAboveTarget: true,
  });
  assert.equal(suppressed.text, undefined);
});

test('heart-rate voice coaching supports below range and back-in-zone cues', () => {
  let state: EffortCueState = {
    consecutiveHighSamples: 0,
    consecutiveLowSamples: 0,
    wasOutOfRange: false,
    lastCueElapsedSeconds: -300,
  };
  for (let i = 1; i <= 4; i += 1) {
    state = evaluateSustainedEffortCue({ state, elapsedSeconds: i * 10, isAboveTarget: false, isBelowTarget: true }).state;
  }
  const low = evaluateSustainedEffortCue({ state, elapsedSeconds: 50, isAboveTarget: false, isBelowTarget: true });
  assert.match(low.text ?? '', /below today’s target/i);
  const back = evaluateSustainedEffortCue({
    state: { ...low.state, lastCueElapsedSeconds: -300 },
    elapsedSeconds: 360,
    isAboveTarget: false,
    backInTarget: true,
  });
  assert.match(back.text ?? '', /back in your target zone/i);
});

test('voice collisions merge without duplicate phrases', () => {
  assert.equal(
    mergeSpokenCues(['Begin running.', 'Hydration reminder: drink approximately four ounces.', 'Begin running.']),
    'Begin running. Hydration reminder: drink approximately four ounces.',
  );
});

test('background activity tracking owns run-walk cues from location updates', () => {
  const store = readFileSync('src/store/activeActivityStore.ts', 'utf8');
  const task = readFileSync('src/lib/activityGpsTracking.ts', 'utf8');
  assert.match(store, /evaluateRunWalkCue/);
  assert.match(store, /lastRunWalkCueElapsedSeconds/);
  assert.match(store, /enqueueVoiceCue\(cue\.text, 'runWalk'\)/);
  assert.match(task, /location\.timestamp - state\.startedAt - state\.pausedDurationMs/);
});
