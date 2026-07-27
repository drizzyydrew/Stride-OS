import assert from 'node:assert/strict';
import test from 'node:test';

import {
  relevantVoiceCueCategories,
  shouldSpeakVoiceCue,
  type VoiceCuePreferences,
} from '../voiceCoaching';

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
