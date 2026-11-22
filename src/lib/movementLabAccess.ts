import { assertProAccess, requireProAccess } from './pro-access';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';

/** A paid operation belongs to the owner and screen that selected its media.
 * This is a client product boundary; it does not change server storage policy. */
export type MovementLabWork = { lease: OwnerLease; stillCurrent: () => boolean };

function assertMovementLabOwner(work: MovementLabWork | null | undefined): asserts work is MovementLabWork {
  if (!work || !work.stillCurrent() || !ownerLeaseIsCurrent(work.lease)) {
    throw new Error('Your account or Movement Lab screen changed. Your saved clips and results were retained. Reopen Movement Lab to start new work.');
  }
}

export function assertMovementLabWork(work: MovementLabWork | null | undefined): asserts work is MovementLabWork {
  assertMovementLabOwner(work);
  assertProAccess('movement-lab');
}

export async function beginMovementLabWork(stillCurrent: () => boolean = () => true): Promise<MovementLabWork> {
  const lease = captureOwnerLease();
  if (!lease || !stillCurrent()) throw new Error('Your profile is still restoring. Reopen Movement Lab when your account is ready.');
  const work = { lease, stillCurrent };
  await requireProAccess('movement-lab');
  assertMovementLabWork(work);
  return work;
}

/** Refresh before a new processing/save boundary, then fence the original owner. */
export async function recheckMovementLabWork(work: MovementLabWork | null | undefined): Promise<void> {
  // AppState-active refresh may be pending after a picker/camera returns. Do
  // not mistake that same-owner verification for loss of entitlement.
  assertMovementLabOwner(work);
  await requireProAccess('movement-lab');
  assertMovementLabWork(work);
}

/** Raw pose files are optional because inline results are already retained.
 * A failed file write must never swallow an owner/entitlement invalidation. */
export async function attachMovementLabWork<T>(work: MovementLabWork | null | undefined, write: () => Promise<T>): Promise<T | undefined> {
  await recheckMovementLabWork(work);
  let value: T | undefined;
  try { value = await write(); } catch { /* Inline results remain available. */ }
  await recheckMovementLabWork(work);
  return value;
}
