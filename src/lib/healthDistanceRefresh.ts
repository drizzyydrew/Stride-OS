import { getHealthKitWorkoutByUuid, requestPermissions } from './healthKit';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { getActivityRemovalRevision, useActivityStore } from '../store/activityStore';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';

/** Explicit refresh of one linked workout, not another import or completion. */
export async function refreshActivityHealthDistance(id: string, isCurrent: () => boolean) {
  const lease = captureOwnerLease();
  const revision = getActivityRemovalRevision();
  const requireCurrent = () => {
    if (!lease || !ownerLeaseIsCurrent(lease) || !isCurrent() || revision !== getActivityRemovalRevision()) {
      throw new Error('Health refresh is not confirmed. Reopen the activity and retry.');
    }
  };
  requireCurrent();
  if (!await waitForPersistedStoreHydration(useActivityStore) || useActivityStore.getState().hydrationStatus !== 'ready') {
    throw new Error('Saved history is not yet readable. Unlock your phone and retry.');
  }
  requireCurrent();
  const target = useActivityStore.getState().activities.find(row => row.id === id);
  const health = target?.healthKit;
  if (!health) throw new Error('This activity is not linked to an Apple Health workout.');
  if (!await requestPermissions()) throw new Error('Apple Health authorization did not complete. Unlock your phone and retry.');
  requireCurrent();
  const candidate = await getHealthKitWorkoutByUuid(health.workoutUuid, undefined, { includeRoutes: false, distanceOnly: true });
  requireCurrent();
  if (candidate.sourceBundleIdentifier !== health.sourceBundleIdentifier || !candidate.healthKitDistance) {
    throw new Error('Apple Health did not return distance evidence for this exact workout. Existing data was kept.');
  }
  await useActivityStore.getState().refreshHealthDistanceAndPersist(id, candidate.healthKitDistance, lease!, {
    isCurrent: () => { requireCurrent(); return true; }, workoutInstanceId: candidate.workoutInstanceId,
  });
  requireCurrent();
}
