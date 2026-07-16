import assert from 'node:assert/strict';
import test from 'node:test';
import {
  liveActivityCommandMatchesSession,
  normalizeOutdoorLiveActivitySnapshot,
  shouldAcceptControlCommand,
} from '../../src/lib/liveActivityContracts';

test('session ownership keeps preset and Training Block commands isolated', () => {
  const trainingTarget = {
    sessionId: 'training_block:strength-a:100',
    sessionSource: 'training_block',
  };
  const presetCommand = {
    sessionId: 'preset:preset-a:200',
    sessionSource: 'preset',
  };

  assert.equal(liveActivityCommandMatchesSession(trainingTarget, trainingTarget), true);
  assert.equal(liveActivityCommandMatchesSession(presetCommand, trainingTarget), false);
  assert.equal(liveActivityCommandMatchesSession({}, trainingTarget), false);
  assert.equal(liveActivityCommandMatchesSession(presetCommand), true);
});

test('running and walking payloads use pace without speed leakage', () => {
  for (const activityType of ['running', 'walking', 'run_walk', 'hiking'] as const) {
    const payload = normalizeOutdoorLiveActivitySnapshot({
      activityName: 'Easy Session',
      activityType,
      elapsedSeconds: 600,
      distanceMiles: 1.2,
      averagePace: '10:20',
      averageSpeedMph: 15,
      heartRateBpm: 130,
      isPaused: false,
    });
    assert.equal(payload.metricLabel, 'PACE');
    assert.equal(payload.metricValue, '10:20');
    assert.equal(payload.metricUnit, '/mi');
  }
});

test('cycling and skiing payloads use speed without pace leakage', () => {
  for (const activityType of ['cycling', 'downhill_skiing', 'cross_country_skiing', 'snowboarding'] as const) {
    const payload = normalizeOutdoorLiveActivitySnapshot({
      activityName: 'Outdoor Session',
      activityType,
      elapsedSeconds: 600,
      distanceMiles: 4.2,
      averagePace: '4:00',
      averageSpeedMph: 14.34,
      heartRateBpm: 138,
      isPaused: false,
    });
    assert.equal(payload.metricLabel, 'SPEED');
    assert.equal(payload.metricValue, '14.3');
    assert.equal(payload.metricUnit, 'mph');
  }
});

test('outdoor payload carries session ownership and applicable elevation context', () => {
  const payload = normalizeOutdoorLiveActivitySnapshot({
    sessionId: 'outdoor:session-1',
    sessionSource: 'outdoor',
    activityName: 'Snowboard',
    activityType: 'snowboarding',
    elapsedSeconds: 900,
    distanceMiles: 3.4,
    averageSpeedMph: 18.2,
    heartRateBpm: 142,
    isPaused: false,
    elevationGainMeters: 35,
    elevationLossMeters: 640,
  });
  assert.equal(payload.sessionId, 'outdoor:session-1');
  assert.equal(payload.sessionSource, 'outdoor');
  assert.equal(payload.metricLabel, 'SPEED');
  assert.equal(payload.elevationDisplay, '35 m');
  assert.equal(payload.descentDisplay, '640 m');
});

test('run-walk interval and navigation content survive payload normalization', () => {
  const payload = normalizeOutdoorLiveActivitySnapshot({
    activityName: 'Couch to 5K',
    activityType: 'run_walk',
    elapsedSeconds: 180,
    distanceMiles: 0.4,
    averagePace: '12:10',
    heartRateBpm: null,
    isPaused: false,
    currentInterval: 'Run 1:00',
    nextTransition: 'Walk in 0:30',
    navigationInstruction: 'Turn left onto Pine Street',
    cueText: 'Hydration in 5:00',
    controlState: 'pause_pending',
  });
  assert.equal(payload.currentInterval, 'Run 1:00');
  assert.equal(payload.nextTransition, 'Walk in 0:30');
  assert.equal(payload.navigationInstruction, 'Turn left onto Pine Street');
  assert.equal(payload.controlState, 'pause_pending');
});

test('pending control commands suppress duplicate and conflicting rapid taps', () => {
  assert.equal(shouldAcceptControlCommand({
    pendingAction: null,
    pendingCreatedAtMs: null,
    nextAction: 'pause',
    nowMs: 1000,
  }), true);
  assert.equal(shouldAcceptControlCommand({
    pendingAction: 'pause',
    pendingCreatedAtMs: 1000,
    nextAction: 'pause',
    nowMs: 1200,
  }), false);
  assert.equal(shouldAcceptControlCommand({
    pendingAction: 'pause',
    pendingCreatedAtMs: 1000,
    nextAction: 'resume',
    nowMs: 1200,
  }), false);
  assert.equal(shouldAcceptControlCommand({
    pendingAction: 'pause',
    pendingCreatedAtMs: 1000,
    nextAction: 'resume',
    nowMs: 17_001,
  }), true);
});
