import assert from 'node:assert/strict';
import test from 'node:test';

import { clampStepIndex, flattenWorkoutSteps, totalRemainingMinutes } from '../workoutSteps';

function segment(overrides: Partial<{ label: string; duration: string; paceGuide: string; hrZone: number; instructions: string }> = {}) {
  return {
    label: overrides.label ?? '',
    duration: overrides.duration ?? '10 min',
    paceGuide: overrides.paceGuide ?? 'Easy',
    hrZone: overrides.hrZone ?? 2,
    rpe: [3, 4] as [number, number],
    instructions: overrides.instructions ?? 'Run easy.',
  };
}

test('flattenWorkoutSteps produces warmup, each mainSet segment, then cooldown in order', () => {
  const workout = {
    warmup: segment({ label: 'Warmup', duration: '10 min' }),
    mainSet: [
      segment({ label: 'Interval 1', duration: '4 min' }),
      segment({ label: 'Interval 2', duration: '4 min' }),
    ],
    cooldown: segment({ label: 'Cooldown', duration: '5 min' }),
  };
  const steps = flattenWorkoutSteps(workout);
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map(s => s.label), ['Warmup', 'Interval 1', 'Interval 2', 'Cooldown']);
  assert.deepEqual(steps.map(s => s.index), [0, 1, 2, 3]);
});

test('flattenWorkoutSteps falls back to a numbered label when mainSet segment has no label', () => {
  const workout = {
    warmup: segment({ label: 'Warmup' }),
    mainSet: [segment({ label: '' })],
    cooldown: segment({ label: 'Cooldown' }),
  };
  const steps = flattenWorkoutSteps(workout);
  assert.equal(steps[1].label, 'Main Set 1');
});

test('duration parsing: "N min" strings parse, non-minute strings (distance, free text) are null', () => {
  const workout = {
    warmup: segment({ duration: '12 min' }),
    mainSet: [segment({ duration: '2 miles' }), segment({ duration: 'Easy/conversational' })],
    cooldown: segment({ duration: '5.5 min' }),
  };
  const steps = flattenWorkoutSteps(workout);
  assert.equal(steps[0].durationMinutes, 12);
  assert.equal(steps[1].durationMinutes, null);
  assert.equal(steps[2].durationMinutes, null);
  assert.equal(steps[3].durationMinutes, 5.5);
});

test('totalRemainingMinutes sums parseable durations from the current index', () => {
  const workout = {
    warmup: segment({ duration: '10 min' }),
    mainSet: [segment({ duration: '20 min' })],
    cooldown: segment({ duration: '5 min' }),
  };
  const steps = flattenWorkoutSteps(workout);
  assert.equal(totalRemainingMinutes(steps, 0), 35);
  assert.equal(totalRemainingMinutes(steps, 1), 25);
  assert.equal(totalRemainingMinutes(steps, 3), 0);
});

test('totalRemainingMinutes returns null (not a wrong partial sum) if any remaining step is unparseable', () => {
  const workout = {
    warmup: segment({ duration: '10 min' }),
    mainSet: [segment({ duration: '2 miles' })],
    cooldown: segment({ duration: '5 min' }),
  };
  const steps = flattenWorkoutSteps(workout);
  assert.equal(totalRemainingMinutes(steps, 0), null);
  // once past the unparseable step, the remainder is known again
  assert.equal(totalRemainingMinutes(steps, 2), 5);
});

test('clampStepIndex keeps index in range, handles empty list', () => {
  const workout = {
    warmup: segment(),
    mainSet: [segment()],
    cooldown: segment(),
  };
  const steps = flattenWorkoutSteps(workout);
  assert.equal(clampStepIndex(steps, -5), 0);
  assert.equal(clampStepIndex(steps, 100), steps.length - 1);
  assert.equal(clampStepIndex(steps, 1), 1);
  assert.equal(clampStepIndex([], 3), 0);
});
