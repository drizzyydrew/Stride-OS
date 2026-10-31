import type { GoalArchive } from '../types/goalArchive';
import { getAppStorage } from '../store/persistStorage';
import { decodeGoalArchives } from './goalArchiveSync';
import { ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';

export type GoalTransition = {
  schemaVersion: 1;
  id: string;
  ownerUserId: string;
  requestKey: string;
  snapshots: GoalArchive[];
  status: 'prepared' | 'complete';
};

let operations: Promise<void> = Promise.resolve();
const keyFor = (lease: OwnerLease) => `goal-transition:${lease.ownerUserId}`;

function requireOwner(lease: OwnerLease): void {
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Goal transition owner changed or is unavailable');
}

function decode(value: unknown, ownerUserId: string): GoalTransition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unreadable goal transition journal');
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || record.ownerUserId !== ownerUserId
    || typeof record.id !== 'string' || !record.id.trim()
    || typeof record.requestKey !== 'string' || !record.requestKey.trim()
    || (record.status !== 'prepared' && record.status !== 'complete')) {
    throw new Error('Invalid or foreign goal transition journal');
  }
  decodeGoalArchives(record.snapshots, ownerUserId);
  // Keep the entire snapshot, including all old plan fields, for recovery.
  return value as GoalTransition;
}

function serialize<T>(lease: OwnerLease, action: (current: OwnerLease) => Promise<T>): Promise<T> {
  const current = { ...lease };
  const task = operations.then(async () => {
    requireOwner(current);
    const result = await action(current);
    requireOwner(current);
    return result;
  });
  operations = task.then(() => undefined, () => undefined);
  return task;
}

async function readCurrent(lease: OwnerLease): Promise<GoalTransition | null> {
  requireOwner(lease);
  const raw = await getAppStorage().getItem(keyFor(lease));
  requireOwner(lease);
  return raw === null ? null : decode(JSON.parse(raw), lease.ownerUserId);
}

/** Recovery intent only. Reading a prepared journal never publishes archives. */
export function readGoalTransition(lease: OwnerLease): Promise<GoalTransition | null> {
  return serialize(lease, readCurrent);
}

/**
 * The coordinator may publish snapshots only after confirming the primary
 * training plan's durable lastTransitionId matches this record's id. A complete
 * journal retains its snapshots; this module never writes archive source data.
 */
export async function saveGoalTransition(record: GoalTransition, lease: OwnerLease): Promise<void> {
  const capturedLease = { ...lease };
  requireOwner(capturedLease);
  const raw = JSON.stringify(record);
  const candidate = decode(JSON.parse(raw), capturedLease.ownerUserId);
  await serialize(capturedLease, async current => {
    const saved = await readCurrent(current);
    requireOwner(current);
    // An old background finalizer may lag behind a newer explicit choice.
    // Completion is conditional on the intent still belonging to that id.
    if (candidate.status === 'complete' && saved?.id !== candidate.id) return;
    await getAppStorage().setItem(keyFor(current), raw);
    requireOwner(current);
    const confirmed = await getAppStorage().getItemOnce(keyFor(current));
    requireOwner(current);
    if (confirmed !== raw) throw new Error('Goal transition save was not confirmed; retry saving');
    decode(JSON.parse(confirmed), current.ownerUserId);
  });
  requireOwner(capturedLease);
}
