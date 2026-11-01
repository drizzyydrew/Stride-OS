import { accountCleanupKeys, isAccountDataKey } from './localAccountCleanupManifest';

export type CleanupStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export class CleanupFencedError extends Error {
  constructor() { super('Account storage is fenced for deletion. No save is confirmed.'); }
}

/** Pure barrier: bootstrap before admitting writes; fence before draining them.
 * Reads started in an earlier purge epoch cannot hydrate old data afterwards. */
export function createAccountStorageBarrier() {
  let mode: 'loading' | 'open' | 'pending' | 'purging' | 'restart' | 'error' = 'loading';
  let epoch = 0;
  let ready!: () => void;
  const initialized = new Promise<void>(resolve => { ready = resolve; });
  let writes: Promise<unknown> = Promise.resolve();
  const changed = new Set<() => void>();
  return {
    get mode() { return mode; },
    setMode(next: typeof mode) {
      if ((next === 'purging' || next === 'restart') && next !== mode) epoch++;
      mode = next;
      if (next !== 'loading') ready();
      changed.forEach(fn => fn()); changed.clear();
    },
    async drain() { await writes; },
    wrap(base: CleanupStorage): CleanupStorage {
      return {
        async getItem(key) {
          await initialized;
          // A failed secure-control read must not hydrate empty defaults and
          // later reopen writes over real history when the read is retried.
          while (isAccountDataKey(key) && (mode === 'error' || mode === 'loading')) {
            await new Promise<void>(resolve => changed.add(resolve));
          }
          if (isAccountDataKey(key) && ['purging', 'restart'].includes(mode)) return null;
          const readEpoch = epoch;
          const value = await base.getItem(key);
          return isAccountDataKey(key) && readEpoch !== epoch ? null : value;
        },
        setItem(key, value) {
          const admittedEpoch = epoch;
          const action = writes.then(async () => {
            await initialized;
            if (isAccountDataKey(key) && (mode !== 'open' || admittedEpoch !== epoch)) throw new CleanupFencedError();
            await base.setItem(key, value);
          });
          writes = action.catch(() => undefined);
          return action;
        },
        removeItem(key) {
          const admittedEpoch = epoch;
          const action = writes.then(async () => {
            await initialized;
            if (isAccountDataKey(key) && (mode !== 'open' || admittedEpoch !== epoch)) throw new CleanupFencedError();
            await base.removeItem(key);
          });
          writes = action.catch(() => undefined);
          return action;
        },
      };
    },
  };
}
export const accountStorageBarrier = createAccountStorageBarrier();

export type CleanupAuthorization = { ownerUserId: string; requestId: string; serverCompleted: boolean };
export type CleanupDependencies = {
  assertOwner(owner: string): Promise<void>;
  persistPurging(): Promise<void>;
  fence(): Promise<void>;
  quiesce(): Promise<void>;
  drain(): Promise<void>;
  keys(): Promise<string[]>;
  removeKey(key: string): Promise<void>;
  readKey(key: string): Promise<string | null>;
  removeCredentials(): Promise<void>;
  verifyCredentials(): Promise<void>;
  removeMedia(): Promise<void>;
  verifyMedia(): Promise<void>;
  persistVerified(): Promise<void>;
};

/** Invoked only with a capability-verified completed receipt. Never releases the
 * owner in this runtime: old store references remain quarantined until restart. */
export async function runLocalAccountCleanup(auth: CleanupAuthorization, deps: CleanupDependencies): Promise<void> {
  if (!auth.ownerUserId || !auth.requestId || auth.serverCompleted !== true) throw new Error('Verified server completion is required before removing local data');
  await deps.assertOwner(auth.ownerUserId);
  await deps.persistPurging();
  await deps.fence();
  await deps.quiesce();
  await deps.drain();
  await deps.assertOwner(auth.ownerUserId);
  const keys = accountCleanupKeys(await deps.keys(), auth.ownerUserId);
  for (const key of keys) {
    await deps.assertOwner(auth.ownerUserId);
    await deps.removeKey(key);
    if (await deps.readKey(key) !== null) throw new Error('Local data removal is not yet confirmed');
  }
  await deps.removeCredentials();
  await deps.verifyCredentials();
  await deps.removeMedia();
  await deps.verifyMedia();
  await deps.assertOwner(auth.ownerUserId);
  if (accountCleanupKeys(await deps.keys(), auth.ownerUserId).length) throw new Error('Local records remain; cleanup will retry');
  await deps.persistVerified();
}
