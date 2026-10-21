import { getHealthKitWorkoutByUuid, readHealthKitWorkoutHistory, requestPermissions } from './healthKit';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';
import { getActivityRemovalRevision, useActivityStore } from '../store/activityStore';
import { buildHealthKitActivityDraft, type HealthKitWorkoutCandidate } from '../utils/healthKitImport';
import { sameRecording } from '../utils/runCompletionIdentity';

/** User selection identifies the Health record, never the date or the unresolved old link. */
export function createHealthWorkoutRecovery(isCurrent: () => boolean = () => true) {
  const lease = captureOwnerLease();
  const revision = getActivityRemovalRevision();
  const listed = new Map<string, HealthKitWorkoutCandidate>();
  const requireCurrent = () => {
    if (!isCurrent() || !lease || !ownerLeaseIsCurrent(lease)) throw new Error('Recovery was closed or the account changed. Open it again to retry.');
    if (getActivityRemovalRevision() !== revision) throw new Error('Activity history changed. Open recovery again before restoring a workout.');
  };
  return {
    async listRecent(days = 30) {
      requireCurrent();
      listed.clear();
      if (!await waitForPersistedStoreHydration(useActivityStore)
        || useActivityStore.getState().hydrationStatus !== 'ready') throw new Error('Saved history is not yet readable. Unlock your phone and retry.');
      requireCurrent();
      if (!await requestPermissions()) throw new Error('Apple Health authorization did not complete. Unlock your phone and retry.');
      requireCurrent();
      const result = await readHealthKitWorkoutHistory({ days, limit: 250, metadataOnly: true });
      requireCurrent();
      const next = new Map<string, HealthKitWorkoutCandidate>();
      for (const candidate of result.candidates) {
        if (candidate.durationSeconds < 60) continue;
        if (next.has(candidate.uuid)) throw new Error('Apple Health returned an ambiguous workout list. Retry without selecting a workout.');
        next.set(candidate.uuid, candidate);
      }
      for (const [uuid, candidate] of next) listed.set(uuid, candidate);
      return [...listed.values()];
    },
    async restoreSelected(uuid: string) {
      requireCurrent();
      const selection = listed.get(uuid);
      if (!selection) throw new Error('Choose a workout from the current Apple Health list.');
      const candidate = await getHealthKitWorkoutByUuid(uuid);
      requireCurrent();
      if (candidate.uuid !== uuid || candidate.sourceBundleIdentifier !== selection.sourceBundleIdentifier) {
        throw new Error('Apple Health returned a different workout. Nothing has been replaced.');
      }
      const draft = buildHealthKitActivityDraft({ candidate });
      const id = await useActivityStore.getState().addActivityAndPersist(draft, lease!, {
        onlyIfMissing: true,
        isCurrent: () => { requireCurrent(); return true; },
      });
      requireCurrent();
      const saved = useActivityStore.getState().activities.find(activity => activity.id === id);
      if (!saved || !sameRecording(saved, draft as typeof saved)) throw new Error('The saved workout could not be confirmed. Retry recovery; your Health record has not been changed.');
      return id;
    },
  };
}
