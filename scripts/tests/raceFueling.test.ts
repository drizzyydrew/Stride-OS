import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FUELING_REMINDER_INTERVALS } from '../../src/constants/hydrationConfig';
import { evaluateRaceFuelCue } from '../../src/utils/raceFueling';

test('all supported fueling intervals drive active race cues', () => {
  for (const intervalMinutes of FUELING_REMINDER_INTERVALS) {
    const before = evaluateRaceFuelCue({
      elapsedSeconds: intervalMinutes * 60 - 1,
      lastCueElapsedSeconds: 0,
      intervalMinutes,
      isActive: true,
      isPaused: false,
      runMode: 'race',
    });
    const due = evaluateRaceFuelCue({
      elapsedSeconds: intervalMinutes * 60,
      lastCueElapsedSeconds: 0,
      intervalMinutes,
      isActive: true,
      isPaused: false,
      runMode: 'race',
    });
    assert.equal(before.shouldCue, false);
    assert.equal(due.shouldCue, true);
  }
});

test('pause and resume do not duplicate a fueling cue', () => {
  const due = evaluateRaceFuelCue({
    elapsedSeconds: 900,
    lastCueElapsedSeconds: 0,
    intervalMinutes: 15,
    isActive: true,
    isPaused: false,
    runMode: 'race',
  });
  assert.equal(due.shouldCue, true);

  const paused = evaluateRaceFuelCue({
    elapsedSeconds: 900,
    lastCueElapsedSeconds: due.nextLastCueElapsedSeconds,
    intervalMinutes: 15,
    isActive: true,
    isPaused: true,
    runMode: 'race',
  });
  const resumed = evaluateRaceFuelCue({
    elapsedSeconds: 900,
    lastCueElapsedSeconds: due.nextLastCueElapsedSeconds,
    intervalMinutes: 15,
    isActive: true,
    isPaused: false,
    runMode: 'race',
  });
  assert.equal(paused.shouldCue, false);
  assert.equal(resumed.shouldCue, false);
});
