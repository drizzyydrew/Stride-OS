import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';
import { useActivityStore } from '../store/activityStore';
import { useAthleteStore } from '../store/athleteStore';
import { useCustomWorkoutStore } from '../store/customWorkoutStore';
import { useGoalArchiveStore } from '../store/goalArchiveStore';
import { useProfileStore } from '../store/profileStore';
import { runCalibration } from '../utils/calibrationEngine';
import { todayDateOnly } from '../utils/dateOnly';
import { calibrationHistorySignals, isValidRacePerformance, reconcileRacePerformances } from '../utils/racePerformance';
import type { AthleteProfile } from '../types/athlete';
import type { GoalArchiveState } from '../store/goalArchiveStore';
import { reconcileRacePrAwards } from './racePrAwardLedger';

let queue: Promise<unknown> = Promise.resolve();
let lastSuccessfulSignature: string | null = null;

function archiveSourceMissingWithoutConfirmation(profile: AthleteProfile, archiveState: GoalArchiveState, lease: OwnerLease): boolean {
  if (archiveState.syncStatus === 'synced') return false;
  const available = new Set(archiveState.archives.map(archive => archive.id));
  return profile.racePRs.some(pr => pr.source?.kind === 'goal_archive'
    && pr.source.ownerUserId === lease.ownerUserId && !available.has(pr.source.archiveId));
}

function currentInputs(lease: OwnerLease) {
  if (!ownerLeaseIsCurrent(lease)
    || !useProfileStore.persist.hasHydrated() || !useAthleteStore.persist.hasHydrated()
    || !useCustomWorkoutStore.persist.hasHydrated()) return null;
  const state = useProfileStore.getState();
  const profile = state.profiles[state.activeAthleteId];
  const activityState = useActivityStore.getState();
  // Normalized activities/custom logs are not yet separated by athlete.
  if (state.activeAthleteId !== 'athlete_default' || !profile || activityState.hydrationStatus !== 'ready') return null;
  return { state, profile, activityState };
}

/**
 * Recompute derived performance only after this owner's complete local inputs
 * have hydrated. Opens existing owner-scoped archive storage when direct entry
 * hasn't loaded it yet; never creates archives, imports/deletes raw training
 * records or changes HR measurements. Serial execution reads the latest stores.
 */
export function reconcileRaceCalibration(now = Date.now()): Promise<'deferred' | 'unchanged' | 'updated'> {
  const task = queue.then(async () => {
    const lease = captureOwnerLease();
    const initial = lease ? currentInputs(lease) : null;
    if (!lease || !initial) return 'deferred' as const;
    let archiveState = useGoalArchiveStore.getState();
    if (archiveState.status !== 'ready' || archiveState.ownerUserId !== lease.ownerUserId
      || archiveSourceMissingWithoutConfirmation(initial.profile, archiveState, lease)) {
      try {
        await archiveState.load(lease);
      } catch (error) {
        if (!ownerLeaseIsCurrent(lease)) return 'deferred' as const;
        // Preserve the current profile/derived PRs; the bridge retries this
        // failed source read with its existing bounded persistence backoff.
        throw error;
      }
    }
    // Loading may await storage/cloud reads. Recheck identity and hydration and
    // use the current profile/history so concurrent edits cannot be overwritten.
    const current = currentInputs(lease);
    archiveState = useGoalArchiveStore.getState();
    if (!current || archiveState.status !== 'ready' || archiveState.ownerUserId !== lease.ownerUserId) return 'deferred' as const;
    const { state, profile, activityState } = current;
    if (archiveSourceMissingWithoutConfirmation(profile, archiveState, lease)) {
      // A missing local source without a confirmed cloud collection is not
      // evidence that its race result was deleted. Preserve the profile until
      // the source collection is confirmed or the linked archive is present.
      // Reject into the existing bounded bridge retry, including for a direct
      // Profile entry with no Today lifecycle hook to refresh this collection.
      throw new Error('Race calibration is waiting for its saved archive source. Existing results have been preserved.');
    }
    const athlete = useAthleteStore.getState();
    const logs = useCustomWorkoutStore.getState().logs;
    const racePRs = reconcileRacePerformances(profile.racePRs, archiveState.archives, logs,
      lease.ownerUserId, state.activeAthleteId, now, activityState.activities);
    const { calibration: _calibration, vdot: _vdot, updatedAt: _updatedAt, ...profileInputs } = profile;
    const history = calibrationHistorySignals(activityState.activities, logs, now);
    const input = {
      weeklyMileage: athlete.weeklyMileage,
      currentPhase: athlete.trainingPhase,
      currentFatigueScore: athlete.fatigueScore,
      currentRecoveryScore: athlete.recoveryScore,
      ...history,
    };
    const signature = JSON.stringify({ owner: lease.ownerUserId, generation: lease.generation,
      day: todayDateOnly(new Date(now)), profile: { ...profileInputs, racePRs }, input });
    if (signature === lastSuccessfulSignature) {
      await reconcileRacePrAwards(lease, racePRs, Date.now());
      return 'unchanged' as const;
    }
    const output = runCalibration({ ...input, profile: { ...profile, racePRs: racePRs.filter(pr => isValidRacePerformance(pr, now)) } });
    if (!ownerLeaseIsCurrent(lease) || useProfileStore.getState().activeAthleteId !== state.activeAthleteId) return 'deferred' as const;
    // One patch keeps the profile's source-linked history, VDOT and predictions
    // coherent. Its original user-entered HRmax/resting-HR fields are untouched.
    await useProfileStore.getState().updateProfile(state.activeAthleteId, { racePRs, vdot: output.vdot, calibration: output });
    if (!ownerLeaseIsCurrent(lease)) return 'deferred' as const;
    lastSuccessfulSignature = signature;
    await reconcileRacePrAwards(lease, racePRs, Date.now());
    return 'updated' as const;
  });
  queue = task.catch(() => undefined);
  return task;
}
