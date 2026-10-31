import { create } from 'zustand';
import type { GoalArchive } from '../types/goalArchive';
import type { OwnerLease } from '../lib/localDataOwner';
import { ownerLeaseIsCurrent } from '../lib/localDataOwner';
import {
  decodeGoalArchives, fetchGoalArchives, mergeGoalArchives, requireGoalArchiveLease,
  syncGoalArchives, validateGoalArchiveResult,
} from '../lib/goalArchiveSync';
import { getAppStorage } from './persistStorage';

export type GoalArchiveState = {
  ownerUserId: string | null;
  archives: GoalArchive[];
  status: 'loading' | 'ready' | 'error';
  syncStatus: 'local' | 'syncing' | 'synced' | 'error';
  load: (lease: OwnerLease) => Promise<void>;
  addArchive: (archive: GoalArchive, lease: OwnerLease) => Promise<void>;
  saveResult: (id: string, result: GoalArchive['result'], lease: OwnerLease) => Promise<void>;
  sync: (lease: OwnerLease) => Promise<void>;
};

// Resolve the app adapter on each operation; never capture a native storage
// instance or use persist middleware's automatic writes on state publication.
const dynamicAsyncStorage = {
  getItem: (key: string) => getAppStorage().getItem(key),
  getItemOnce: (key: string) => getAppStorage().getItemOnce(key),
  setItem: (key: string, value: string) => getAppStorage().setItem(key, value),
};
const keyFor = (lease: OwnerLease) => `goal-archives:${lease.ownerUserId}`;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
let queue: Promise<void> = Promise.resolve();

function enqueue(lease: OwnerLease, action: (lease: OwnerLease) => Promise<void>): Promise<void> {
  const captured = { ...lease };
  const task = queue.then(async () => {
    requireGoalArchiveLease(captured);
    await action(captured);
    requireGoalArchiveLease(captured);
  });
  queue = task.catch(() => undefined);
  return task;
}

async function readLocal(lease: OwnerLease, initial = false): Promise<GoalArchive[]> {
  requireGoalArchiveLease(lease);
  const raw = await (initial ? dynamicAsyncStorage.getItem(keyFor(lease)) : dynamicAsyncStorage.getItemOnce(keyFor(lease)));
  requireGoalArchiveLease(lease);
  return raw === null ? [] : decodeGoalArchives(JSON.parse(raw), lease.ownerUserId);
}

async function writeLocal(archives: readonly GoalArchive[], lease: OwnerLease): Promise<GoalArchive[]> {
  requireGoalArchiveLease(lease);
  const raw = JSON.stringify(archives);
  await dynamicAsyncStorage.setItem(keyFor(lease), raw);
  requireGoalArchiveLease(lease);
  const confirmed = await dynamicAsyncStorage.getItemOnce(keyFor(lease));
  requireGoalArchiveLease(lease);
  if (confirmed !== raw) throw new Error('Goal archive save was not confirmed; retry saving');
  return decodeGoalArchives(JSON.parse(confirmed), lease.ownerUserId);
}

/** Foreground-only. Call load with the current owner lease before any mutation. */
export const useGoalArchiveStore = create<GoalArchiveState>((set, get) => {
  function requireReady(lease: OwnerLease) {
    requireGoalArchiveLease(lease);
    const state = get();
    if (state.ownerUserId !== lease.ownerUserId || state.status !== 'ready') {
      throw new Error('Load this owner\'s goal archives before saving');
    }
  }

  async function currentLocal(lease: OwnerLease) {
    requireReady(lease);
    const saved = await readLocal(lease);
    requireReady(lease);
    // A previous write may have succeeded even if its readback failed. Disk's
    // baseline wins on retry, preserving that original snapshot too.
    return mergeGoalArchives(saved, get().archives);
  }

  async function mutate(lease: OwnerLease, update: (archives: GoalArchive[]) => GoalArchive[]) {
    const current = await currentLocal(lease);
    requireReady(lease);
    const next = update(current);
    const committed = await writeLocal(next, lease);
    requireReady(lease);
    set({ archives: committed, syncStatus: 'local' });
  }

  return {
    ownerUserId: null, archives: [], status: 'loading', syncStatus: 'local',
    load: lease => enqueue(lease, async current => {
      set({ ownerUserId: current.ownerUserId, archives: [], status: 'loading', syncStatus: 'local' });
      try {
        const local = await readLocal(current, true);
        requireGoalArchiveLease(current);
        let cloud: GoalArchive[];
        try {
          cloud = await fetchGoalArchives(current);
          requireGoalArchiveLease(current);
        } catch {
          requireGoalArchiveLease(current);
          // Never persist an empty fallback after a failed cloud restore.
          set({ archives: local, status: 'ready', syncStatus: 'error' });
          return;
        }
        const merged = mergeGoalArchives(cloud, local);
        const committed = JSON.stringify(merged) === JSON.stringify(local)
          ? local : await writeLocal(merged, current);
        requireGoalArchiveLease(current);
        set({ archives: committed, status: 'ready',
          syncStatus: JSON.stringify(merged) === JSON.stringify(cloud) ? 'synced' : 'local' });
      } catch (error) {
        if (ownerLeaseIsCurrent(current)) set({ status: 'error', syncStatus: 'error' });
        throw error;
      }
    }),
    addArchive: (archive, lease) => {
      const candidate = copy(archive);
      return enqueue(lease, async current => {
        decodeGoalArchives([candidate], current.ownerUserId);
        await mutate(current, archives => mergeGoalArchives(archives, [candidate]));
        requireReady(current);
      });
    },
    saveResult: (id, result, lease) => {
      const candidate = copy(result);
      return enqueue(lease, async current => {
        validateGoalArchiveResult(candidate);
        await mutate(current, archives => {
          const archive = archives.find(item => item.id === id);
          if (!archive) throw new Error('Goal archive was not found');
          const updated = { ...candidate, source: candidate.source ?? 'user' as const,
            updatedAt: candidate.updatedAt ?? Math.max(Date.now(), (archive.result.updatedAt ?? -1) + 1) };
          return mergeGoalArchives(archives, [{ ...archive, result: updated }]);
        });
        requireReady(current);
      });
    },
    sync: lease => enqueue(lease, async current => {
      const local = await currentLocal(current);
      requireReady(current);
      set({ syncStatus: 'syncing' });
      try {
        const cloud = await syncGoalArchives(local, current);
        requireReady(current);
        const committed = await writeLocal(cloud, current);
        requireReady(current);
        set({ archives: committed, syncStatus: 'synced' });
      } catch (error) {
        if (ownerLeaseIsCurrent(current)) set({ syncStatus: 'error' });
        throw error;
      }
    }),
  };
});
