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
    indoorRideActive: false,
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
    indoorRideActive: false,
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
    indoorRideActive: true,
    strengthName: 'Strength',
    strengthSource: 'training_block',
  });
  assert.deepEqual(owner, {
    domain: 'running',
    name: 'Training Run',
    route: '/(tabs)/training',
  });
});

test('indoor ride resolves as its own owner and conflicts with every other domain', () => {
  const ride = resolveActiveSessionOwner({
    runningActive: false,
    outdoorActive: false,
    outdoorName: '',
    indoorRideActive: true,
    strengthName: null,
    strengthSource: null,
  });
  assert.deepEqual(ride, {
    domain: 'indoor_ride',
    name: 'Indoor Ride',
    route: '/(tabs)/activity/indoor-ride',
  });
  assert.equal(conflictingActiveSession(ride, 'indoor_ride'), null);
  assert.equal(conflictingActiveSession(ride, 'running')?.domain, 'indoor_ride');
  assert.equal(conflictingActiveSession(ride, 'outdoor')?.domain, 'indoor_ride');
  assert.equal(conflictingActiveSession(ride, 'strength')?.domain, 'indoor_ride');

  // Running and outdoor both still win priority over an active indoor ride —
  // same "one deterministic owner" rule as the legacy-overlap case above.
  const runningWins = resolveActiveSessionOwner({
    runningActive: true,
    outdoorActive: false,
    outdoorName: '',
    indoorRideActive: true,
    strengthName: null,
    strengthSource: null,
  });
  assert.equal(runningWins?.domain, 'running');

  const outdoorWins = resolveActiveSessionOwner({
    runningActive: false,
    outdoorActive: true,
    outdoorName: 'Ride',
    indoorRideActive: true,
    strengthName: null,
    strengthSource: null,
  });
  assert.equal(outdoorWins?.domain, 'outdoor');
});
