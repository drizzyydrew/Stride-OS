import type { OutdoorCompletionDraft, OutdoorEndCommand } from '../utils/outdoorCompletionSnapshot';

export const OUTDOOR_END_JOURNAL_KEY = 'strideos-outdoor-end-journal-v1';
export type PendingOutdoorEnd = { ownerUserId: string; command: OutdoorEndCommand; activity?: OutdoorCompletionDraft; allowRunDispatch?: boolean };
type Storage = { getItem: (key: string) => string | null | Promise<string | null>; setItem: (key: string, value: string) => unknown };

function valid(value: unknown): value is PendingOutdoorEnd {
  if (!value || typeof value !== 'object') return false;
  const item = value as PendingOutdoorEnd;
  return typeof item.ownerUserId === 'string' && item.ownerUserId.length > 0 && !!item.command
    && typeof item.command.workoutInstanceId === 'string' && item.command.workoutInstanceId.length > 0
    && Number.isFinite(item.command.endedAt) && item.command.endedAt > 0
    && (!item.activity || typeof item.activity.id === 'string' && item.activity.id.length > 0
      && item.activity.workoutInstanceId === item.command.workoutInstanceId && Number.isFinite(item.activity.endTime)
      && Number.isFinite(item.activity.startTime) && item.activity.startTime <= item.activity.endTime && !!item.activity.metrics);
}

/** First End and its full metric snapshot survive both failed history writes and cleanup. */
export class OutdoorEndJournal {
  private writes: Promise<unknown> = Promise.resolve();
  private memory = new Map<string, PendingOutdoorEnd>();
  constructor(private readonly storage: Storage) {}
  retain(item: PendingOutdoorEnd) {
    if (!valid(item)) throw new Error('Outdoor End requires an owner and exact recording identity');
    const key = JSON.stringify([item.ownerUserId, item.command.workoutInstanceId]);
    if (!this.memory.has(key)) this.memory.set(key, JSON.parse(JSON.stringify(item)));
  }
  private async read() {
    const raw = await this.storage.getItem(OUTDOOR_END_JOURNAL_KEY);
    const items: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(items) || !items.every(valid)) throw new Error('Outdoor End journal is unreadable; retained data was not cleared');
    return items as PendingOutdoorEnd[];
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writes.then(operation); this.writes = result.catch(() => undefined); return result;
  }
  pending(owner: string, isCurrent: () => boolean) {
    return this.serialize(async () => {
      const items = await this.read();
      if (!isCurrent()) return [];
      let changed = false;
      for (const item of this.memory.values()) {
        if (item.ownerUserId === owner && !items.some(saved => saved.ownerUserId === owner && saved.command.workoutInstanceId === item.command.workoutInstanceId)) {
          items.push(item); changed = true;
        }
      }
      if (changed) await this.storage.setItem(OUTDOOR_END_JOURNAL_KEY, JSON.stringify(items));
      return isCurrent() ? items.filter(item => item.ownerUserId === owner) : [];
    });
  }
  storeSnapshot(item: PendingOutdoorEnd, isCurrent: () => boolean) {
    return this.serialize(async () => {
      const items = await this.read();
      if (!isCurrent()) throw new Error('Account changed before outdoor snapshot persistence');
      const saved = items.find(value => value.ownerUserId === item.ownerUserId && value.command.workoutInstanceId === item.command.workoutInstanceId);
      if (!saved || saved.command.endedAt !== item.command.endedAt || !item.activity) throw new Error('Outdoor End snapshot identity changed');
      if (!saved.activity) {
        saved.activity = item.activity;
        await this.storage.setItem(OUTDOOR_END_JOURNAL_KEY, JSON.stringify(items));
      }
    });
  }
  acknowledge(owner: string, instance: string, isCurrent: () => boolean) {
    return this.serialize(async () => {
      const items = await this.read();
      if (!isCurrent()) return;
      await this.storage.setItem(OUTDOOR_END_JOURNAL_KEY, JSON.stringify(items.filter(item => item.ownerUserId !== owner || item.command.workoutInstanceId !== instance)));
      if (isCurrent()) this.memory.delete(JSON.stringify([owner, instance]));
    });
  }
}
