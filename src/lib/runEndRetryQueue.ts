import type { RunEndCommand } from './runCompletionCommand';
import { validRunEndSnapshot } from '../utils/trainingRunEndSnapshot';

export const RUN_END_RETRY_KEY = 'strideos-watch-run-end-retry-v1';
export type PendingRunEnd = { ownerUserId: string; command: RunEndCommand };
type Storage = { getItem: (key: string) => string | null | Promise<string | null>; setItem: (key: string, value: string) => unknown };

function valid(value: unknown): value is PendingRunEnd {
  if (!value || typeof value !== 'object') return false;
  const { ownerUserId, command } = value as PendingRunEnd;
  return typeof ownerUserId === 'string' && ownerUserId.length > 0 && !!command
    && typeof command.workoutInstanceId === 'string' && command.workoutInstanceId.length > 0
    && Number.isFinite(command.endedAt) && command.endedAt > 0
    && (command.elapsedSeconds === undefined || Number.isFinite(command.elapsedSeconds) && command.elapsedSeconds >= 0)
    && (command.distanceMiles === undefined || Number.isFinite(command.distanceMiles) && command.distanceMiles >= 0)
    && (command.snapshot === undefined || validRunEndSnapshot(command.snapshot, command) && command.snapshot.ownerUserId === ownerUserId);
}

/** Separate transport retry from B's authoritative completion journal. First End wins. */
export class RunEndRetryQueue {
  private writes: Promise<unknown> = Promise.resolve();
  private memory = new Map<string, PendingRunEnd>();
  constructor(private readonly storage: Storage) {}

  retain(item: PendingRunEnd) {
    if (!valid(item)) throw new Error('Run End requires an owner and exact recording identity');
    const key = JSON.stringify([item.ownerUserId, item.command.workoutInstanceId]);
    if (!this.memory.has(key)) this.memory.set(key, JSON.parse(JSON.stringify(item)) as PendingRunEnd);
  }

  async enqueue(item: PendingRunEnd, isCurrent: () => boolean): Promise<void> {
    this.retain(item);
    const saved = await this.pending(item.ownerUserId, isCurrent);
    if (!isCurrent() || !saved.some(value => value.command.workoutInstanceId === item.command.workoutInstanceId)) {
      throw new Error('Watch End is retained for its original owner; durable acceptance is pending');
    }
  }

  private async read() {
    const raw = await this.storage.getItem(RUN_END_RETRY_KEY);
    const saved: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.every(valid)) throw new Error('Run End recovery is unreadable; retained data was not cleared');
    return saved as PendingRunEnd[];
  }

  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const result = this.writes.then(action);
    this.writes = result.catch(() => undefined);
    return result;
  }

  async pending(ownerUserId: string, isCurrent: () => boolean) {
    return this.serialize(async () => {
      const saved = await this.read();
      if (!isCurrent()) return [];
      let changed = false;
      for (const item of this.memory.values()) {
        if (item.ownerUserId === ownerUserId && !saved.some(prior => prior.ownerUserId === ownerUserId
          && prior.command.workoutInstanceId === item.command.workoutInstanceId)) { saved.push(item); changed = true; }
      }
      if (changed) await this.storage.setItem(RUN_END_RETRY_KEY, JSON.stringify(saved));
      if (!isCurrent()) return [];
      return saved.filter(item => item.ownerUserId === ownerUserId);
    });
  }

  acknowledge(ownerUserId: string, instance: string, isCurrent: () => boolean) {
    return this.serialize(async () => {
      const saved = await this.read();
      if (!isCurrent()) return;
      await this.storage.setItem(RUN_END_RETRY_KEY, JSON.stringify(saved.filter(item =>
        item.ownerUserId !== ownerUserId || item.command.workoutInstanceId !== instance)));
      if (isCurrent()) this.memory.delete(JSON.stringify([ownerUserId, instance]));
    });
  }
}
