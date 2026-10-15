import type { WorkoutIntensity, WorkoutType } from '../types/training';
import type { RunCompletionIdentity, RunWorkoutRecord } from '../utils/runCompletionIdentity';
import { matchingWatchRecording, runCompletionKey } from '../utils/runCompletionIdentity';
import type { DistanceSource } from '../types/activity';

export const RUN_COMPLETION_JOURNAL_KEY = 'strideos-run-completion-journal-v1';
export type LiveRunEntry = RunCompletionIdentity & {
  completionKey: string;
  type: WorkoutType;
  intensity: WorkoutIntensity;
  durationMinutes: number;
  distanceMiles: number;
  routeCoordinates?: RunWorkoutRecord['routeCoordinates'];
  source?: RunWorkoutRecord['source'];
  workoutId?: string;
  rpe?: number;
  notes?: string;
  distanceSource?: DistanceSource;
  associatedTrainingBlockId?: string;
  associatedGoalId?: string;
};
export type PendingRunCompletion = {
  ownerUserId: string;
  discarded?: boolean;
  cleanupAcknowledged?: boolean;
  entry: LiveRunEntry;
  week: number;
  fatigue: number;
  recovery: number;
};
type Storage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => unknown;
};

function validPending(value: unknown): value is PendingRunCompletion {
  if (!value || typeof value !== 'object') return false;
  const item = value as PendingRunCompletion;
  const entry = item.entry;
  return typeof item.ownerUserId === 'string' && item.ownerUserId.length > 0
    && (item.discarded === undefined || typeof item.discarded === 'boolean')
    && (item.cleanupAcknowledged === undefined || typeof item.cleanupAcknowledged === 'boolean')
    && !!entry && typeof entry.workoutInstanceId === 'string' && entry.workoutInstanceId.length > 0
    && entry.completionKey === runCompletionKey(entry.workoutInstanceId)
    && (!entry.ownerUserId || entry.ownerUserId === item.ownerUserId)
    && (entry.watchRecording === undefined || !!matchingWatchRecording(entry.watchRecording, entry.workoutInstanceId, entry.actualStartTime))
    && typeof entry.actualStartTime === 'number' && Number.isFinite(entry.actualStartTime)
    && typeof entry.actualEndTime === 'number' && Number.isFinite(entry.actualEndTime) && entry.actualEndTime >= entry.actualStartTime
    && Number.isFinite(entry.durationMinutes) && entry.durationMinutes >= 0
    && Number.isFinite(entry.distanceMiles) && entry.distanceMiles >= 0
    && Number.isFinite(item.week) && Number.isFinite(item.fatigue) && Number.isFinite(item.recovery);
}

export class RunCompletionJournal {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: Storage) {}

  async read(): Promise<PendingRunCompletion[]> {
    const raw = await this.storage.getItem(RUN_COMPLETION_JOURNAL_KEY);
    if (raw === null) return [];
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.some(item => !validPending(item))) {
      throw new Error('Saved run recovery data is unreadable; it was not cleared');
    }
    return entries;
  }

  private update(action: (entries: PendingRunCompletion[]) => PendingRunCompletion[], isCurrent: () => boolean = () => true) {
    const task = this.queue.then(async () => {
      if (!isCurrent()) throw new Error('Account changed before run journal write');
      const entries = await this.read();
      if (!isCurrent()) throw new Error('Account changed during run journal read');
      await this.storage.setItem(RUN_COMPLETION_JOURNAL_KEY, JSON.stringify(action(entries)));
      if (!isCurrent()) throw new Error('Account changed during run journal write');
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  save(pending: PendingRunCompletion) {
    if (!validPending(pending)) return Promise.reject(new Error('Run recovery requires a valid owner, instance, and actual times'));
    return this.update(entries => entries.some(item => item.ownerUserId === pending.ownerUserId
      && item.entry.completionKey === pending.entry.completionKey) ? entries : [...entries, pending]);
  }

  acknowledge(ownerUserId: string, completionKey: string) {
    return this.update(entries => entries.filter(item => item.ownerUserId !== ownerUserId || item.entry.completionKey !== completionKey));
  }

  discard(pending: PendingRunCompletion, isCurrent: () => boolean) {
    if (!validPending(pending)) return Promise.reject(new Error('Run discard requires a valid owner, instance, and actual times'));
    return this.update(entries => {
      const existing = entries.find(item => item.ownerUserId === pending.ownerUserId && item.entry.completionKey === pending.entry.completionKey);
      if (!existing) return [...entries, { ...pending, discarded: true }];
      if (existing.discarded) return entries;
      return entries.map(item => item === existing ? { ...item, discarded: true } : item);
    }, isCurrent);
  }

  acknowledgeCleanup(ownerUserId: string, completionKey: string, isCurrent: () => boolean) {
    // Keep a resolved discard tombstone: an outer End queue may still replay after a crash.
    return this.update(entries => entries.flatMap(item => {
      if (item.ownerUserId !== ownerUserId || item.entry.completionKey !== completionKey) return [item];
      return item.discarded ? [{ ...item, cleanupAcknowledged: true }] : [];
    }), isCurrent);
  }
}
