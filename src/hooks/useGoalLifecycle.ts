import { useEffect } from 'react';
import { AppState } from 'react-native';
import { reconcileGoalLifecycle, useGoalLifecycleRuntime } from '../lib/goalLifecycle';
import { useAuthStore } from '../store/authStore';
import { useGoalArchiveStore } from '../store/goalArchiveStore';
import { useProfileStore } from '../store/profileStore';
import { useTrainingPlanStore } from '../store/trainingPlanStore';
import { captureOwnerLease } from '../lib/localDataOwner';

export function useGoalLifecycle() {
  const access = useAuthStore(state => state.canAccessLocalData);
  const accountId = useAuthStore(state => state.user?.id ?? state.offlineOwnerId);
  const athleteId = useProfileStore(state => state.activeAthleteId);
  const archives = useGoalArchiveStore(state => state.archives);
  const archiveOwner = useGoalArchiveStore(state => state.ownerUserId);
  const archiveStatus = useGoalArchiveStore(state => state.status);
  const syncStatus = useGoalArchiveStore(state => state.syncStatus);
  const status = useGoalLifecycleRuntime(state => state.status);
  const error = useGoalLifecycleRuntime(state => state.error);
  const mode = useTrainingPlanStore(state => state.trainingMode);
  const pendingId = useTrainingPlanStore(state => state.pendingArchiveId);
  const revision = useTrainingPlanStore(state => state.revision);
  useEffect(() => {
    if (!access || athleteId !== 'athlete_default') return;
    const run = () => {
      if (AppState.currentState === 'active' && captureOwnerLease()) void reconcileGoalLifecycle().catch(() => undefined);
    };
    run();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') run(); });
    // Also catches a local date rollover while the screen remains open, and retries
    // after a workout that crossed midnight finishes. No root/startup gate changes.
    const timer = setInterval(run, 30_000);
    return () => { foreground.remove(); clearInterval(timer); };
  }, [access, accountId, athleteId, revision]);
  const visible = access && archiveOwner === accountId && athleteId === 'athlete_default';
  return {
    archives: visible ? archives : EMPTY_ARCHIVES,
    pendingArchive: visible ? archives.find(archive => archive.id === pendingId) ?? null : null,
    status: !visible || archiveStatus === 'loading' ? 'loading' as const : archiveStatus === 'error' ? 'error' as const : status,
    error, mode, syncStatus, isDefaultAthlete: athleteId === 'athlete_default',
    retry: () => { void reconcileGoalLifecycle().catch(() => undefined); },
  };
}
const EMPTY_ARCHIVES: ReturnType<typeof useGoalArchiveStore.getState>['archives'] = [];
