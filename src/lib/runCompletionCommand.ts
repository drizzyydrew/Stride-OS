import { activeRunElapsedSeconds, useActiveRunStore } from '../store/activeRunStore';
import { useAthleteStore } from '../store/athleteStore';
import { useWorkoutStore, type RunCompletionResult } from '../store/workoutStore';
import { useActivityStore } from '../store/activityStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { matchingWatchRecording, runCompletionKey } from '../utils/runCompletionIdentity';
import { capturedRunTelemetryMetrics } from '../utils/capturedRunTelemetryMetrics';
import type { Activity, DistanceSource } from '../types/activity';

export type RunEndCommand = {
  workoutInstanceId: string;
  watchRecording?: Activity['watchRecording'];
  endedAt: number;
  elapsedSeconds?: number;
  distanceMiles?: number;
  distanceSource?: DistanceSource;
};

/** Shared by background/watch callers; no mounted screen or native End side effects. */
export async function completeRunCommand(command: RunEndCommand): Promise<RunCompletionResult> {
  const lease = captureOwnerLease();
  if (!lease) throw new Error('Confirm the original recording owner before completion');
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
  if (!current.isActive || current.workoutInstanceId !== command.workoutInstanceId || current.startTime == null) {
    throw new Error('End does not match the active recording');
  }
  if (current.environment === 'indoor') throw new Error('Indoor completion requires TreadmillCompletionSheet confirmation');
  const startedAt = current.startTime;
  const state = current;
  if (command.endedAt < startedAt || command.endedAt > Date.now() + 5_000) throw new Error('End timestamp is outside this recording');
  const elapsed = command.elapsedSeconds ?? activeRunElapsedSeconds(state, command.endedAt);
  const distance = command.distanceMiles ?? state.distanceMiles;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > (command.endedAt - startedAt) / 1000 + 1
    || !Number.isFinite(distance) || distance < 0) throw new Error('End contains invalid measured totals');
  const entry = {
    completionKey: runCompletionKey(command.workoutInstanceId), workoutInstanceId: command.workoutInstanceId,
    watchRecording: matchingWatchRecording(command.watchRecording, command.workoutInstanceId, startedAt)
      ?? matchingWatchRecording(state.watchRecording, command.workoutInstanceId, startedAt),
    ownerUserId: lease.ownerUserId, actualStartTime: startedAt, actualEndTime: command.endedAt,
    scheduledSessionId: state.scheduledSessionId ?? undefined,
    source: state.plannedWorkout ? 'generated' as const : 'manual' as const,
    workoutId: state.plannedWorkout?.id, type: state.plannedWorkout?.type ?? 'easy_run' as const,
    intensity: state.plannedWorkout?.intensity ?? 'easy' as const,
    durationMinutes: elapsed / 60, distanceMiles: distance,
    routeCoordinates: state.coordinates.filter(point => point.timestamp <= command.endedAt).map(point => ({ ...point })),
    activityMetrics: capturedRunTelemetryMetrics(state, command.endedAt),
    indoor: false,
    distanceSource: command.distanceSource ?? state.distanceSource ?? 'gps',
    notes: 'Saved from the recording End command.',
  };
  return useWorkoutStore.getState().commitRunEnd(entry, athlete.currentWeek, athlete.fatigueScore, athlete.recoveryScore,
    athlete.setFatigueScore, athlete.setRecentEasyLoad, true);
}
