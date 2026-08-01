import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  liveActivityCommandMatchesSession,
  normalizeOutdoorLiveActivitySnapshot,
} from '../../src/lib/liveActivityContracts';
import { liveActivityMetricConfig } from '../../src/utils/liveActivityLayout';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('Live Activity normalization preserves explicit workout-instance identity', () => {
  const payload = normalizeOutdoorLiveActivitySnapshot({
    sessionId: 'origin-session',
    workoutInstanceId: 'run:instance-123',
    sessionSource: 'running',
    activityName: 'Intervals',
    activityType: 'running',
    elapsedSeconds: 90,
    distanceMiles: 0.25,
    averagePace: '9:00',
    heartRateBpm: 144,
    isPaused: false,
  });

  assert.equal(payload.workoutInstanceId, 'run:instance-123');
  assert.equal(payload.sessionId, 'origin-session');
});

test('Live Activity commands match by workoutInstanceId when present and reject stale instances', () => {
  assert.equal(liveActivityCommandMatchesSession({
    workoutInstanceId: 'run:new',
    sessionId: 'run:old',
    sessionSource: 'running',
  }, {
    sessionId: 'run:new',
    sessionSource: 'running',
  }), true);
  assert.equal(liveActivityCommandMatchesSession({
    workoutInstanceId: 'run:old',
    sessionSource: 'running',
  }, {
    sessionId: 'run:new',
    sessionSource: 'running',
  }), false);
  assert.equal(liveActivityCommandMatchesSession({
    workoutInstanceId: 'run:new',
    sessionSource: 'outdoor',
  }, {
    sessionId: 'run:new',
    sessionSource: 'running',
  }), false);
});

test('Live Activity metric configs avoid irrelevant metrics by activity type', () => {
  assert.equal(liveActivityMetricConfig({ activityType: 'running' }).showsGpsPace, true);
  assert.equal(liveActivityMetricConfig({ activityType: 'running', indoor: true }).kind, 'treadmill');
  assert.equal(liveActivityMetricConfig({ activityType: 'running', indoor: true }).showsGpsPace, false);
  assert.equal(liveActivityMetricConfig({ activityType: 'cycling' }).primaryMetric, 'speed');
  assert.equal(liveActivityMetricConfig({ activityType: 'run_walk' }).guidanceSlot, 'interval');
  assert.equal(liveActivityMetricConfig({ activityType: 'mobility' }).showsDistance, false);
  assert.equal(liveActivityMetricConfig({ activityType: 'strength' }).primaryMetric, 'sets');
});

test('Phase 10 source contracts preserve native bridge safety and lock-screen sizing discipline', () => {
  const moduleIndex = read('modules/stride-live-activity/src/index.ts');
  const swiftModule = read('modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift');
  const widget = read('targets/StrideRunLiveActivity/StrideRunLiveActivity.swift');

  assert.match(moduleIndex, /workoutInstanceId/);
  assert.match(moduleIndex, /payload\.workoutInstanceId \?\? payload\.sessionId/);
  assert.match(swiftModule, /endMatchingRunActivityIfNeeded/);
  assert.match(swiftModule, /endMatchingStrengthActivityIfNeeded/);
  assert.match(swiftModule, /controlStatePreservingPending/);
  assert.match(widget, /minimumScaleFactor/);
  assert.match(widget, /LockMetricCell/);
  assert.match(widget, /CompactRunControls/);
  assert.match(widget, /activityIcon/);
});
