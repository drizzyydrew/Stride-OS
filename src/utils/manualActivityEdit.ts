import type { Activity, ActivityDraft, ActivityMetrics } from '../types/activity';

export function parseElevationInput(text: string, units: 'metric' | 'imperial'): { meters?: number; error?: string } {
  if (!text.trim()) return {};
  if (!/^\d+(?:\.\d*)?$|^\.\d+$/.test(text.trim())) return { error: 'Enter a nonnegative elevation gain, or leave it blank.' };
  const value = Number(text);
  const meters = units === 'metric' ? value : value * 0.3048;
  return Number.isFinite(meters) ? { meters } : { error: 'Enter a finite elevation gain.' };
}

export function elevationInputText(meters: number | undefined, units: 'metric' | 'imperial'): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return '';
  return String(Number((units === 'metric' ? meters : meters / 0.3048).toFixed(2)));
}

export function hasRecordedEvidence(activity: Activity): boolean {
  return !['manual', 'training_plan'].includes(activity.source) || Boolean(activity.workoutInstanceId || activity.healthKit
    || activity.metrics.routeCoordinates?.length || activity.metrics.rawHeartRateSamples?.length
    || activity.metrics.powerSamples?.length || activity.metrics.cadenceSamples?.length);
}

/** Apply only athlete-edited fields; a rounded prefill is never a correction. */
export function mergeManualActivityEdit(existing: Activity, draft: ActivityDraft, changed: ReadonlySet<string>): ActivityDraft {
  const recorded = hasRecordedEvidence(existing);
  const next: ActivityDraft = { ...existing, metrics: { ...existing.metrics }, trainingLoad: undefined };
  if (changed.has('activityKey') && !recorded) {
    next.activityType = draft.activityType;
    next.subtype = draft.subtype;
    next.indoor = draft.indoor;
  }
  if (changed.has('pool') && !recorded) { next.subtype = draft.subtype; next.indoor = draft.indoor; }
  if (changed.has('completionState')) { next.status = draft.status; next.completionClassification = draft.completionClassification; }
  if (changed.has('notes')) next.notes = draft.notes;
  if (changed.has('rpe')) next.rpe = draft.rpe;
  if (changed.has('shoeId')) next.shoeId = draft.shoeId;
  if (!recorded && changed.has('activityDate')) {
    next.startTime = draft.startTime;
    next.endTime = existing.endTime == null ? undefined : next.startTime + existing.endTime - existing.startTime;
  }
  const fields: [string[], (keyof ActivityMetrics)[]][] = [
    [['durationMinutes'], ['durationSeconds', 'activeTimeSeconds']],
    [['distance', 'distanceUnit'], ['distanceMeters']],
    [['elevationGain'], ['elevationGainMeters']],
    [['averageHr'], ['averageHeartRateBpm']], [['maximumHr'], ['maximumHeartRateBpm']],
    [['cadence'], ['cadenceRpm']], [['power'], ['cyclingPowerWatts']],
    [recorded ? [] : ['routeId'], ['routeId']],
  ];
  for (const [inputs, keys] of fields) {
    if (!inputs.some(input => changed.has(input))) continue;
    for (const key of keys) Object.assign(next.metrics, { [key]: draft.metrics[key] });
  }
  if (changed.has('laps') && draft.metrics.swimming) {
    next.metrics.swimming = { ...draft.metrics.swimming, ...existing.metrics.swimming, laps: draft.metrics.swimming.laps };
  }
  if (changed.has('pool') && !recorded && draft.metrics.swimming) {
    next.metrics.swimming = { ...existing.metrics.swimming, ...draft.metrics.swimming };
  }
  if (changed.has('rounds')) next.metrics.mixedModal = { ...existing.metrics.mixedModal, rounds: draft.metrics.mixedModal?.rounds };
  const sources = { ...existing.metrics.metricSources };
  if (changed.has('elevationGain')) sources.elevation = draft.metrics.elevationGainMeters == null ? undefined : 'manual_entry';
  if (changed.has('distance') || changed.has('distanceUnit')) {
    sources.distance = 'manual_entry';
    next.metrics.distanceSource = 'manual_entry';
  }
  if (changed.has('averageHr') || changed.has('maximumHr')) sources.heartRate = 'manual_entry';
  if (changed.has('cadence')) sources.cadence = 'manual_entry';
  if (changed.has('power')) sources.power = 'manual_entry';
  next.metrics.metricSources = sources;
  if (['distance', 'distanceUnit', 'durationMinutes'].some(field => changed.has(field))) {
    const seconds = next.metrics.durationSeconds;
    const meters = next.metrics.distanceMeters;
    if (seconds && meters) {
      if (existing.metrics.pace || draft.metrics.pace) next.metrics.pace = { ...existing.metrics.pace, averageSecondsPerKilometer: seconds / (meters / 1000) };
      if (existing.metrics.speed || draft.metrics.speed) next.metrics.speed = { ...existing.metrics.speed, averageMetersPerSecond: meters / seconds };
    } else { next.metrics.pace = undefined; next.metrics.speed = undefined; }
    sources.pace = next.metrics.pace ? 'manual_entry' : undefined;
    sources.speed = next.metrics.speed ? 'manual_entry' : undefined;
  }
  return next;
}
