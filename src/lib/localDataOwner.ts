export const LOCAL_DATA_OWNER_KEY = 'strideos-local-data-owner-v1';

export type LocalAccessStatus = 'loading' | 'ready' | 'offline' | 'signed-out' | 'owner-conflict' | 'unclaimed' | 'invalid' | 'storage-error';
export type OwnerLease = { ownerUserId: string; generation: number };
export type OwnerRecord = { version: 1; ownerUserId: string | null; logoutFence: boolean; unclaimed: boolean };
export type OwnerStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const EMPTY: OwnerRecord = { version: 1, ownerUserId: null, logoutFence: false, unclaimed: false };

/** One device's retained data has one owner. Switching identities never reassigns it. */
export class LocalDataOwner {
  private record: OwnerRecord = { ...EMPTY };
  private loaded = false;
  private generation = 0;
  private authenticatedUserId: string | null = null;
  private writes: Promise<void> = Promise.resolve();
  status: LocalAccessStatus = 'loading';

  constructor(private readonly storage: OwnerStorage) {}

  get ownerUserId() { return this.record.ownerUserId; }
  get logoutFenced() { return this.record.logoutFence; }
  get canAccess() {
    return (this.status === 'ready' || this.status === 'offline')
      && !this.record.logoutFence && !!this.record.ownerUserId
      && this.authenticatedUserId === this.record.ownerUserId;
  }

  private async persist(record: OwnerRecord) {
    this.record = record;
    const write = this.writes.then(() => this.storage.setItem(LOCAL_DATA_OWNER_KEY, JSON.stringify(record)));
    this.writes = write.catch(() => undefined);
    try { await write; } catch (error) { this.status = 'storage-error'; throw error; }
  }

  async initialize(cachedUserId: string | null, hasExistingData: () => Promise<boolean>) {
    if (this.loaded) return;
    try {
      const raw = await this.storage.getItem(LOCAL_DATA_OWNER_KEY);
      if (raw !== null) {
        const value = JSON.parse(raw) as OwnerRecord;
        if (value.version !== 1 || (value.ownerUserId !== null && typeof value.ownerUserId !== 'string')
          || typeof value.logoutFence !== 'boolean' || typeof value.unclaimed !== 'boolean') throw new Error('Invalid local ownership record');
        this.record = value;
        if (value.unclaimed && value.ownerUserId === null && !await hasExistingData()) {
          // Reclassify a preference-only snapshot, never adopt retained history.
          await this.persist({ ...value, unclaimed: false });
        }
      } else {
        // Only a pre-existing SDK cache can establish ownership of legacy history.
        await this.persist({ ...EMPTY, ownerUserId: cachedUserId, unclaimed: !cachedUserId && await hasExistingData() });
      }
      this.loaded = true;
    } catch (error) { this.status = 'storage-error'; throw error; }
  }

  async accept(userId: string, options: { explicitSignIn?: boolean; offline?: boolean } = {}) {
    if (this.canAccess && this.authenticatedUserId === userId && this.status === (options.offline ? 'offline' : 'ready')) return;
    this.generation += 1;
    this.authenticatedUserId = userId;
    this.status = 'loading';
    if (!this.loaded) throw new Error('Local ownership has not loaded');
    if (this.record.unclaimed) { this.status = 'unclaimed'; return; }
    if (this.record.ownerUserId && this.record.ownerUserId !== userId) { this.status = 'owner-conflict'; return; }
    if (this.record.logoutFence && !options.explicitSignIn) { this.status = 'signed-out'; return; }
    if (!this.record.ownerUserId && !options.explicitSignIn) { this.status = 'unclaimed'; return; }
    const generation = this.generation;
    await this.persist({ ...this.record, ownerUserId: userId, logoutFence: false });
    if (generation !== this.generation) return;
    this.status = options.offline ? 'offline' : 'ready';
  }

  async signOut(status: 'signed-out' | 'invalid' = 'signed-out') {
    if (!this.loaded) {
      this.block('storage-error');
      throw new Error('Account ownership must finish loading before logout can be secured');
    }
    this.generation += 1;
    this.authenticatedUserId = null;
    this.status = status;
    await this.persist({ ...this.record, logoutFence: true });
  }

  block(status: LocalAccessStatus) {
    this.generation += 1;
    this.authenticatedUserId = null;
    this.status = status;
  }

  capture(cloud = false): OwnerLease | null {
    return this.canAccess && (!cloud || this.status === 'ready')
      ? { ownerUserId: this.record.ownerUserId!, generation: this.generation } : null;
  }

  isCurrent(lease: OwnerLease | null, cloud = false): lease is OwnerLease {
    return !!lease && this.canAccess && (!cloud || this.status === 'ready')
      && lease.generation === this.generation && lease.ownerUserId === this.record.ownerUserId;
  }
}

let boundary: LocalDataOwner | null = null;
export function configureLocalDataOwner(storage: OwnerStorage): LocalDataOwner {
  return boundary ??= new LocalDataOwner(storage);
}
export function getLocalDataOwner() { return boundary; }
export function captureOwnerLease(cloud = false) { return boundary?.capture(cloud) ?? null; }
export function ownerLeaseIsCurrent(lease: OwnerLease | null, cloud = false) { return boundary?.isCurrent(lease, cloud) ?? false; }

export function isTerminalSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; code?: string };
  return value.name === 'AuthSessionMissingError' || [
    'session_expired', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used',
    'user_banned', 'user_not_found', 'bad_jwt', 'invalid_jwt',
  ].includes(value.code ?? '');
}

export function localAccessReason(status: LocalAccessStatus): string | null {
  switch (status) {
    case 'owner-conflict': return 'This device retains another account\'s local training data. Sign in with its original account. No history has been moved or deleted.';
    case 'unclaimed': return 'Existing local training data has no verified owner. Restore a verified account backup or explicitly resolve ownership before continuing. No history has been moved or deleted.';
    case 'storage-error': return 'Saved account ownership could not be read or secured. Unlock the device and retry. Saved history has not been cleared.';
    case 'invalid': return 'Your session is no longer valid. Sign in again with the account that owns this device\'s saved training data.';
    default: return null;
  }
}
