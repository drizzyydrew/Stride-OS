import { useActiveRunStore } from '../store/activeRunStore';
import { useAthleteStore } from '../store/athleteStore';
import { useWorkoutStore, type RunCompletionResult } from '../store/workoutStore';
import { useActivityStore } from '../store/activityStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { matchingWatchRecording, runCompletionKey } from '../utils/runCompletionIdentity';
import { captureTrainingRunEnd, validRunEndSnapshot } from '../utils/trainingRunEndSnapshot';
import type { LiveRunEntry } from './runCompletionJournal';
import type { Activity, DistanceSource } from '../types/activity';

export type RunEndCommand = {
  workoutInstanceId: string;
  watchRecording?: Activity['watchRecording'];
  endedAt: number;
  elapsedSeconds?: number;
  distanceMiles?: number;
  distanceSource?: DistanceSource;
  snapshot?: LiveRunEntry;
};

/** Shared by background/watch callers; no mounted screen or native End side effects. */
export async function completeRunCommand(command: RunEndCommand): Promise<RunCompletionResult> {
  const lease = captureOwnerLease();
  if (!lease) throw new Error('Confirm the original recording owner before completion');
  command = JSON.parse(JSON.stringify(command)) as RunEndCommand;
  const initial = useActiveRunStore.getState();
  const captured = command.snapshot ?? (useActiveRunStore.persist.hasHydrated() && initial.isActive
    && initial.workoutInstanceId === command.workoutInstanceId && initial.startTime != null && initial.environment !== 'indoor'
    ? { ...captureTrainingRunEnd(initial, command), ownerUserId: lease.ownerUserId } : undefined);
  if (captured && initial.workoutInstanceId === command.workoutInstanceId) initial.requestCompletion?.(command.endedAt);
  await Promise.all([useActiveRunStore, useAthleteStore, useWorkoutStore, useActivityStore].map(store => {
    if (store.persist.hasHydrated()) return Promise.resolve();
    return new Promise<void>(resolve => {
      const unsubscribe = store.persist.onFinishHydration(() => { unsubscribe(); resolve(); });
      if (store.persist.hasHydrated()) { unsubscribe(); resolve(); }
    });
  }));
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed before run completion');
  if (!command.workoutInstanceId || !Number.isFinite(command.endedAt)) throw new Error('End requires a recording instance and timestamp');
  const history = useWorkoutStore.getState().history;
  const completed = history.find(record => record.workoutInstanceId === command.workoutInstanceId && record.ownerUserId === lease.ownerUserId);
  const athlete = useAthleteStore.getState();
  if (completed) {
    // In-memory history may precede a failed disk flush. Recommit the saved
    // snapshot before authorizing cleanup, even when a newer run is active.
    return useWorkoutStore.getState().commitRunEnd({
      ...completed, completionKey: runCompletionKey(command.workoutInstanceId),
      watchRecording: matchingWatchRecording(command.watchRecording, command.workoutInstanceId, completed.actualStartTime)
        ?? completed.watchRecording,
      durationMinutes: completed.actualDurationMinutes ?? completed.durationMinutes,
      distanceMiles: completed.actualDistanceMiles ?? completed.estimatedDistanceMiles,
    }, completed.week, completed.fatigueBefore, completed.recoveryBefore, athlete.setFatigueScore, athlete.setRecentEasyLoad, true);
  }
  const discarded = await useWorkoutStore.getState().getRunDiscardResult(command.workoutInstanceId, lease);
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed before run completion');
  if (discarded) return discarded;
  const current = useActiveRunStore.getState();
  if (!captured && (!current.isActive || current.workoutInstanceId !== command.workoutInstanceId || current.startTime == null)) {
    throw new Error('End does not match the active recording');
  }
  if (current.workoutInstanceId === command.workoutInstanceId && current.environment === 'indoor') throw new Error('Indoor completion requires TreadmillCompletionSheet confirmation');
  const entry = captured ?? captureTrainingRunEnd(current, command);
  if (!validRunEndSnapshot(entry, command)
    || captured && captured.ownerUserId !== lease.ownerUserId
    || !captured && entry.actualStartTime !== current.startTime) throw new Error('End snapshot does not match this recording owner');
  if (current.workoutInstanceId === command.workoutInstanceId) current.requestCompletion?.(command.endedAt);
  return useWorkoutStore.getState().commitRunEnd(entry, athlete.currentWeek, athlete.fatigueScore, athlete.recoveryScore,
    athlete.setFatigueScore, athlete.setRecentEasyLoad, true);
}
