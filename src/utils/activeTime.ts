export type PausableTiming = {
  startedAt: number | null;
  isPaused: boolean;
  pausedAt: number | null;
  pausedDurationMs: number;
};

export function elapsedSecondsExcludingPause(
  timing: PausableTiming,
  now = Date.now(),
): number {
  if (!timing.startedAt) return 0;
  const currentPause = timing.isPaused && timing.pausedAt
    ? Math.max(0, now - timing.pausedAt)
    : 0;
  return Math.max(0, Math.floor(
    (now - timing.startedAt - timing.pausedDurationMs - currentPause) / 1000,
  ));
}
