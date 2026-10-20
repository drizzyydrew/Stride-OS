import { getActivityRemovalRevision, useActivityStore } from '../store/activityStore';
import { useWorkoutStore } from '../store/workoutStore';
import { activityFromWorkoutRecord } from '../utils/activityMigration';
import { findActivityBySupportedId, lookupActivityBySupportedId } from '../utils/activityResolution';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';

/** Explicit recovery of one exact saved run, never a date-based replacement or a new recording. */
export async function recoverSavedActivity(rawId: string | string[] | undefined): Promise<string | null> {
  const lease = captureOwnerLease();
  const removalRevision = getActivityRemovalRevision();
  const requireOwner = () => {
    if (!lease || !ownerLeaseIsCurrent(lease)) throw new Error('Sign in with the account that owns this recording, then retry.');
    if (getActivityRemovalRevision() !== removalRevision) throw new Error('Activity history changed during recovery. Retry if you still want to restore this saved recording.');
  };
  requireOwner();
  for (const store of [useActivityStore, useWorkoutStore]) {
    if (!await waitForPersistedStoreHydration(store)) {
      throw new Error('Saved history is still loading. Keep StrideOS installed, unlock your phone, and retry.');
    }
    requireOwner();
  }
  if (useActivityStore.getState().hydrationStatus !== 'ready') {
    throw new Error('Saved activity history could not be read safely. No history has been replaced.');
  }
  const requireUnambiguous = () => {
    const result = lookupActivityBySupportedId(useActivityStore.getState().activities, rawId);
    if (result.status === 'ambiguous') throw new Error('More than one saved activity matches this link. No activity has been replaced.');
    return result;
  };
  const existing = requireUnambiguous();
  if (existing.status === 'resolved') {
    // A previous attempt may have published the row before its disk write failed.
    await useActivityStore.getState().awaitPersistence(lease!);
    requireOwner();
    const confirmed = requireUnambiguous();
    if (confirmed.status !== 'resolved' || confirmed.activity.id !== existing.activity.id) {
      throw new Error('The saved activity changed before restoration could be confirmed. Please retry.');
    }
    return confirmed.activity.id;
  }
  const projections = useWorkoutStore.getState().history
    .filter(record => !record.ownerUserId || record.ownerUserId === lease!.ownerUserId)
    .map(record => activityFromWorkoutRecord(record, !record.workoutInstanceId));
  const saved = findActivityBySupportedId(projections, rawId);
  if (!saved) return null;
  requireOwner();
  const id = await useActivityStore.getState().addActivityAndPersist(saved, lease!, {
    onlyIfMissing: true,
    isCurrent: () => {
      requireUnambiguous();
      return ownerLeaseIsCurrent(lease) && getActivityRemovalRevision() === removalRevision;
    },
  });
  requireOwner();
  const confirmed = findActivityBySupportedId(useActivityStore.getState().activities, rawId);
  if (!confirmed || confirmed.id !== id) throw new Error('The activity could not be confirmed. Your saved run has not been cleared.');
  return id;
}
