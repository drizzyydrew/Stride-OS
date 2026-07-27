import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { VoiceCuePreferences } from '../../src/utils/voiceCoaching';
import {
  planVoiceCueDelivery,
  VOICE_CATEGORY_PRIORITY,
} from '../../src/utils/voiceCoachDelivery';
import { trimVoiceLogEntries } from '../../src/utils/voiceLog';

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

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('voice delivery planner handles suppression, web unavailable, cooldown, and queued states', () => {
  assert.equal(planVoiceCueDelivery({
    text: '',
    category: 'motivation',
    mode: 'coach',
    preferences,
    now: 10_000,
    platform: 'ios',
  }).state, 'suppressed');
  assert.equal(planVoiceCueDelivery({
    text: 'Test',
    category: 'motivation',
    mode: 'coach',
    preferences,
    now: 10_000,
    platform: 'web',
  }).state, 'unavailable');
  assert.equal(planVoiceCueDelivery({
    text: 'Drink',
    category: 'hydration',
    mode: 'coach',
    preferences,
    now: 20_000,
    lastCategoryPlayedAt: { hydration: 10_000 },
    platform: 'ios',
  }).state, 'cooldown');
  assert.equal(planVoiceCueDelivery({
    text: 'Turn left',
    category: 'navigation',
    mode: 'minimal',
    preferences,
    now: 80_000,
    platform: 'ios',
  }).state, 'queued');
});

test('voice delivery priorities keep workout-critical cues ahead of motivation', () => {
  assert.ok(VOICE_CATEGORY_PRIORITY.interval > VOICE_CATEGORY_PRIORITY.navigation);
  assert.ok(VOICE_CATEGORY_PRIORITY.navigation > VOICE_CATEGORY_PRIORITY.motivation);
  assert.ok(VOICE_CATEGORY_PRIORITY.heartRate > VOICE_CATEGORY_PRIORITY.technique);
});

test('voice log store keeps a capped newest-first ring buffer', () => {
  const entries = trimVoiceLogEntries(Array.from({ length: 45 }, (_, index) => `cue_${44 - index}`));
  assert.equal(entries.length, 40);
  assert.equal(entries[0], 'cue_44');
  assert.equal(entries.at(-1), 'cue_5');
});

test('Phase 9 source contracts install expo-audio, expose test voice, and keep voiceCue as a shim', () => {
  const packageJson = read('package.json');
  const appJson = read('app.json');
  const settings = read('app/(tabs)/settings/index.tsx');
  const voiceCue = read('src/lib/voiceCue.ts');
  const voiceCoach = read('src/lib/voiceCoach.ts');
  const training = read('app/(tabs)/training/index.tsx');

  assert.match(packageJson, /"expo-audio"/);
  assert.match(appJson, /"expo-audio"/);
  assert.match(settings, /Test Voice Coaching/);
  assert.match(settings, /Route navigation/);
  assert.match(voiceCue, /enqueueVoiceCoachCue/);
  assert.match(voiceCoach, /setAudioModeAsync/);
  assert.match(voiceCoach, /interruptionMode:\s*'duckOthers'/);
  assert.match(training, /'navigation'/);
  assert.match(training, /'heartRate'/);
  assert.doesNotMatch(training, /function speakCue\(text: string\): void/);
});
