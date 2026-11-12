import type { Activity, ActivityRaceResult } from '../types/activity';
import type { RaceActivityLink, RaceEventSnapshot } from '../types/raceLink';
import type { GoalArchive } from '../types/goalArchive';
import { ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';
import { useActivityStore } from '../store/activityStore';
import { useGoalArchiveStore } from '../store/goalArchiveStore';
import { useProfileStore } from '../store/profileStore';
import { useTrainingPlanStore } from '../store/trainingPlanStore';
import { getAppStorage } from '../store/persistStorage';
import { isValidRaceActivityLink, isValidRaceEventSnapshot, raceEventSnapshot, raceLinkDateMatchesActivity,
  recordedRaceElapsedSeconds } from '../utils/raceLink';

export type SaveRaceLinkInput = {
  activityId: string;
  event: RaceEventSnapshot;
  outcome: RaceActivityLink['outcome'];
  /** Present only for an explicitly entered finish time; omit to use recorded wall time. */
  elapsedTimeSeconds?: number;
  confirmDateMismatch?: boolean;
  replaceExisting?: boolean;
  archiveId?: string;
};
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = queue.then(operation); queue = task.catch(() => undefined); return task;
}
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function ready(lease: OwnerLease, profileCreatedAt?: number) {
  const activities = useActivityStore.getState();
  const archives = useGoalArchiveStore.getState();
  const profiles = useProfileStore.getState();
  const profile = profiles.getActiveProfile();
  if (!ownerLeaseIsCurrent(lease) || !useProfileStore.persist.hasHydrated() || !useTrainingPlanStore.persist.hasHydrated()
    || !useActivityStore.persist.hasHydrated() || activities.hydrationStatus !== 'ready'
    || profiles.activeAthleteId !== 'athlete_default' || !profile
    || (profileCreatedAt !== undefined && profile.createdAt !== profileCreatedAt)
    || archives.status !== 'ready' || archives.ownerUserId !== lease.ownerUserId) {
    throw new Error('Reopen this race link after the original account and athlete history finish loading.');
  }
  return { activities: activities.activities, archives: archives.archives, profileCreatedAt: profile.createdAt };
}
function findActivity(rows: readonly Activity[], id: string): Activity {
  const found = rows.filter(row => row.id === id);
  if (found.length !== 1) throw new Error('This saved run is unavailable or ambiguous. No new activity was created.');
  return found[0];
}
function nextRevision(activity: Activity, now: number): number {
  return Math.max(now, (Number.isFinite(activity.raceLinkUpdatedAt) ? activity.raceLinkUpdatedAt! : activity.raceLink?.linkedAt ?? 0) + 1);
}
async function verifyActivityWrites(expected: ReadonlyMap<string, Pick<Activity, 'raceLink' | 'raceResult' | 'raceLinkUpdatedAt' | 'status' | 'completionClassification' | 'createdAt'>>,
  lease: OwnerLease, createdAt: number) {
  await useActivityStore.getState().awaitPersistence(lease);
  ready(lease, createdAt);
  const storage = getAppStorage();
  const raw = await storage.getItemOnce('activity-store');
  const current = ready(lease, createdAt);
  const saved: Activity[] | undefined = raw == null ? undefined : JSON.parse(raw)?.state?.activities;
  if (!Array.isArray(saved)) throw new Error('The race link could not be read back. Keep this page open and retry.');
  for (const [id, wanted] of expected) {
    for (const rows of [current.activities, saved]) {
      const row = findActivity(rows, id);
      if (!same(row.raceLink, wanted.raceLink) || !same(row.raceResult, wanted.raceResult)
        || row.raceLinkUpdatedAt !== wanted.raceLinkUpdatedAt || row.status !== wanted.status
        || row.completionClassification !== wanted.completionClassification || row.createdAt !== wanted.createdAt) throw new Error('The saved run changed while linking. Reopen it before retrying.');
    }
  }
}
function pointer(id: string, now: number): GoalArchive['result'] {
  return { status: 'unrecorded', source: 'activity_link', linkedActivityId: id, updatedAt: now };
}

/** Existing Activity is the only finish/time authority. Archive writes follow its
 * durable readback; retries repair a partial two-store save without duplicates. */
export function saveLink(input: SaveRaceLinkInput, lease: OwnerLease): Promise<Activity> {
  const request = copy(input), owner = { ...lease };
  return enqueue(async () => {
    const state = ready(owner);
    const createdAt = state.profileCreatedAt;
    const current = () => ready(owner, createdAt);
    const activity = findActivity(state.activities, request.activityId);
    if (activity.activityType !== 'running' || activity.status === 'skipped' || !Number.isFinite(activity.startTime) || activity.startTime > Date.now() + 5_000 || !isValidRaceEventSnapshot(request.event)
      || !['unrecorded', 'finished', 'did_not_finish'].includes(request.outcome)) throw new Error('Choose a saved running activity and a valid race outcome.');
    if (activity.raceLink && !isValidRaceActivityLink(activity.raceLink, owner.ownerUserId)) throw new Error('This run’s race link belongs to another owner or cannot be read.');
    const requestedArchive = request.archiveId ? state.archives.find(row => row.id === request.archiveId) : undefined;
    if (request.archiveId && (!requestedArchive || requestedArchive.ownerUserId !== owner.ownerUserId
      || requestedArchive.athleteId !== 'athlete_default' || !requestedArchive.race
      || !same(raceEventSnapshot(requestedArchive.race), request.event))) throw new Error('The archived race changed or is unavailable. Reopen it before linking.');
    const eventKnown = [...useTrainingPlanStore.getState().races,
      ...state.archives.filter(row => row.ownerUserId === owner.ownerUserId && row.athleteId === 'athlete_default').flatMap(row => row.race ? [row.race] : [])]
      .some(race => { try { return same(raceEventSnapshot(race), request.event); } catch { return false; } });
    if (!eventKnown && !same(activity.raceLink?.event, request.event)) throw new Error('This race event is no longer available. Reopen the event list.');
    if (!raceLinkDateMatchesActivity(request.event, activity) && !request.confirmDateMismatch) {
      throw new Error('The run date and planned race date differ. Confirm that this run belongs to this race.');
    }
    const linked = state.activities.filter(row => row.id !== activity.id && isValidRaceActivityLink(row.raceLink, owner.ownerUserId)
      && row.raceLink.event.id === request.event.id);
    const archives = state.archives.filter(row => row.ownerUserId === owner.ownerUserId && row.athleteId === 'athlete_default'
      && row.race?.id === request.event.id);
    const differentLink = activity.raceLink && !same(activity.raceLink.event, request.event);
    const standaloneResult = activity.raceResult && !activity.raceLink;
    const manualArchive = archives.some(row => row.result.source === 'user' && (row.result.status !== 'unrecorded' || row.result.timeSeconds !== undefined));
    const conflictingPointer = archives.some(row => row.result.source === 'activity_link' && row.result.linkedActivityId !== activity.id);
    if (!request.replaceExisting && (differentLink || standaloneResult || linked.length > 0 || manualArchive || conflictingPointer)) {
      throw new Error('Confirm replacing the existing race link or saved race result before continuing.');
    }
    const correctingOwnDnf = isValidRaceActivityLink(activity.raceLink, owner.ownerUserId)
      && same(activity.raceLink.event, request.event) && activity.raceLink.outcome === 'did_not_finish'
      && activity.completionClassification === 'stopped_early';
    const status = request.outcome === 'did_not_finish' ? 'partial' : request.outcome === 'finished' && correctingOwnDnf ? 'completed' : activity.status;
    const classification = request.outcome === 'did_not_finish' ? 'stopped_early'
      : request.outcome === 'finished' && correctingOwnDnf ? 'modified' : activity.completionClassification;
    let result: ActivityRaceResult | undefined;
    if (request.outcome === 'finished') {
      if (status !== 'completed' || ['partial', 'stopped_early', 'skipped'].includes(classification ?? '')) {
        throw new Error('This run is marked partial or stopped early. Correct its completion status before recording a finished race.');
      }
      const entered = request.elapsedTimeSeconds;
      const seconds = entered === undefined ? recordedRaceElapsedSeconds(activity) : entered;
      if (seconds !== null && seconds !== undefined) {
        if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Enter a positive full elapsed finish time.');
        result = { kind: 'race', distanceKey: request.event.distance, distanceMeters: request.event.distanceMeters,
          elapsedTimeSeconds: seconds, timingSource: entered === undefined ? 'recorded_elapsed' : 'user_entered',
          recordedAt: activity.raceResult?.recordedAt ?? Date.now() };
      }
    } else if (request.elapsedTimeSeconds !== undefined) throw new Error('Only a finished race can have a finish time.');
    const now = Date.now();
    const link: RaceActivityLink = { ownerUserId: owner.ownerUserId, athleteId: 'athlete_default', event: request.event,
      outcome: request.outcome, linkedAt: same(activity.raceLink?.event, request.event) ? activity.raceLink!.linkedAt : now };
    const expected = new Map<string, Pick<Activity, 'raceLink' | 'raceResult' | 'raceLinkUpdatedAt' | 'status' | 'completionClassification' | 'createdAt'>>();
    for (const row of linked) expected.set(row.id, { raceLink: undefined, raceResult: undefined, raceLinkUpdatedAt: nextRevision(row, now), status: row.status, completionClassification: row.completionClassification, createdAt: row.createdAt });
    const unchanged = same(activity.raceLink, link) && same(activity.raceResult, result);
    expected.set(activity.id, { raceLink: link, raceResult: result,
      raceLinkUpdatedAt: unchanged && activity.raceLinkUpdatedAt != null && activity.status === status && activity.completionClassification === classification
        ? activity.raceLinkUpdatedAt : nextRevision(activity, now), status, completionClassification: classification, createdAt: activity.createdAt });
    const write = (id: string) => {
      const patch = expected.get(id)!;
      const before = findActivity(current().activities, id);
      if (before.createdAt !== patch.createdAt) throw new Error('The saved run was replaced. Reopen it before linking.');
      const original = state.activities.find(row => row.id === id)!;
      if (!same(before.raceLink, original.raceLink) || before.raceLinkUpdatedAt !== original.raceLinkUpdatedAt) {
        throw new Error('The race association changed while saving. Reopen the run before retrying.');
      }
      useActivityStore.getState().updateActivity(id, patch);
    };
    // Preserve the old claimant until the replacement itself is durable. A
    // temporary two-claim conflict is withheld by selectors, never double-paid.
    write(activity.id);
    await verifyActivityWrites(new Map([[activity.id, expected.get(activity.id)!]]), owner, createdAt);
    for (const row of linked) write(row.id);
    if (linked.length) await verifyActivityWrites(expected, owner, createdAt);
    for (const archive of archives) {
      const latest = current().archives.find(row => row.id === archive.id);
      if (latest && !same(latest.result, archive.result)
        && !(latest.result.source === 'activity_link' && latest.result.linkedActivityId === activity.id)) {
        throw new Error('The saved race result changed while linking. Reopen it before replacing it.');
      }
      if (!latest || (latest.result.source === 'user' && (latest.result.status !== 'unrecorded' || latest.result.timeSeconds !== undefined) && !request.replaceExisting)) throw new Error('The saved race result changed. Reopen it before replacing it.');
      if (latest.result.source !== 'activity_link' || latest.result.linkedActivityId !== activity.id) {
        await useGoalArchiveStore.getState().saveResult(archive.id, pointer(activity.id,
          Math.max(now, (latest.result.updatedAt ?? 0) + 1)), owner);
        current();
      }
    }
    const saved = findActivity(current().activities, activity.id);
    // saveResult itself confirms disk readback; inspect every required pointer too.
    for (const archive of archives) {
      const value = current().archives.find(row => row.id === archive.id)?.result;
      if (value?.source !== 'activity_link' || value.linkedActivityId !== activity.id || value.timeSeconds !== undefined) {
        throw new Error('The run was saved, but its race link was not confirmed. Keep this page open and retry.');
      }
    }
    return saved;
  });
}

/** Missing/deleted activities may still have archive pointers. Clear those
 * pointers without recreating history or restoring an earlier copied finish. */
export function unlinkLink(activityId: string, lease: OwnerLease): Promise<void> {
  const owner = { ...lease };
  return enqueue(async () => {
    const state = ready(owner), createdAt = state.profileCreatedAt;
    const rows = state.activities.filter(row => row.id === activityId);
    if (rows.length > 1) throw new Error('This activity is ambiguous. No race link was changed.');
    const activity = rows[0];
    if (activity?.raceLink && !isValidRaceActivityLink(activity.raceLink, owner.ownerUserId)) throw new Error('This race link belongs to another account or cannot be read.');
    const now = Date.now();
    if (activity?.raceLink) {
      const expected = new Map([[activity.id, { raceLink: undefined, raceResult: undefined, raceLinkUpdatedAt: nextRevision(activity, now), status: activity.status, completionClassification: activity.completionClassification, createdAt: activity.createdAt }]]);
      ready(owner, createdAt);
      useActivityStore.getState().updateActivity(activity.id, expected.get(activity.id)!);
      await verifyActivityWrites(expected, owner, createdAt);
    }
    const archives = ready(owner, createdAt).archives.filter(row => row.ownerUserId === owner.ownerUserId && row.athleteId === 'athlete_default'
      && (row.result.source === 'activity_link' && row.result.linkedActivityId === activityId
        || activity?.raceLink && row.race?.id === activity.raceLink.event.id && row.result.source !== 'user'));
    for (const archive of archives) {
      const latest = ready(owner, createdAt).archives.find(row => row.id === archive.id);
      if (!latest || !same(latest.result, archive.result)) throw new Error('The saved race result changed while unlinking. Reopen it before retrying.');
      await useGoalArchiveStore.getState().saveResult(archive.id, { status: 'unrecorded', source: 'user',
        updatedAt: Math.max(now, (archive.result.updatedAt ?? 0) + 1) }, owner);
      ready(owner, createdAt);
    }
  });
}
