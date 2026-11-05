import type { Activity, ActivityRaceResult } from '../types/activity';
import { STANDARD_DISTANCE_METERS, type RacePR } from '../types/athlete';
import type { CustomWorkoutLog } from '../types/customWorkout';
import type { GoalArchive } from '../types/goalArchive';
import { isValidDateOnly, todayDateOnly } from './dateOnly';

const DAY_MS = 86_400_000;
const DISTANCE_LABELS: Record<string, string> = {
  '5k': '5K', '10k': '10K', half_marathon: 'Half Marathon', marathon: 'Marathon',
  '1_mile': '1 Mile', '800m': '800m',
};

/** Race time is elapsed time, never a clock time or the sum of interval reps. */
export function parseRaceElapsedTime(value: string): number | null {
  const clean = value.trim();
  if (!/^(?:\d+:[0-5]\d|\d+:[0-5]\d:[0-5]\d)$/.test(clean)) return null;
  const parts = clean.split(':').map(Number);
  const seconds = parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

export function isValidRacePerformance(pr: RacePR, now = Date.now()): boolean {
  return Number.isFinite(now) && typeof pr.id === 'string' && pr.id.length > 0
    && Number.isFinite(pr.distanceMeters) && pr.distanceMeters > 0
    && Number.isFinite(pr.timeSeconds) && pr.timeSeconds > 0
    && isValidDateOnly(pr.date) && pr.date <= todayDateOnly(new Date(now));
}

/** Explicit form boundary: course distance and full elapsed finish time are required. */
export function buildActivityRaceResult(
  kind: ActivityRaceResult['kind'], distanceKey: ActivityRaceResult['distanceKey'],
  elapsedText: string, customDistanceMeters?: number,
): ActivityRaceResult | null {
  const seconds = parseRaceElapsedTime(elapsedText);
  const meters = distanceKey === 'custom' ? customDistanceMeters : STANDARD_DISTANCE_METERS[distanceKey];
  if (!['race', 'time_trial'].includes(kind) || seconds == null || meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  return { kind, distanceKey, distanceMeters: meters, elapsedTimeSeconds: seconds };
}

export function completedActivityRaceResult(activity: Pick<Activity, 'activityType' | 'status' | 'completionClassification' | 'raceResult'>): ActivityRaceResult | undefined {
  return activity.activityType === 'running' && activity.status === 'completed'
    && !['partial', 'stopped_early', 'skipped'].includes(activity.completionClassification ?? '') ? activity.raceResult : undefined;
}

export function activityRacePerformance(activity: Activity, ownerUserId: string, now = Date.now()): RacePR | null {
  const result = completedActivityRaceResult(activity);
  if (!result
    || !['race', 'time_trial'].includes(result.kind) || !Number.isFinite(activity.startTime)) return null;
  if (result.distanceKey !== 'custom' && STANDARD_DISTANCE_METERS[result.distanceKey] !== result.distanceMeters) return null;
  const pr: RacePR = {
    id: `activity-result:${activity.id}`, distanceKey: result.distanceKey,
    distanceLabel: result.distanceKey === 'custom' ? `${Number((result.distanceMeters / 1000).toFixed(3))} km` : DISTANCE_LABELS[result.distanceKey],
    distanceMeters: result.distanceMeters, timeSeconds: result.elapsedTimeSeconds,
    date: todayDateOnly(new Date(activity.startTime)), official: result.kind === 'race',
    ...(result.recordedAt == null ? {} : { recordedAt: result.recordedAt }),
    source: { kind: 'activity', activityId: activity.id, ownerUserId },
  };
  return isValidRacePerformance(pr, now) ? pr : null;
}

/** All-time best per exact event distance. Retain every result for current-fitness calibration. */
export function bestRacePRsByDistance(records: readonly RacePR[], now = Date.now()): RacePR[] {
  const best = new Map<number, RacePR>();
  for (const record of records) {
    if (!isValidRacePerformance(record, now)) continue;
    const prior = best.get(record.distanceMeters);
    if (!prior || record.timeSeconds < prior.timeSeconds
      || (record.timeSeconds === prior.timeSeconds && record.date < prior.date)) {
      best.set(record.distanceMeters, record);
    }
  }
  return [...best.values()].sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function archivePerformance(archive: GoalArchive, ownerUserId: string, athleteId: string, now: number): RacePR | null {
  if (archive.ownerUserId !== ownerUserId || archive.athleteId !== athleteId
    || archive.kind !== 'race' || !archive.race || archive.result.status !== 'finished'
    || archive.result.timeSeconds == null) return null;
  const key = archive.race.distance;
  const meters = STANDARD_DISTANCE_METERS[key];
  if (!meters) return null;
  const pr: RacePR = {
    id: `archive-result:${archive.id}`, distanceKey: key, distanceLabel: DISTANCE_LABELS[key],
    distanceMeters: meters, timeSeconds: archive.result.timeSeconds, date: archive.race.date,
    course: archive.race.name, official: true,
    ...(archive.result.source === 'user' && Number.isFinite(archive.result.updatedAt) ? { recordedAt: archive.result.updatedAt } : {}),
    source: { kind: 'goal_archive', archiveId: archive.id, ownerUserId },
  };
  return isValidRacePerformance(pr, now) ? pr : null;
}

/**
 * Only invoke once both complete source collections have loaded for this owner.
 * Result corrections, DNF/DNS/unrecorded and deleted source rows replace/remove
 * their linked performances. User-entered PR rows are never removed or rewritten.
 * Activities alone and legacy custom-log durationMinutes do not establish a
 * full elapsed race finish time. An explicit result is required.
 */
export function reconcileRacePerformances(
  existing: readonly RacePR[], archives: readonly GoalArchive[], _customLogs: readonly CustomWorkoutLog[],
  ownerUserId: string, athleteId: string, now = Date.now(), activities: readonly Activity[] = [],
): RacePR[] {
  const manual = existing.filter(pr => !pr.source || !['goal_archive', 'custom_workout', 'activity'].includes(pr.source.kind));
  const linked = [
    ...archives.map(archive => archivePerformance(archive, ownerUserId, athleteId, now)),
    ...(athleteId === 'athlete_default' ? activities.map(activity => activityRacePerformance(activity, ownerUserId, now)) : []),
  ].filter((pr): pr is RacePR => pr !== null);
  // Keep source identities, including when one result was also manually entered.
  // Equal values do not prove that two entries describe the same race.
  const seen = new Set(manual.map(pr => pr.id));
  return [...manual, ...linked.sort((a, b) => a.id.localeCompare(b.id)).filter(pr => {
    if (seen.has(pr.id)) return false;
    seen.add(pr.id);
    return true;
  })];
}

export function calibrationHistorySignals(activities: readonly Activity[], customLogs: readonly CustomWorkoutLog[], now = Date.now()) {
  const completed = activities.filter(activity => activity.status === 'completed'
    && !['partial', 'stopped_early', 'skipped'].includes(activity.completionClassification ?? '')
    && Number.isFinite(activity.startTime) && activity.startTime <= now);
  const instances = new Set<string>();
  const ids = new Set<string>();
  const times: number[] = [];
  for (const activity of completed) {
    const instance = activity.workoutInstanceId ?? activity.healthKit?.workoutInstanceId;
    if (ids.has(activity.id) || (instance && instances.has(instance))) continue;
    ids.add(activity.id);
    if (instance) instances.add(instance);
    times.push(activity.startTime);
  }
  // Custom logs are a separate legacy collection, not normalized Activity rows.
  const logIds = new Set<string>();
  for (const log of customLogs) {
    if (logIds.has(log.id) || !isValidDateOnly(log.date) || log.date > todayDateOnly(new Date(now))) continue;
    const duration = log.category === 'running' ? log.durationMinutes
      : log.category === 'strength' ? log.strengthDurationMin
        : log.category === 'cross_training' ? log.crossDurationMin
          : log.category === 'mobility' ? log.mobilityDurationMin : log.otherDurationMin;
    if (!Number.isFinite(duration) || (duration ?? 0) <= 0) continue;
    logIds.add(log.id);
    times.push(new Date(`${log.date}T00:00:00`).getTime());
  }
  return {
    recentWorkoutCount: times.filter(time => time >= now - 14 * DAY_MS).length,
    lastWorkoutDaysAgo: times.length ? Math.max(0, Math.floor((now - times.reduce((latest, time) => Math.max(latest, time), 0)) / DAY_MS)) : 7,
  };
}
