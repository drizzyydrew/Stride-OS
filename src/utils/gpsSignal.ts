/** No accepted fix for this long while moving = weak signal. */
export const WEAK_GPS_AFTER_MS = 20_000;

export function isGpsSignalWeak(args: {
  active: boolean;
  paused: boolean;
  lastGoodFixAt: number | null | undefined;
  startedAt: number | null | undefined;
  now: number;
}): boolean {
  if (!args.active || args.paused) return false;
  const reference = args.lastGoodFixAt ?? args.startedAt;
  if (!reference) return false;
  return args.now - reference > WEAK_GPS_AFTER_MS;
}
