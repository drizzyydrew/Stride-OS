import { readHealthKitWorkoutHistory, requestPermissions } from './healthKit';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';
import { getActivityRemovalRevision, useActivityStore } from '../store/activityStore';
import { buildHealthKitActivityDraft, isDuplicateHealthKitWorkout } from '../utils/healthKitImport';

const RESTORE_DAYS = 3650;
const RESTORE_LIMIT = 2000;
const MIN_WORKOUT_SECONDS = 60;

/** Explicit Health restore only; never guess identity or overwrite existing activity edits. */
export async function restoreHealthActivityHistory(onProgress?: (done: number, total: number) => void) {
  const lease = captureOwnerLease();
  const removalRevision = getActivityRemovalRevision();
  const requireCurrent = () => {
    if (!lease || !ownerLeaseIsCurrent(lease)) throw new Error('Account changed or local history is locked. Sign in with its original account and retry.');
    if (getActivityRemovalRevision() !== removalRevision) throw new Error('Activity history changed during restore. Retry if you still want to restore from Apple Health.');
  };
  requireCurrent();
  if (!await waitForPersistedStoreHydration(useActivityStore)
    || useActivityStore.getState().hydrationStatus !== 'ready') {
    throw new Error('Saved activity history is not yet readable. Unlock your iPhone and retry.');
  }
  requireCurrent();
  // Completion of the authorization request does not reveal private read grants.
  if (!await requestPermissions()) throw new Error('Apple Health authorization did not complete. Unlock your iPhone and retry.');
  requireCurrent();
  const result = await readHealthKitWorkoutHistory({
    days: RESTORE_DAYS,
    limit: RESTORE_LIMIT,
    includeRoutes: true,
    onProgress,
  });
  requireCurrent();
  let restored = 0;
  let withRoutes = 0;
  let alreadyPresent = 0;
  let tooShort = 0;
  for (const candidate of result.candidates) {
    requireCurrent();
    if (candidate.durationSeconds < MIN_WORKOUT_SECONDS) { tooShort += 1; continue; }
    const exists = isDuplicateHealthKitWorkout(candidate, useActivityStore.getState().activities);
    if (exists) alreadyPresent += 1;
    // Existing in-memory rows also need a durable readback after a failed prior attempt.
    await useActivityStore.getState().addActivityAndPersist(buildHealthKitActivityDraft({ candidate }), lease!, {
      onlyIfMissing: true,
      isCurrent: () => { requireCurrent(); return true; },
    });
    requireCurrent();
    if (!exists) {
      restored += 1;
      if (candidate.routeCoordinates?.length) withRoutes += 1;
    }
  }
  return { restored, withRoutes, alreadyPresent, tooShort, sampleCount: result.sampleCount, skippedCount: result.skippedCount };
}
