import type { AutoPauseActivity, AutoPauseMode } from './autoPause';

const modes: readonly string[] = ['off', 'running_only', 'cycling_only', 'running_and_cycling'];

/** Explicit Off is a saved choice, never a request to restore the default. */
export function restoredAutoPauseMode(saved: unknown, current: AutoPauseMode): AutoPauseMode {
  return typeof saved === 'string' && modes.includes(saved) ? saved as AutoPauseMode : current;
}

/** A sport-specific switch preserves the other sport's independent setting. */
export function setActivityAutoPauseEnabled(mode: AutoPauseMode, activity: AutoPauseActivity, enabled: boolean): AutoPauseMode {
  let running = mode === 'running_only' || mode === 'running_and_cycling';
  let cycling = mode === 'cycling_only' || mode === 'running_and_cycling';
  if (activity === 'running') running = enabled;
  else cycling = enabled;
  return running && cycling ? 'running_and_cycling' : running ? 'running_only' : cycling ? 'cycling_only' : 'off';
}
