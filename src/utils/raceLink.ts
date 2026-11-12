import type { Activity, ActivityRaceResult } from '../types/activity';
import { STANDARD_DISTANCE_METERS } from '../types/athlete';
import type { GoalArchive } from '../types/goalArchive';
import type { Race } from '../types/plan';
import type { RaceActivityLink, RaceEventSnapshot } from '../types/raceLink';
import { isValidDateOnly, timestampToDateOnly } from './dateOnly';

export const RACE_RESULT_OPTIONS: { value: GoalArchive['result']['status']; label: string }[] = [
  { value: 'unrecorded', label: 'No result added yet' }, { value: 'finished', label: 'Finished' },
  { value: 'did_not_finish', label: 'Did not finish' }, { value: 'did_not_start', label: 'Did not start' },
];
const EVENT_DISTANCES = new Set(['5k', '10k', 'half_marathon', 'marathon']);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function isValidRaceEventSnapshot(value: unknown): value is RaceEventSnapshot {
  return object(value) && typeof value.id === 'string' && !!value.id.trim()
    && typeof value.name === 'string' && !!value.name.trim() && typeof value.date === 'string' && isValidDateOnly(value.date)
    && typeof value.distance === 'string' && EVENT_DISTANCES.has(value.distance)
    && value.distanceMeters === STANDARD_DISTANCE_METERS[value.distance];
}
export function isValidRaceActivityLink(value: unknown, ownerUserId?: string): value is RaceActivityLink {
  return object(value) && typeof value.ownerUserId === 'string' && !!value.ownerUserId.trim()
    && (ownerUserId === undefined || value.ownerUserId === ownerUserId) && value.athleteId === 'athlete_default'
    && isValidRaceEventSnapshot(value.event) && ['unrecorded', 'finished', 'did_not_finish'].includes(value.outcome as string)
    && typeof value.linkedAt === 'number' && Number.isFinite(value.linkedAt) && value.linkedAt > 0;
}
export function raceEventSnapshot(race: Pick<Race, 'id' | 'name' | 'date' | 'distance'>): RaceEventSnapshot {
  const event = { id: race.id, name: race.name, date: race.date, distance: race.distance,
    distanceMeters: STANDARD_DISTANCE_METERS[race.distance]! };
  if (!isValidRaceEventSnapshot(event)) throw new Error('Choose a valid named race with a known course distance.');
  return event;
}
export function createRaceActivityLink(race: Pick<Race, 'id' | 'name' | 'date' | 'distance'>, ownerUserId: string, now = Date.now()): RaceActivityLink {
  const link: RaceActivityLink = { ownerUserId, athleteId: 'athlete_default', event: raceEventSnapshot(race), outcome: 'unrecorded', linkedAt: now };
  if (!isValidRaceActivityLink(link, ownerUserId)) throw new Error('This race link has no verified owner.');
  return link;
}
export function raceLinkEvents(races: readonly Race[], archives: readonly GoalArchive[], ownerUserId: string): RaceEventSnapshot[] {
  const events = new Map<string, RaceEventSnapshot>();
  for (const race of [...archives.filter(row => row.ownerUserId === ownerUserId && row.athleteId === 'athlete_default').flatMap(row => row.race ? [row.race] : []), ...races]) {
    try { const event = raceEventSnapshot(race); events.set(event.id, event); } catch { /* Invalid legacy event remains unavailable. */ }
  }
  return [...events.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** The caller confirms finish; no distance percentage or moving-time inference. */
export function raceResultFromRecordedLink(link: RaceActivityLink | undefined, start: number | null | undefined,
  end: number | null | undefined): ActivityRaceResult | undefined {
  if (!isValidRaceActivityLink(link) || link.outcome !== 'finished' || !Number.isFinite(start) || !Number.isFinite(end)
    || start == null || end == null || start < 0 || end <= start || end > Date.now() + 5_000) return undefined;
  return { kind: 'race', distanceKey: link.event.distance, distanceMeters: link.event.distanceMeters,
    elapsedTimeSeconds: Math.ceil((end - start) / 1000), timingSource: 'recorded_elapsed', recordedAt: end };
}

/** Only source-proven full elapsed time may prefill a race result. */
export function recordedRaceElapsedSeconds(activity: Activity): number | null {
  const start = activity.startTime, end = activity.endTime;
  if (!Number.isFinite(start) || end == null || !Number.isFinite(end) || end <= start || end > Date.now() + 5_000) return null;
  const elapsed = (end - start) / 1000;
  const reported = activity.metrics.elapsedTimeSeconds;
  if (activity.metrics.elapsedTimeSource === 'recorded_wall_clock' && reported != null && Number.isFinite(reported)
    && reported > 0 && Math.abs(reported - elapsed) <= 2) return Math.ceil(elapsed);
  const health = activity.healthKit;
  if (activity.source === 'healthkit' && health && Number.isFinite(health.originalStartTime) && Number.isFinite(health.originalEndTime)
    && health.originalEndTime > health.originalStartTime && Math.abs(health.originalStartTime - start) <= 1000
    && Math.abs(health.originalEndTime - end) <= 1000) return Math.ceil((health.originalEndTime - health.originalStartTime) / 1000);
  return null;
}
export function raceLinkDateMatchesActivity(event: RaceEventSnapshot, activity: Activity): boolean {
  return Number.isFinite(activity.startTime) && timestampToDateOnly(activity.startTime) === event.date;
}
export type EffectiveRaceResult = {
  status: GoalArchive['result']['status'];
  timeSeconds?: number;
  source?: GoalArchive['result']['source'];
  linkedActivityId?: string;
  availability: 'unlinked' | 'available' | 'unavailable';
};
function linkedResult(event: RaceEventSnapshot, activity: Activity | undefined, ownerUserId: string): EffectiveRaceResult {
  const unavailable: EffectiveRaceResult = { status: 'unrecorded', availability: 'unavailable', ...(activity ? { linkedActivityId: activity.id } : {}) };
  if (!activity || !isValidRaceActivityLink(activity.raceLink, ownerUserId) || activity.raceLink.event.id !== event.id
    || activity.raceLink.event.distanceMeters !== event.distanceMeters || activity.activityType !== 'running'
    || !Number.isFinite(activity.startTime) || activity.startTime > Date.now() + 5_000) return unavailable;
  const link = activity.raceLink;
  if (link.outcome === 'did_not_finish') return { status: 'did_not_finish', linkedActivityId: activity.id, source: 'activity_link', availability: 'available' };
  if (link.outcome !== 'finished' || activity.status !== 'completed'
    || ['partial', 'stopped_early', 'skipped'].includes(activity.completionClassification ?? '')) return { ...unavailable, availability: 'available' };
  const result = activity.raceResult;
  const time = result?.kind === 'race' && result.distanceKey === event.distance && result.distanceMeters === event.distanceMeters
    && Number.isFinite(result.elapsedTimeSeconds) && result.elapsedTimeSeconds > 0
    && (result.timingSource !== 'recorded_elapsed' || recordedRaceElapsedSeconds(activity) === result.elapsedTimeSeconds) ? result.elapsedTimeSeconds : undefined;
  return { status: 'finished', ...(time === undefined ? {} : { timeSeconds: time }), linkedActivityId: activity.id,
    source: 'activity_link', availability: 'available' };
}
export function resolveRaceActivityResult(event: RaceEventSnapshot, activities: readonly Activity[], ownerUserId: string): EffectiveRaceResult {
  if (!isValidRaceEventSnapshot(event)) return { status: 'unrecorded', availability: 'unavailable' };
  const rows = activities.filter(row => isValidRaceActivityLink(row.raceLink, ownerUserId) && row.raceLink.event.id === event.id);
  // Two explicit claimants require the athlete to resolve the conflict.
  return rows.length === 1 ? linkedResult(event, rows[0], ownerUserId) : { status: 'unrecorded', availability: rows.length ? 'unavailable' : 'unlinked' };
}
export function resolveArchiveActivityResult(archive: GoalArchive, activities: readonly Activity[], ownerUserId: string): EffectiveRaceResult {
  if (archive.ownerUserId !== ownerUserId || archive.athleteId !== 'athlete_default') return { status: 'unrecorded', availability: 'unavailable' };
  if (archive.result.source === 'user' && (archive.result.status !== 'unrecorded' || archive.result.timeSeconds !== undefined)
    || !archive.race) return { ...archive.result, availability: 'unlinked' };
  let event: RaceEventSnapshot;
  try { event = raceEventSnapshot(archive.race); } catch { return { status: 'unrecorded', availability: 'unavailable' }; }
  if (archive.result.source === 'activity_link') {
    const id = archive.result.linkedActivityId;
    if (!id) return { status: 'unrecorded', availability: 'unavailable' };
    const found = activities.filter(row => row.id === id);
    const claimants = activities.filter(row => isValidRaceActivityLink(row.raceLink, ownerUserId) && row.raceLink.event.id === event.id);
    const result = linkedResult(event, found.length === 1 && claimants.length === 1 ? found[0] : undefined, ownerUserId);
    return { ...result, linkedActivityId: id };
  }
  const linked = resolveRaceActivityResult(event, activities, ownerUserId);
  return linked.availability !== 'unlinked' ? linked : { ...archive.result, availability: 'unlinked' };
}
