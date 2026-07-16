import assert from 'node:assert/strict';
import test from 'node:test';

import { elapsedSecondsExcludingPause } from '../activeTime';

test('active time excludes accumulated and current paused intervals', () => {
  assert.equal(elapsedSecondsExcludingPause({
    startedAt: 1_000,
    isPaused: false,
    pausedAt: null,
    pausedDurationMs: 2_000,
  }, 13_000), 10);

  assert.equal(elapsedSecondsExcludingPause({
    startedAt: 1_000,
    isPaused: true,
    pausedAt: 9_000,
    pausedDurationMs: 2_000,
  }, 13_000), 6);
});

test('finishing or rehydrating while paused does not count wall-clock pause time', () => {
  const persisted = {
    startedAt: 10_000,
    isPaused: true,
    pausedAt: 40_000,
    pausedDurationMs: 5_000,
  };
  assert.equal(elapsedSecondsExcludingPause(persisted, 100_000), 25);
  assert.equal(elapsedSecondsExcludingPause({ ...persisted, startedAt: null }, 100_000), 0);
});
