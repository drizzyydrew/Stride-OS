import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { accountStorageBarrier, runLocalAccountCleanup } from './localAccountCleanup';
import { accountCleanupKeys, ACCOUNT_DOCUMENT_DIRS, ACCOUNT_CACHE_DIRS, accountSessionKeys } from './localAccountCleanupManifest';
import { LOCAL_DATA_OWNER_KEY, getLocalDataOwner, setLocalOwnerAccessGuard, configureLocalOwnerBootstrap } from './localDataOwner';
import { parseDeletionRequest, RECEIPT_SECRET_PATTERN, type DeletionRequest } from './accountDeletionProtocol';

export const ACCOUNT_DELETION_CONTROL_KEY = 'strideos-account-deletion-control-v1';
export type DeletionControlRecord = {
  version: 1; ownerUserId: string; receiptSecret: string; request: DeletionRequest | null;
  phase: 'intent' | 'accepted' | 'purging' | 'local_verified' | 'released'; completionVerified: boolean;
};
export type DeletionControlSnapshot = {
  mode: 'loading' | 'open' | 'pending' | 'purging' | 'restart' | 'error';
  request: DeletionRequest | null; error: string | null; ownerUserId: string | null;
};
let record: DeletionControlRecord | null = null;
let state: DeletionControlSnapshot = { mode: 'loading', request: null, error: null, ownerUserId: null };
const listeners = new Set<() => void>();
let bootstrap: Promise<void> | null = null;
let writes: Promise<unknown> = Promise.resolve();
let cleanup: Promise<void> | null = null;
const secure = {
  getItem: async (key: string) => Platform.OS === 'web'
    ? key === ACCOUNT_DELETION_CONTROL_KEY ? null : globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (key === ACCOUNT_DELETION_CONTROL_KEY) throw new Error('Secure deletion receipts require the native app');
      if (!globalThis.localStorage) throw new Error('Secure receipt storage is unavailable');
      globalThis.localStorage.setItem(key, value);
    } else await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => { if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key); else await SecureStore.deleteItemAsync(key); },
};

function decode(raw: string): DeletionControlRecord {
  const r = JSON.parse(raw) as DeletionControlRecord;
  if (!r || r.version !== 1 || typeof r.ownerUserId !== 'string' || !r.ownerUserId
    || !RECEIPT_SECRET_PATTERN.test(r.receiptSecret) || !['intent', 'accepted', 'purging', 'local_verified', 'released'].includes(r.phase)
    || typeof r.completionVerified !== 'boolean') throw new Error('Saved deletion progress could not be read. It has not been cleared.');
  if (r.request !== null) r.request = parseDeletionRequest(r.request);
  if (r.completionVerified && r.request?.status !== 'completed') throw new Error('Saved deletion completion is inconsistent');
  return r;
}
function publish(mode: DeletionControlSnapshot['mode'], error: string | null = null) {
  accountStorageBarrier.setMode(mode);
  state = { mode, request: record?.request ?? null, ownerUserId: record?.ownerUserId ?? null, error };
  listeners.forEach(fn => fn());
}
setLocalOwnerAccessGuard(() => state.mode === 'open');
configureLocalOwnerBootstrap(initializeAccountDeletionControl);
export const accountDeletionControl = { getSnapshot: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; } };

async function save(next: DeletionControlRecord) {
  const raw = JSON.stringify(next);
  decode(raw);
  const work = writes.then(async () => {
    const previous = await secure.getItem(ACCOUNT_DELETION_CONTROL_KEY);
    if (previous) {
      const existing = decode(previous);
      if (existing.phase !== 'released' && (existing.ownerUserId !== next.ownerUserId || existing.receiptSecret !== next.receiptSecret)) {
        throw new Error('This device has another deletion receipt. No capability has been replaced.');
      }
    }
    await secure.setItem(ACCOUNT_DELETION_CONTROL_KEY, raw);
    if (await secure.getItem(ACCOUNT_DELETION_CONTROL_KEY) !== raw) throw new Error('Deletion progress could not be confirmed. Retry without creating a new receipt.');
    record = decode(raw);
  });
  writes = work.catch(() => undefined);
  await work;
}

async function readOwner() {
  const raw = await secure.getItem(LOCAL_DATA_OWNER_KEY);
  if (!raw) return null;
  const owner = JSON.parse(raw) as { version: number; ownerUserId: string | null; logoutFence: boolean; unclaimed: boolean };
  if (owner.version !== 1 || (owner.ownerUserId !== null && typeof owner.ownerUserId !== 'string') || typeof owner.logoutFence !== 'boolean') throw new Error('Saved ownership could not be verified');
  return owner;
}
async function assertOwner(owner: string) {
  if ((await readOwner())?.ownerUserId !== owner || record?.ownerUserId !== owner) throw new Error('The retained owner changed. Local cleanup stopped.');
}
export const assertDeletionReceiptOwner = assertOwner;
async function sessionKeys() {
  const { supabaseSessionStorageKey } = await import('./supabase');
  return accountSessionKeys(supabaseSessionStorageKey());
}
async function verifyCredentials() {
  for (const key of await sessionKeys()) if (await secure.getItem(key) !== null) throw new Error('Local credentials remain. Cleanup will retry.');
}
async function mediaPaths() {
  const fs = await import('expo-file-system/legacy');
  if (!fs.documentDirectory || !fs.cacheDirectory) throw new Error('App-owned media storage is not available to verify');
  const reports = (await fs.readDirectoryAsync(fs.cacheDirectory)).filter(name => /^strideos-[a-z0-9_-]+\.png$/i.test(name));
  return { fs, paths: [...ACCOUNT_DOCUMENT_DIRS.map(dir => `${fs.documentDirectory}${dir}/`), ...ACCOUNT_CACHE_DIRS.map(dir => `${fs.cacheDirectory}${dir}/`),
    ...reports.map(name => `${fs.cacheDirectory}${name}`)] };
}
async function verifyMedia() {
  const { fs, paths } = await mediaPaths();
  for (const path of paths) if ((await fs.getInfoAsync(path)).exists) throw new Error('App-owned media remains. Cleanup will retry.');
}
async function verifyAbsent(owner: string) {
  if (accountCleanupKeys(await AsyncStorage.getAllKeys(), owner).length) throw new Error('Local account records remain. Cleanup will retry.');
  await verifyCredentials();
  await verifyMedia();
}

export function initializeAccountDeletionControl(): Promise<void> {
  if (bootstrap) return bootstrap;
  bootstrap = (async () => {
    try {
      const raw = await secure.getItem(ACCOUNT_DELETION_CONTROL_KEY);
      record = raw ? decode(raw) : null;
      if (!record || record.phase === 'released') { publish('open'); return; }
      if (record.phase === 'local_verified') {
        // This branch is reachable only on a fresh JS bootstrap. The previous
        // runtime never unlocks its old in-memory stores after a purge.
        publish('restart');
        const owner = await readOwner();
        if (owner?.ownerUserId != null && owner.ownerUserId !== record.ownerUserId) throw new Error('Ownership changed before cleanup verification');
        try { await verifyAbsent(record.ownerUserId); }
        catch {
          // A late native/cache writer in the old runtime may have finished
          // after the first verification. Never release its owner over residue.
          await assertOwner(record.ownerUserId);
          await save({ ...record, phase: 'purging' });
          publish('purging');
          return;
        }
        await secure.removeItem(LOCAL_DATA_OWNER_KEY); // release owner LAST
        if (await secure.getItem(LOCAL_DATA_OWNER_KEY) !== null) throw new Error('Owner release could not be confirmed');
        await save({ ...record, phase: 'released' });
        publish('open');
        return;
      }
      await assertOwner(record.ownerUserId);
      publish(record.phase === 'purging' ? 'purging' : 'pending');
      getLocalDataOwner()?.block('signed-out');
    } catch {
      publish('error', 'Saved deletion or ownership progress could not be verified. Unlock this device and retry. Cleanup and account access remain locked.');
      bootstrap = null;
      throw new Error('Deletion startup verification is incomplete');
    }
  })();
  return bootstrap;
}

/** Private capability getter: do not send this object to logs, UI or analytics. */
export function getDeletionControlRecord(): DeletionControlRecord | null { return record && record.phase !== 'released' ? JSON.parse(JSON.stringify(record)) : null; }
export async function prepareDeletionIntent(ownerUserId: string, receiptSecret: string) {
  if (Platform.OS === 'web') throw new Error('Use the native StrideOS app to keep a secure deletion receipt.');
  await initializeAccountDeletionControl();
  if (record && record.phase !== 'released') {
    if (record.ownerUserId !== ownerUserId) throw new Error('This device retains another account’s deletion receipt');
    return;
  }
  // Cancel captured work before native receipt I/O. A failed save followed by
  // reopening access must never make an old generation current again.
  getLocalDataOwner()?.block('signed-out');
  publish('pending');
  try {
    await save({ version: 1, ownerUserId, receiptSecret, request: null, phase: 'intent', completionVerified: false });
    publish('pending');
  } catch {
    publish('error', 'The secure deletion receipt could not be confirmed. Retry to recover it; no server request has been sent.');
    bootstrap = null;
    throw new Error('Secure deletion receipt was not confirmed');
  }
}
export async function acceptDeletionReceipt(request: DeletionRequest, capabilityVerified: boolean) {
  if (!record || record.phase === 'released' || (record.request && record.request.id !== request.id)) throw new Error('Deletion receipt does not match the saved request');
  const parsed = parseDeletionRequest(request);
  await save({ ...record, request: parsed, phase: record.phase === 'intent' ? 'accepted' : record.phase,
    completionVerified: record.completionVerified || (capabilityVerified && parsed.status === 'completed') });
  publish(record.phase === 'local_verified' ? 'restart' : record.phase === 'purging' ? 'purging' : 'pending');
}
export function reportDeletionError() {
  // Network and native errors may contain request details: never publish them.
  publish(state.mode === 'restart' ? 'restart' : state.mode === 'purging' ? 'purging' : 'pending',
    'Progress could not be confirmed. Your receipt is saved. Retry when online and the device is unlocked.');
}

export function completeLocalAccountCleanup(): Promise<void> {
  if (cleanup) return cleanup;
  cleanup = (async () => {
    const r = record;
    if (!r || !r.request || !r.completionVerified || r.request.status !== 'completed') throw new Error('Verified server completion is required');
    if (r.phase === 'local_verified') { publish('restart'); return; }
    await runLocalAccountCleanup({ ownerUserId: r.ownerUserId, requestId: r.request.id, serverCompleted: true }, {
      assertOwner,
      persistPurging: async () => { await save({ ...record!, phase: 'purging' }); publish('purging'); },
      fence: async () => {
        getLocalDataOwner()?.block('signed-out');
        const owner = await readOwner();
        if (!owner || owner.ownerUserId !== r.ownerUserId) throw new Error('Cleanup owner changed');
        const { useAuthStore } = await import('../store/authStore');
        await useAuthStore.getState().lockForAccountDeletion();
        const fenced = await readOwner();
        if (fenced?.ownerUserId !== r.ownerUserId || !fenced.logoutFence) throw new Error('Owner fence was not confirmed');
      },
      quiesce: async () => {
        const [{ aiConsent }, { observabilityConsent }, gps, outdoor, notifications, supabase] = await Promise.all([
          import('../store/aiConsentStore'), import('../store/observabilityConsentStore'), import('./gpsTracking'),
          import('./activityGpsTracking'), import('./notifications'), import('./supabase'),
        ]);
        const available = supabase.getSupabaseAvailability();
        if (available.status === 'available') available.client.auth.stopAutoRefresh();
        await Promise.all([aiConsent.setOwner(null), observabilityConsent.setOwner(null), gps.stopLocationTracking(),
          outdoor.stopActivityLocationTracking(), notifications.clearTrainingNotifications()]);
      },
      drain: async () => {
        const [strava, supabase] = await Promise.all([import('./strava'), import('./supabase')]);
        await Promise.all([accountStorageBarrier.drain(), strava.drainStravaCredentialWrites(), supabase.drainSupabaseCredentialWrites()]);
      },
      keys: async () => [...await AsyncStorage.getAllKeys()],
      removeKey: key => AsyncStorage.removeItem(key), readKey: key => AsyncStorage.getItem(key),
      removeCredentials: async () => { for (const key of await sessionKeys()) await secure.removeItem(key); },
      verifyCredentials,
      removeMedia: async () => { const { fs, paths } = await mediaPaths(); for (const path of paths) await fs.deleteAsync(path, { idempotent: true }); },
      verifyMedia,
      persistVerified: async () => { await save({ ...record!, phase: 'local_verified' }); publish('restart'); },
    });
  })().catch(error => { reportDeletionError(); throw error; }).finally(() => { cleanup = null; });
  return cleanup;
}
