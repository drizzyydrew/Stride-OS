import { getHealthKitWorkoutByUuid, readHealthKitWorkoutHistory, requestPermissions } from './healthKit';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';
import { getActivityRemovalRevision, useActivityStore } from '../store/activityStore';
import { buildHealthKitActivityDraft, type HealthKitWorkoutCandidate } from '../utils/healthKitImport';
import { sameRecording } from '../utils/runCompletionIdentity';
import type { Activity, ActivityDraft } from '../types/activity';

export type HealthRecoveryPhase = 'details' | 'route' | 'metrics' | 'saving' | 'opening';

function requireUnambiguousSelection(draft: ActivityDraft) {
  const claims = (record: ActivityDraft) => [record.workoutInstanceId, record.healthKit?.workoutInstanceId]
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  const selectedClaims = claims(draft);
  const matches = useActivityStore.getState().activities.filter(activity => {
    const exactHealth = activity.healthKit?.workoutUuid === draft.healthKit?.workoutUuid
      && activity.healthKit?.sourceBundleIdentifier === draft.healthKit?.sourceBundleIdentifier;
    const existingClaims = claims(activity);
    const matchesInstance = existingClaims.some(id => selectedClaims.includes(id));
    const matchesRecording = exactHealth || matchesInstance || sameRecording(activity, draft as Activity);
    if (matchesRecording && new Set([...existingClaims, ...selectedClaims]).size > 1) {
      throw new Error('This Health workout has conflicting recording identities in saved history. No activity was replaced or duplicated.');
    }
    return matchesRecording;
  });
  if (matches.length > 1) throw new Error('More than one saved activity claims this Health workout. No activity was replaced or duplicated.');
}

/** User selection identifies the Health record, never the date or the unresolved old link. */
export function createHealthWorkoutRecovery(isCurrent: () => boolean = () => true, targetActivityId?: string) {
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
    async restoreSelected(uuid: string, onPhase?: (phase: HealthRecoveryPhase) => void) {
      requireCurrent();
      const selection = listed.get(uuid);
      if (!selection) throw new Error('Choose a workout from the current Apple Health list.');
      const progress = (phase: HealthRecoveryPhase) => { requireCurrent(); onPhase?.(phase); };
      progress('details');
      const candidate = await getHealthKitWorkoutByUuid(uuid, progress, { includeRoutes: !targetActivityId, distanceOnly: Boolean(targetActivityId) });
      requireCurrent();
      if (candidate.uuid !== uuid || candidate.sourceBundleIdentifier !== selection.sourceBundleIdentifier) {
        throw new Error('Apple Health returned a different workout. Nothing has been replaced.');
      }
      const draft = buildHealthKitActivityDraft({ candidate });
      const requireSelectionCurrent = () => { requireCurrent(); requireUnambiguousSelection(draft); return true; };
      requireSelectionCurrent();
      progress('saving');
      if (targetActivityId) {
        if (!candidate.healthKitDistance || !draft.healthKit) throw new Error('Apple Health did not return distance evidence for this workout. Your activity was kept.');
        await useActivityStore.getState().refreshHealthDistanceAndPersist(targetActivityId, candidate.healthKitDistance, lease!, {
          isCurrent: requireSelectionCurrent, workoutInstanceId: candidate.workoutInstanceId,
          link: { activityType: candidate.activityType, metadata: draft.healthKit },
        });
        requireCurrent();
        progress('opening');
        return targetActivityId;
      }
      const id = await useActivityStore.getState().addActivityAndPersist(draft, lease!, {
        onlyIfMissing: true,
        isCurrent: requireSelectionCurrent,
      });
      requireCurrent();
      const saved = useActivityStore.getState().activities.find(activity => activity.id === id);
      if (!saved || !sameRecording(saved, draft as typeof saved)) throw new Error('The saved workout could not be confirmed. Retry recovery; your Health record has not been changed.');
      progress('opening');
      return id;
    },
  };
}
