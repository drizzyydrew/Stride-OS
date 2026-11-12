import { STANDARD_DISTANCE_METERS, type RacePR, type StandardDistance } from '../types/athlete';
import { isValidRacePerformance } from './racePerformance';

export const RACE_PR_BADGE_IDS: Record<StandardDistance, string> = {
  '800m': 'race_pr_800m', '1_mile': 'race_pr_1_mile', '5k': 'race_pr_5k', '10k': 'race_pr_10k',
  half_marathon: 'race_pr_half_marathon', marathon: 'race_pr_marathon',
};
export const RACE_PR_DISTANCES = Object.keys(RACE_PR_BADGE_IDS) as StandardDistance[];

/** Exact event class and full elapsed result, independent of workout minimum durations. */
export function racePrBestByDistance(records: readonly RacePR[], now = Date.now()): Partial<Record<StandardDistance, RacePR>> {
  const best: Partial<Record<StandardDistance, RacePR>> = {};
  for (const record of records) {
    const key = record.distanceKey as StandardDistance;
    if (!Object.prototype.hasOwnProperty.call(RACE_PR_BADGE_IDS, key)
      || record.distanceMeters !== STANDARD_DISTANCE_METERS[key] || !isValidRacePerformance(record, now)) continue;
    const prior = best[key];
    if (!prior || record.timeSeconds < prior.timeSeconds
      || (record.timeSeconds === prior.timeSeconds && `${record.date}:${record.id}` < `${prior.date}:${prior.id}`)) best[key] = record;
  }
  return best;
}

export type RacePrNotification = {
  eventKey: string;
  ownerUserId: string;
  athleteId: 'athlete_default';
  distanceKey: StandardDistance;
  timeSeconds: number;
  previousTimeSeconds?: number;
  sourcePerformanceId: string;
  date: string;
};
export type RacePrLedger = {
  version: 1;
  ownerUserId: string;
  athleteId: 'athlete_default';
  initializedAt: number;
  best: Partial<Record<StandardDistance, { timeSeconds: number; sourcePerformanceId: string }>>;
  earnedDistances: StandardDistance[];
  observedSources: string[];
  observedPerformances: string[];
};

export function racePrSourceIdentity(pr: RacePR): string {
  if ((pr.source?.kind === 'activity' || pr.source?.kind === 'goal_archive') && pr.source.raceId) return `race:${pr.source.raceId}`;
  return pr.source?.kind === 'activity' || pr.source?.kind === 'recorded_effort' ? `activity:${pr.source.activityId}`
    : pr.source?.kind === 'goal_archive' ? `archive:${pr.source.archiveId}` : `manual:${pr.id}`;
}
function racePrSourceAliases(pr: RacePR): string[] {
  const values = [racePrSourceIdentity(pr)];
  if (pr.source?.kind === 'activity') {
    values.push(`activity:${pr.source.activityId}`);
    if (pr.source.archiveId) values.push(`archive:${pr.source.archiveId}`);
  } else if (pr.source?.kind === 'goal_archive') values.push(`archive:${pr.source.archiveId}`);
  return values;
}
export function racePrPerformanceFingerprint(pr: RacePR): string {
  return JSON.stringify([pr.distanceKey, pr.distanceMeters, pr.date, pr.timeSeconds]);
}

/** Silent initial history seed. Each later new performance may celebrate once;
 * corrections update the best but never replay an already observed source.
 * The remembered result fingerprints also cover duplicate provenance/reimports.
 */
export function nextRacePrLedger(previous: RacePrLedger | null, records: readonly RacePR[], ownerUserId: string,
  now = Date.now(), initialObservedAt?: number): { ledger: RacePrLedger; notifications: RacePrNotification[] } {
  if (!previous && Number.isFinite(initialObservedAt) && initialObservedAt! > 0 && initialObservedAt! <= now) {
    // Seed old restored history, then evaluate explicit entries made while the
    // initial source read was pending. First-use is not a notification blackout.
    const old = records.filter(pr => !(Number.isFinite(pr.recordedAt) && pr.recordedAt! >= initialObservedAt! && pr.recordedAt! <= now));
    const baseline = nextRacePrLedger(null, old, ownerUserId, initialObservedAt!).ledger;
    return nextRacePrLedger(baseline, records, ownerUserId, now);
  }
  const owned = records.filter(pr => !pr.source || pr.source.ownerUserId === ownerUserId);
  const best = racePrBestByDistance(owned, now);
  const seenSources = new Set(previous?.observedSources ?? []);
  const seenPerformances = new Set(previous?.observedPerformances ?? []);
  const earned = new Set(previous?.earnedDistances ?? []);
  const notifications: RacePrNotification[] = [];
  const nextBest: RacePrLedger['best'] = {};
  for (const distanceKey of RACE_PR_DISTANCES) {
    const record = best[distanceKey];
    if (!record) continue;
    earned.add(distanceKey);
    nextBest[distanceKey] = { timeSeconds: record.timeSeconds, sourcePerformanceId: record.id };
    const source = `${distanceKey}:${racePrSourceIdentity(record)}`;
    const fingerprint = racePrPerformanceFingerprint(record);
    const before = previous?.best[distanceKey]?.timeSeconds;
    const newlyRecorded = Number.isFinite(record.recordedAt) && record.recordedAt! >= (previous?.initializedAt ?? now)
      && record.recordedAt! <= now;
    if (previous && newlyRecorded && !racePrSourceAliases(record).some(alias => seenSources.has(`${distanceKey}:${alias}`)) && !seenPerformances.has(fingerprint)
      && (before === undefined || record.timeSeconds < before)) {
      notifications.push({ eventKey: JSON.stringify([ownerUserId, distanceKey, racePrSourceIdentity(record)]),
        ownerUserId, athleteId: 'athlete_default', distanceKey, timeSeconds: record.timeSeconds,
        ...(before === undefined ? {} : { previousTimeSeconds: before }), sourcePerformanceId: record.id, date: record.date });
    }
  }
  // Remember even non-best/imported entries: later corrections and reimports
  // must not masquerade as a newly completed performance.
  for (const record of owned) {
    if (!racePrBestByDistance([record], now)[record.distanceKey as StandardDistance]) continue;
    for (const alias of racePrSourceAliases(record)) seenSources.add(`${record.distanceKey}:${alias}`);
    seenPerformances.add(racePrPerformanceFingerprint(record));
  }
  return { ledger: { version: 1, ownerUserId, athleteId: 'athlete_default', initializedAt: previous?.initializedAt ?? now,
    best: nextBest, earnedDistances: RACE_PR_DISTANCES.filter(key => earned.has(key)),
    observedSources: [...seenSources].sort(), observedPerformances: [...seenPerformances].sort() }, notifications };
}

export function decodeRacePrLedger(raw: string | null, ownerUserId: string): RacePrLedger | null {
  if (raw === null) return null;
  const value = JSON.parse(raw) as RacePrLedger;
  if (!value || value.version !== 1 || value.ownerUserId !== ownerUserId || value.athleteId !== 'athlete_default'
    || !Number.isFinite(value.initializedAt) || value.initializedAt <= 0 || !value.best || typeof value.best !== 'object'
    || !Array.isArray(value.earnedDistances) || value.earnedDistances.some(key => !RACE_PR_DISTANCES.includes(key))
    || !Array.isArray(value.observedSources) || value.observedSources.some(key => typeof key !== 'string')
    || !Array.isArray(value.observedPerformances) || value.observedPerformances.some(key => typeof key !== 'string')
    || Object.entries(value.best).some(([key, best]) => !RACE_PR_DISTANCES.includes(key as StandardDistance)
      || !best || !Number.isFinite(best.timeSeconds) || best.timeSeconds <= 0 || typeof best.sourcePerformanceId !== 'string')) {
    throw new Error('Saved PR achievement history could not be read. It has not been reset.');
  }
  return value;
}

/** Queue metadata is historical; never display a withdrawn/changed source as a current record. */
export function racePrNotificationIsCurrent(notification: RacePrNotification, records: readonly RacePR[], ownerUserId: string | null,
  athleteId: string, now = Date.now()): boolean {
  if (notification.ownerUserId !== ownerUserId || notification.athleteId !== athleteId || athleteId !== 'athlete_default') return false;
  const record = records.find(pr => pr.id === notification.sourcePerformanceId && (!pr.source || pr.source.ownerUserId === ownerUserId));
  const best = racePrBestByDistance(records, now)[notification.distanceKey];
  return !!record && !!best && record.timeSeconds === notification.timeSeconds && record.date === notification.date
    && record.distanceKey === notification.distanceKey && record.distanceMeters === STANDARD_DISTANCE_METERS[notification.distanceKey]
    && isValidRacePerformance(record, now) && best.timeSeconds === record.timeSeconds;
}
