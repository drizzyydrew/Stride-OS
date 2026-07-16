import assert from 'node:assert/strict';
import test from 'node:test';

import {
  conflictingActiveSession,
  resolveActiveSessionOwner,
} from '../activeSessionOwner';

test('one active-session owner resolves across running, outdoor, and strength', () => {
  const running = resolveActiveSessionOwner({
    runningActive: true,
    outdoorActive: false,
    outdoorName: '',
    strengthName: null,
    strengthSource: null,
  });
  assert.equal(running?.domain, 'running');
  assert.equal(conflictingActiveSession(running, 'strength')?.route, '/(tabs)/training');
  assert.equal(conflictingActiveSession(running, 'running'), null);

  const preset = resolveActiveSessionOwner({
    runningActive: false,
    outdoorActive: false,
    outdoorName: '',
    strengthName: 'Runner Strength',
    strengthSource: 'preset',
  });
  assert.equal(preset?.route, '/(tabs)/strength/preset-session');
  assert.equal(conflictingActiveSession(preset, 'outdoor')?.domain, 'strength');
});

test('legacy overlap resolves deterministically instead of exposing two owners', () => {
  const owner = resolveActiveSessionOwner({
    runningActive: true,
    outdoorActive: true,
    outdoorName: 'Ride',
    strengthName: 'Strength',
    strengthSource: 'training_block',
  });
  assert.deepEqual(owner, {
    domain: 'running',
    name: 'Training Run',
    route: '/(tabs)/training',
  });
});
