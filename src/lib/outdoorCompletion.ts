import { endStrideRunLiveActivityIfMatching } from '../../modules/stride-live-activity/src';
import { endStrideWatchWorkoutIfMatching } from '../../modules/stride-watch-connectivity/src';
import { awaitActiveActivityPersistence, useActiveActivityStore } from '../store/activeActivityStore';
import { useActiveRunStore } from '../store/activeRunStore';
import { useActivityStore } from '../store/activityStore';
import { useWorkoutStore } from '../store/workoutStore';
import { getAppStorage } from '../store/persistStorage';
import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';
import { stopActivityLocationTrackingWhen } from './activityGpsTracking';
import { captureOutdoorCompletion, type OutdoorCompletionDraft, type OutdoorEndCommand } from '../utils/outdoorCompletionSnapshot';
import { OutdoorEndJournal, type PendingOutdoorEnd } from './outdoorEndJournal';
import { completeWatchRunEnd } from './watchRunCompletion';

const journal = new OutdoorEndJournal(getAppStorage());
const completed = new Map<string, { activityId: string | null; lease: OwnerLease }>();
const key = (owner: string, instance: string) => JSON.stringify([owner, instance]);
let recovery: Promise<void> | null = null;
let requestedSweep = 0;
let completedSweep = 0;

function savedOutdoor(instance: string): OutdoorCompletionDraft | undefined {
  const saved = useActivityStore.getState().activities.find(activity => activity.workoutInstanceId === instance && !activity.legacyWorkoutId);
  return saved?.endTime != null ? { ...saved, workoutInstanceId: instance, endTime: saved.endTime } : undefined;
}

function awaitingIndoorConfirmation(instance: string) {
  const run = useActiveRunStore.getState();
  return run.isActive && run.workoutInstanceId === instance && run.environment === 'indoor'
    && run.completionRequestedAt != null;
}

async function cleanup(activity: OutdoorCompletionDraft, lease: OwnerLease) {
  const instance = activity.workoutInstanceId;
  const isCurrent = () => ownerLeaseIsCurrent(lease);
  if (!isCurrent()) return false;
  if (!await endStrideRunLiveActivityIfMatching(instance)) throw new Error('Outdoor native cleanup is waiting for exact recording support');
  if (!isCurrent()) return false;
  await endStrideWatchWorkoutIfMatching(instance);
  if (!isCurrent()) return false;
  const matches = () => isCurrent() && (!useActiveActivityStore.getState().isActive
    || useActiveActivityStore.getState().workoutInstanceId === instance);
  if (matches()) await stopActivityLocationTrackingWhen(matches);
  if (!isCurrent()) return false;
  const latest = useActiveActivityStore.getState();
  if (latest.isActive && latest.workoutInstanceId === instance) latest.discard();
  if (!isCurrent()) return false;
  // Make clearing the completed recording durable before retiring its recovery marker.
  if (!useActiveActivityStore.getState().isActive) {
    await awaitActiveActivityPersistence(lease);
    if (!isCurrent()) return false;
  }
  await journal.acknowledge(lease.ownerUserId, instance, isCurrent);
  return isCurrent();
}

async function sweep() {
  const lease = captureOwnerLease();
  if (!lease || !useActiveActivityStore.persist.hasHydrated() || !useActiveRunStore.persist.hasHydrated()
    || !useActivityStore.persist.hasHydrated() || !useWorkoutStore.persist.hasHydrated()) return;
  const isCurrent = () => ownerLeaseIsCurrent(lease);
  const legacy = useActiveActivityStore.getState();
  if (legacy.isActive && legacy.workoutInstanceId && legacy.completionRequestedAt != null) {
    const command = { workoutInstanceId: legacy.workoutInstanceId, endedAt: legacy.completionRequestedAt };
    journal.retain({ ownerUserId: lease.ownerUserId, command, activity: captureOutdoorCompletion(legacy, command) });
  }
  const pending = await journal.pending(lease.ownerUserId, isCurrent);
  if (!isCurrent()) return;
  let failure: unknown;
  for (const item of pending) {
    if (!isCurrent()) return;
    const instance = item.command.workoutInstanceId;
    try {
      const discardedRun = item.allowRunDispatch && !item.activity
        ? await useWorkoutStore.getState().getRunDiscardResult(instance, lease) : null;
      if (!isCurrent()) return;
      const run = useActiveRunStore.getState();
      const outdoor = useActiveActivityStore.getState();
      const matchesRun = run.isActive && run.workoutInstanceId === instance;
      const matchesOutdoor = outdoor.isActive && outdoor.workoutInstanceId === instance;
      if (matchesRun && matchesOutdoor) throw new Error('Recording identity is claimed by two active stores; End retained');
      const runHistory = useWorkoutStore.getState().history.some(record => record.workoutInstanceId === instance && record.ownerUserId === lease.ownerUserId);
      if (item.allowRunDispatch && !item.activity && (discardedRun || matchesRun || !matchesOutdoor && runHistory)) {
        const saved = await completeWatchRunEnd({ workoutInstanceId: instance, endedAt: item.command.endedAt,
          elapsedSeconds: item.command.elapsedSeconds,
          distanceMiles: item.command.distanceMeters == null ? undefined : item.command.distanceMeters / 1609.344,
          watchRecording: item.command.watchRecording });
        if (!isCurrent()) return;
        if (!saved && awaitingIndoorConfirmation(instance)) continue;
        if (!saved) throw new Error('Run End retained until its original owner can complete it');
        await journal.acknowledge(lease.ownerUserId, instance, isCurrent);
        if (!isCurrent()) return;
        completed.set(key(lease.ownerUserId, instance), { activityId: null, lease });
        continue;
      }
      let activity = item.activity;
      if (!activity) {
        activity = savedOutdoor(instance) ?? captureOutdoorCompletion(outdoor, item.command);
        await journal.storeSnapshot({ ...item, activity }, isCurrent);
        if (!isCurrent()) return;
      }
      const collision = useActivityStore.getState().activities.find(value => value.id === activity!.id);
      if (collision && collision.workoutInstanceId !== instance) throw new Error('Activity ID belongs to a different recording; End retained');
      const activityId = await useActivityStore.getState().addActivityAndPersist(activity, lease);
      if (!isCurrent()) return;
      if (!await cleanup(activity, lease)) return;
      if (!isCurrent()) return;
      completed.set(key(lease.ownerUserId, instance), { activityId, lease });
    } catch (error) {
      if (!isCurrent()) return;
      failure ??= error;
    }
  }
  if (failure) throw failure;
}

export async function recoverOutdoorCompletions(): Promise<void> {
  const requested = ++requestedSweep;
  let failure: unknown;
  while (completedSweep < requested) {
    if (!recovery) {
      recovery = (async () => {
        let sweepFailure: unknown;
        do {
          const through = requestedSweep;
          try { await sweep(); } catch (error) { sweepFailure ??= error; }
          completedSweep = through;
        } while (completedSweep < requestedSweep);
        if (sweepFailure) throw sweepFailure;
      })().finally(() => { recovery = null; });
    }
    try { await recovery; } catch (error) { failure ??= error; }
  }
  if (failure) throw failure;
}

async function submit(command: OutdoorEndCommand, allowRunDispatch: boolean) {
  const lease = captureOwnerLease();
  const owner = lease?.ownerUserId ?? getLocalDataOwner()?.ownerUserId;
  if (!owner) throw new Error('Outdoor End is waiting for the original recording owner');
  const state = useActiveActivityStore.getState();
  if (state.isActive && state.workoutInstanceId === command.workoutInstanceId && state.completionRequestedAt != null) {
    command = { ...command, endedAt: state.completionRequestedAt, elapsedSeconds: undefined, distanceMeters: undefined };
  }
  const activity = savedOutdoor(command.workoutInstanceId) ?? (state.isActive && state.workoutInstanceId === command.workoutInstanceId
    ? captureOutdoorCompletion(state, command) : undefined);
  const item: PendingOutdoorEnd = { ownerUserId: owner, command, activity, allowRunDispatch };
  journal.retain(item);
  const isCurrent = () => ownerLeaseIsCurrent(lease);
  if (!isCurrent()) throw new Error('Outdoor End is retained for the original recording owner');
  if (state.isActive && state.workoutInstanceId === command.workoutInstanceId) state.prepareEnd(command.workoutInstanceId, command.endedAt);
  const pending = await journal.pending(owner, isCurrent);
  if (!isCurrent() || !pending.some(value => value.command.workoutInstanceId === command.workoutInstanceId)) {
    throw new Error('Outdoor End has not yet been durably accepted');
  }
  try { await recoverOutdoorCompletions(); } catch (error) {
    if (!isCurrent() || !completed.has(key(owner, command.workoutInstanceId))) throw error;
  }
  if (!isCurrent()) throw new Error('Account changed; Outdoor End remains with its original owner');
  const result = completed.get(key(owner, command.workoutInstanceId));
  if (!result && allowRunDispatch && awaitingIndoorConfirmation(command.workoutInstanceId)) {
    return { status: 'awaiting_confirmation' as const, activityId: null, ownerLease: lease! };
  }
  if (!result) throw new Error('Outdoor End retained until history hydration and exact identity are available');
  return { status: 'saved' as const, activityId: result.activityId, ownerLease: result.lease };
}

export function completeOutdoorCommand(command: OutdoorEndCommand) { return submit(command, false); }
export function completeWatchActivityEnd(command: OutdoorEndCommand) { return submit(command, true); }
