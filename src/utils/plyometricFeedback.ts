/** Optional athlete report about one actually completed impact exercise.
 * It is not a sensor measurement, screening clearance or diagnosis. */
export type PlyometricResponseFeedback = {
  version: 1;
  source: 'athlete_reported';
  landingControl: 'controlled' | 'uncertain' | 'lost';
  symptomsDuring: 'none' | 'present' | 'unknown';
  nextDayResponse: 'usual' | 'worse' | 'unknown';
  nextStep?: 'repeat' | 'easier' | 'consider_harder';
  reportedAt: number;
};
export const IMPACT_RESPONSE_DELAY_MS = 24 * 60 * 60 * 1000;

/** A next-day response cannot be reported in advance. The 24-hour rule is an
 * honest recording boundary, not a physiological definition of recovery. */
export function normalizePlyometricResponse(value: unknown, workoutTimestamp: number, now = Date.now()): PlyometricResponseFeedback | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isFinite(workoutTimestamp) || !Number.isFinite(now)) return undefined;
  const item = value as Partial<PlyometricResponseFeedback>;
  if (item.version !== 1 || item.source !== 'athlete_reported'
    || !['controlled', 'uncertain', 'lost'].includes(item.landingControl ?? '')
    || !['none', 'present', 'unknown'].includes(item.symptomsDuring ?? '')
    || !['usual', 'worse', 'unknown'].includes(item.nextDayResponse ?? '')
    || (item.nextStep !== undefined && !['repeat', 'easier', 'consider_harder'].includes(item.nextStep))
    || !Number.isFinite(item.reportedAt) || item.reportedAt! < workoutTimestamp || item.reportedAt! > now
    || (item.nextDayResponse !== 'unknown' && item.reportedAt! - workoutTimestamp < IMPACT_RESPONSE_DELAY_MS)) return undefined;
  return { version: 1, source: 'athlete_reported', landingControl: item.landingControl!, symptomsDuring: item.symptomsDuring!,
    nextDayResponse: item.nextDayResponse!, nextStep: item.nextStep ?? 'repeat', reportedAt: item.reportedAt! };
}
