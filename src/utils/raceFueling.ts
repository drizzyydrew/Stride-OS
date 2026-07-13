import type { FuelingReminderIntervalMin } from '../constants/hydrationConfig';

export type RaceFuelCueState = {
  elapsedSeconds: number;
  lastCueElapsedSeconds: number;
  intervalMinutes: FuelingReminderIntervalMin;
  isActive: boolean;
  isPaused: boolean;
  runMode: string;
};

export function evaluateRaceFuelCue(state: RaceFuelCueState): {
  shouldCue: boolean;
  nextLastCueElapsedSeconds: number;
} {
  const shouldCue = state.isActive
    && !state.isPaused
    && state.runMode === 'race'
    && state.elapsedSeconds > 0
    && state.elapsedSeconds - state.lastCueElapsedSeconds >= state.intervalMinutes * 60;

  return {
    shouldCue,
    nextLastCueElapsedSeconds: shouldCue
      ? state.elapsedSeconds
      : state.lastCueElapsedSeconds,
  };
}
