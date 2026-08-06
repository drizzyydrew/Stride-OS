import assert from 'node:assert/strict';
import test from 'node:test';

import {
  relevantVoiceCueCategories,
  shouldSpeakVoiceCue,
  type VoiceCuePreferences,
} from '../voiceCoaching';
import {
  DEFAULT_DISTANCE_SPLIT_STATE,
  evaluateDistanceSplitCue,
} from '../voiceCoachingEngine';

const preferences: VoiceCuePreferences = {
  interval: true,
  pace: true,
  heartRate: true,
  runWalk: true,
  motivation: true,
  technique: true,
  fueling: true,
  hydration: true,
  navigation: true,
};

test('silent coaching suppresses every cue category', () => {
  for (const category of Object.keys(preferences)) {
    assert.equal(
      shouldSpeakVoiceCue(
        'silent',
        preferences,
        category as keyof VoiceCuePreferences,
      ),
      false,
    );
  }
});

test('minimal coaching keeps essential workout changes and reminders', () => {
  assert.equal(shouldSpeakVoiceCue('minimal', preferences, 'interval'), true);
  assert.equal(shouldSpeakVoiceCue('minimal', preferences, 'runWalk'), true);
  assert.equal(shouldSpeakVoiceCue('minimal', preferences, 'navigation'), true);
  assert.equal(shouldSpeakVoiceCue('minimal', preferences, 'motivation'), false);
  assert.equal(shouldSpeakVoiceCue('minimal', preferences, 'technique'), false);
});

test('a category toggle overrides the selected coaching level', () => {
  assert.equal(
    shouldSpeakVoiceCue(
      'coach',
      { ...preferences, hydration: false },
      'hydration',
    ),
    false,
  );
});

test('voice cue relevance is activity-specific without showing irrelevant controls', () => {
  assert.ok(relevantVoiceCueCategories('running').includes('pace'));
  assert.ok(relevantVoiceCueCategories('running').includes('navigation'));
  assert.equal(relevantVoiceCueCategories('strength').includes('pace'), false);
  assert.equal(relevantVoiceCueCategories('mobility').includes('hydration'), false);
  assert.ok(relevantVoiceCueCategories('indoor_cycling').includes('heartRate'));
});

test('distance split cue: no announcement before the configured boundary', () => {
  const result = evaluateDistanceSplitCue({
    state: DEFAULT_DISTANCE_SPLIT_STATE,
    distanceMiles: 0.4,
    elapsedMovingSec: 300,
    units: 'imperial',
    interval: 'half',
  });
  assert.equal(result.text, undefined);
  assert.equal(result.state.lastSplitIndex, 0);
});

test('distance split cue: announces half-mile updates with metrics (imperial)', () => {
  const result = evaluateDistanceSplitCue({
    state: DEFAULT_DISTANCE_SPLIT_STATE,
    distanceMiles: 0.5,
    elapsedMovingSec: 255, // 8:30/mi for the first half mile
    units: 'imperial',
    interval: 'half',
  });
  assert.equal(result.text, 'Half mile. Split 8 minutes 30 seconds per mile, average 8 minutes 30 seconds per mile, 4 minutes 15 seconds elapsed.');
  assert.equal(result.state.lastSplitIndex, 1);
  assert.equal(result.state.lastSplitElapsedSec, 255);
});

test('distance split cue: announces mile with its split pace (imperial)', () => {
  const result = evaluateDistanceSplitCue({
    state: DEFAULT_DISTANCE_SPLIT_STATE,
    distanceMiles: 1.0,
    elapsedMovingSec: 510, // 8:30 for the first mile
    units: 'imperial',
    interval: 'one',
  });
  assert.equal(result.text, '1 mile. Split 8 minutes 30 seconds per mile, average 8 minutes 30 seconds per mile, 8 minutes 30 seconds elapsed.');
  assert.equal(result.state.lastSplitIndex, 1);
  assert.equal(result.state.lastSplitElapsedSec, 510);
});

test('distance split cue: split pace covers only the latest segment', () => {
  const afterMileOne = { lastSplitIndex: 1, lastSplitElapsedSec: 510 };
  const result = evaluateDistanceSplitCue({
    state: afterMileOne,
    distanceMiles: 2.0,
    elapsedMovingSec: 510 + 480, // second mile took 8:00
    units: 'imperial',
    interval: 'one',
  });
  assert.equal(result.text, '2 miles. Split 8 minutes per mile, average 8 minutes 15 seconds per mile, 16 minutes 30 seconds elapsed.');
  assert.equal(result.state.lastSplitIndex, 2);
});

test('distance split cue: uses kilometers for metric users', () => {
  const result = evaluateDistanceSplitCue({
    state: DEFAULT_DISTANCE_SPLIT_STATE,
    distanceMiles: 0.5 / 1.609344, // exactly 0.5 km
    elapsedMovingSec: 156, // 5:12 per km
    units: 'metric',
    interval: 'half',
  });
  assert.equal(result.text, 'Half kilometer. Split 5 minutes 12 seconds per kilometer, average 5 minutes 12 seconds per kilometer, 2 minutes 36 seconds elapsed.');
  assert.equal(result.state.lastSplitIndex, 1);
});

test('distance split cue: does not re-announce the same mile on later updates', () => {
  const afterMileOne = { lastSplitIndex: 1, lastSplitElapsedSec: 510 };
  const result = evaluateDistanceSplitCue({
    state: afterMileOne,
    distanceMiles: 1.4,
    elapsedMovingSec: 700,
    units: 'imperial',
    interval: 'one',
  });
  assert.equal(result.text, undefined);
  assert.equal(result.state.lastSplitIndex, 1);
});
