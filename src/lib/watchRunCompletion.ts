import { endStrideWatchWorkoutIfMatching } from '../../modules/stride-watch-connectivity/src';
import { endStrideRunLiveActivityIfMatching } from '../../modules/stride-live-activity/src';
import { useActiveRunStore } from '../store/activeRunStore';
import { useWorkoutStore, type RunCompletionResult } from '../store/workoutStore';
import { getAppStorage } from '../store/persistStorage';
import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';
import { completeRunCommand, type RunEndCommand } from './runCompletionCommand';
import { RunEndRetryQueue } from './runEndRetryQueue';
import { stopLocationTrackingWhen } from './gpsTracking';
import { captureTrainingRunEnd } from '../utils/trainingRunEndSnapshot';

const retryQueue = new RunEndRetryQueue(getAppStorage());
const durableEnds = new Set<string>();
const cleanedEnds = new Set<string>();
let recovery: Promise<void> | null = null;
let requestedSweep = 0;
let completedSweep = 0;
const key = (owner: string, instance: string) => JSON.stringify([owner, instance]);

async function cleanup(result: RunCompletionResult, lease: OwnerLease): Promise<boolean> {
  const instance = result.entry.workoutInstanceId;
  if (!instance || !ownerLeaseIsCurrent(lease) || !ownerLeaseIsCurrent(result.ownerLease)) return false;
  if (!await endStrideRunLiveActivityIfMatching(instance)) throw new Error('Exact recording cleanup requires the updated native app');
  if (!ownerLeaseIsCurrent(lease)) return false;
  await endStrideWatchWorkoutIfMatching(instance);
  if (!ownerLeaseIsCurrent(lease)) return false;
  // The GPS operation shares ordering with new starts and rechecks after its native read.
  const canStop = () => ownerLeaseIsCurrent(lease)
    && (!useActiveRunStore.getState().isActive || useActiveRunStore.getState().workoutInstanceId === instance);
  if (canStop()) await stopLocationTrackingWhen(canStop);
  if (!ownerLeaseIsCurrent(lease)) return false;
  const current = useActiveRunStore.getState();
  if (current.isActive && current.workoutInstanceId === instance) current.finishRun();
  if (!ownerLeaseIsCurrent(lease)) return false;
  await useWorkoutStore.getState().acknowledgeRunCleanup(instance, lease);
  if (!ownerLeaseIsCurrent(lease)) return false;
  await retryQueue.acknowledge(lease.ownerUserId, instance, () => ownerLeaseIsCurrent(lease));
  if (!ownerLeaseIsCurrent(lease)) return false;
  cleanedEnds.add(key(lease.ownerUserId, instance));
  return true;
}

/** Root-level retry; neither completion nor cleanup depends on a mounted Run screen. */
export async function recoverRunEndCommands(): Promise<void> {
  const requested = ++requestedSweep;
  let failure: unknown;
  while (completedSweep < requested) {
    if (!recovery) {
      recovery = (async () => {
        let sweepFailure: unknown;
        do {
          const through = requestedSweep;
          try { await recover(); } catch (error) { sweepFailure ??= error; }
          completedSweep = through;
        } while (completedSweep < requestedSweep);
        if (sweepFailure) throw sweepFailure;
      })().finally(() => { recovery = null; });
    }
    try { await recovery; } catch (error) { failure ??= error; }
  }
  if (failure) throw failure;
}

async function recover() {
  const lease = captureOwnerLease();
  if (!lease || !useActiveRunStore.persist.hasHydrated() || !useWorkoutStore.persist.hasHydrated()) return;
  const isCurrent = () => ownerLeaseIsCurrent(lease);
  const pending = await retryQueue.pending(lease.ownerUserId, isCurrent);
  if (!isCurrent()) return;
  const discards = await useWorkoutStore.getState().pendingRunDiscards();
  if (!isCurrent()) return;
  const handled = new Set<string>();
  let failure: unknown;
  for (const item of pending) {
    if (!isCurrent()) return;
    const instance = item.command.workoutInstanceId;
    try {
      // Includes acknowledged tombstones, not only discards still awaiting cleanup.
      const discarded = await useWorkoutStore.getState().getRunDiscardResult(instance, lease);
      if (!isCurrent()) return;
      const active = useActiveRunStore.getState();
      const saved = useWorkoutStore.getState().history.some(record =>
        record.workoutInstanceId === instance && record.ownerUserId === lease.ownerUserId);
      if (!discarded && !saved && active.isActive && active.workoutInstanceId === instance
        && active.environment === 'indoor') {
        active.requestCompletion(item.command.endedAt);
        continue;
      }
      const result: RunCompletionResult = discarded
        ? discarded
        : await completeRunCommand(item.command);
      if (!isCurrent()) return;
      durableEnds.add(key(lease.ownerUserId, instance));
      handled.add(instance);
      if (!await cleanup(result, lease)) return;
      if (!isCurrent()) return;
    } catch (error) {
      if (!isCurrent()) return;
      failure ??= error;
    }
  }
  // A phone-stop discard can outlive its screen even without a Watch End event.
  for (const item of discards) {
    const instance = item.entry.workoutInstanceId!;
    if (!isCurrent()) return;
    if (handled.has(instance)) continue;
    try {
      if (!await cleanup({ status: 'discarded', activityId: null, entry: item.entry, ownerLease: lease }, lease)) return;
    } catch (error) { failure ??= error; }
    if (!isCurrent()) return;
  }
  const active = useActiveRunStore.getState();
  const saved = active.isActive ? useWorkoutStore.getState().history.find(record =>
    record.workoutInstanceId === active.workoutInstanceId && record.ownerUserId === lease.ownerUserId) : undefined;
  if (saved?.workoutInstanceId && saved.actualEndTime != null && isCurrent()) {
    const result = await completeRunCommand({ workoutInstanceId: saved.workoutInstanceId, endedAt: saved.actualEndTime });
    if (!isCurrent()) return;
    await cleanup(result, lease);
  }
  if (failure) throw failure;
}

export async function completeWatchRunEnd(command: RunEndCommand): Promise<boolean> {
  const lease = captureOwnerLease();
  const ownerUserId = lease?.ownerUserId ?? getLocalDataOwner()?.ownerUserId;
  if (!ownerUserId) throw new Error('Watch End is waiting for the original recording owner');
  const active = useActiveRunStore.getState();
  if (lease && !command.snapshot && useActiveRunStore.persist.hasHydrated() && active.isActive
    && active.workoutInstanceId === command.workoutInstanceId && active.startTime != null && active.environment !== 'indoor') {
    command = { ...command, snapshot: { ...captureTrainingRunEnd(active, command), ownerUserId } };
  }
  const item = { ownerUserId, command };
  if (!ownerLeaseIsCurrent(lease)) {
    retryQueue.retain(item);
    throw new Error('Watch End is waiting for the original recording owner');
  }
  // This write must finish before joining a sweep that may already have read an empty queue.
  await retryQueue.enqueue(item, () => ownerLeaseIsCurrent(lease));
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed; Watch End remains with its original owner');
  try {
    await recoverRunEndCommands();
  } catch (error) {
    // An unrelated retained command must not fail this command's completed result.
    if (!ownerLeaseIsCurrent(lease) || !cleanedEnds.has(key(ownerUserId, command.workoutInstanceId))) throw error;
  }
  return ownerLeaseIsCurrent(lease) && durableEnds.has(key(ownerUserId, command.workoutInstanceId));
}
