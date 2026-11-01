import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { getSupabaseAvailability, getSupabaseConfigAvailability, getSupabaseFunctionUrl, withExplicitAuthAttempt, clearCachedSupabaseSession } from './supabase';
import {
  initializeAccountDeletionControl, prepareDeletionIntent, getDeletionControlRecord,
  assertDeletionReceiptOwner, acceptDeletionReceipt, completeLocalAccountCleanup, reportDeletionError,
} from './accountDeletionControl';
import { parseDeletionRequest, parseDeletionCapabilities, type DeletionCapabilities, type DeletionRequest } from './accountDeletionProtocol';
export type { DeletionRequest } from './accountDeletionProtocol';
type ProviderTokens = { google?: string; appleAuthorizationCode?: string };
export class DeletionHttpError extends Error {
  constructor(readonly status: number) { super('Deletion progress could not be verified. Your saved receipt is retained.'); }
}
let operations: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = operations.then(work); operations = next.catch(() => undefined); return next;
}

/** Capabilities travel in bodies, never URLs. Never surface provider error bodies. */
export async function deletionHttp(endpoint: string, method: 'GET' | 'POST', headers: Record<string, string>, body?: object,
  fetcher: typeof fetch = fetch): Promise<{ request: DeletionRequest | null; capabilities: DeletionCapabilities }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetcher(endpoint, { method, signal: controller.signal,
      headers: { ...headers, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new DeletionHttpError(response.status);
    const result = await response.json();
    if (!result || typeof result !== 'object' || !Object.hasOwn(result, 'request')) throw new Error('Deletion response is incomplete');
    return { request: result.request === null ? null : parseDeletionRequest(result.request), capabilities: parseDeletionCapabilities(result.capabilities) };
  } finally { clearTimeout(timeout); }
}

// The saved deletion owner can authenticate a request/status recovery while all
// ordinary cloud leases are fenced. This never hydrates or exposes training data.
async function verifiedSession(owner: string, pending: boolean) {
  if (pending) await assertDeletionReceiptOwner(owner);
  const available = getSupabaseAvailability();
  const config = getSupabaseConfigAvailability();
  if (available.status !== 'available' || config.status !== 'configured') throw new Error('Sign in online to confirm your deletion request.');
  const { data, error } = await available.client.auth.getSession();
  const session = data.session;
  if (error || session?.user.id !== owner) throw new Error('The saved request requires its original account.');
  const verified = await available.client.auth.getUser(session.access_token);
  if (verified.error || verified.data.user?.id !== owner) throw new Error('Your original account could not be verified.');
  if (pending) await assertDeletionReceiptOwner(owner);
  return { session, user: verified.data.user, headers: { apikey: config.supabaseAnonKey, authorization: `Bearer ${session.access_token}` } };
}
function endpoint(name: string) {
  const url = getSupabaseFunctionUrl(name);
  if (!url) throw new Error('Account deletion is not configured.');
  return url;
}
async function collectProviderTokens(owner: string, capabilities: DeletionCapabilities, allowPrompt: boolean): Promise<ProviderTokens> {
  const { session, user } = await verifiedSession(owner, true);
  const tokens: ProviderTokens = {};
  const identities = user.identities ?? [];
  if (capabilities.googleTokenRevoke && identities.some(identity => identity.provider === 'google') && session.provider_token) tokens.google = session.provider_token;
  if (allowPrompt && capabilities.appleCodeExchange) {
    const apple = identities.find(identity => identity.provider === 'apple');
    const subject = apple?.identity_data?.sub;
    if (typeof subject === 'string' && subject && await AppleAuthentication.isAvailableAsync()) {
      try {
        const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
        await assertDeletionReceiptOwner(owner);
        await verifiedSession(owner, true);
        if (credential.user !== subject) throw new Error('Apple confirmation belongs to another account.');
        if (credential.authorizationCode) tokens.appleAuthorizationCode = credential.authorizationCode;
      } catch (error) {
        // Cancelling optional revocation reauthentication does not cancel the
        // confirmed deletion; missing legacy credentials use server disposition.
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED')) throw error;
      }
    }
  }
  return tokens;
}

async function submitSavedIntent(allowPrompt = false) {
  const saved = getDeletionControlRecord();
  if (!saved) throw new Error('No saved deletion receipt is available');
  const current = await verifiedSession(saved.ownerUserId, true);
  const lookup = await deletionHttp(endpoint('account-deletion'), 'GET', current.headers);
  await assertDeletionReceiptOwner(saved.ownerUserId);
  if (!lookup.capabilities.automaticProcessing) throw new Error('Automatic deletion is not available. Your request has not been confirmed.');
  const providerTokens = await collectProviderTokens(saved.ownerUserId, lookup.capabilities, allowPrompt);
  const authorized = await verifiedSession(saved.ownerUserId, true);
  const result = await deletionHttp(endpoint('account-deletion'), 'POST', authorized.headers, {
    confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: saved.receiptSecret,
    ...(Object.keys(providerTokens).length ? { providerTokens } : {}),
  });
  await assertDeletionReceiptOwner(saved.ownerUserId);
  if (!result.request) throw new Error('The deletion request was not confirmed');
  await acceptDeletionReceipt(result.request, false);
  return result.request;
}

async function poll() {
  await initializeAccountDeletionControl();
  let saved = getDeletionControlRecord();
  if (!saved || saved.phase === 'local_verified') return saved?.request ?? null;
  try {
    await assertDeletionReceiptOwner(saved.ownerUserId);
    if (saved.completionVerified && saved.request?.status === 'completed') {
      await completeLocalAccountCleanup(); return saved.request;
    }
    if (!saved.request) {
      // The server may delete Auth before the first POST response reaches us.
      // Resolve the unique receipt hash without an ID, JWT or identity lookup.
      try {
        const found = await deletionHttp(endpoint('account-deletion-status'), 'POST', {}, { receiptSecret: saved.receiptSecret });
        await assertDeletionReceiptOwner(saved.ownerUserId);
        if (!found.request) throw new Error('Receipt lookup was not confirmed');
        await acceptDeletionReceipt(found.request, true);
      } catch (error) {
        if (!(error instanceof DeletionHttpError) || error.status !== 404) throw error;
        // No confirmed receipt: retry the already-confirmed user intent with
        // the SAME secret. The server rejects any attempt to replace its hash.
        await submitSavedIntent();
      }
      saved = getDeletionControlRecord()!;
      if (saved.completionVerified && saved.request?.status === 'completed') {
        await completeLocalAccountCleanup(); return saved.request;
      }
    }
    if (!saved.request) throw new Error('Request reference is not yet available');
    const response = await deletionHttp(endpoint('account-deletion-status'), 'POST', {}, {
      requestId: saved.request.id, receiptSecret: saved.receiptSecret,
    });
    await assertDeletionReceiptOwner(saved.ownerUserId);
    if (!response.request || response.request.id !== saved.request.id) throw new Error('Deletion receipt identity changed');
    await acceptDeletionReceipt(response.request, true);
    if (response.request.status === 'completed') await completeLocalAccountCleanup();
    return response.request;
  } catch {
    reportDeletionError();
    throw new Error('Deletion progress is not yet confirmed. Your secure receipt is retained for retry.');
  }
}
export function pollAccountDeletion(): Promise<DeletionRequest | null> { return serialize(poll); }

/** Explicit user action only. No polling path collects replacement credentials. */
export function refreshDeletionProviderCredentials(provider: 'apple' | 'google'): Promise<DeletionRequest> {
  return serialize(async () => {
    await initializeAccountDeletionControl();
    const saved = getDeletionControlRecord();
    if (!saved?.request || saved.request.status === 'completed'
      || !saved.request.provider_actions?.some(a => a.provider === provider && a.status === 'pending' && a.reason === 'credential_refresh_required')) {
      throw new Error('This provider does not need fresh credentials. Retry status instead.');
    }
    await assertDeletionReceiptOwner(saved.ownerUserId);
    const available = getSupabaseAvailability();
    if (available.status !== 'available') throw new Error('Connect online before confirming your identity.');
    const auth = await verifiedSession(saved.ownerUserId, true);
    const preflight = await deletionHttp(endpoint('account-deletion'), 'GET', auth.headers);
    await assertDeletionReceiptOwner(saved.ownerUserId);
    if (!preflight.request || preflight.request.id !== saved.request.id
      || !preflight.request.provider_actions?.some(a => a.provider === provider && a.status === 'pending' && a.reason === 'credential_refresh_required')) {
      throw new Error('Provider state changed. Retry status before confirming your identity.');
    }
    if (!preflight.capabilities.providerCredentialRefreshReady) throw new Error('The current processing attempt has not released credential repair. Retry status later.');
    if (!preflight.capabilities.automaticProcessing || (provider === 'apple' ? !preflight.capabilities.appleCodeExchange : !preflight.capabilities.googleTokenRevoke)) {
      throw new Error('Provider repair is not configured on the server. No identity prompt was opened.');
    }
    let active = true;
    const stillCurrent = () => active && getDeletionControlRecord()?.ownerUserId === saved.ownerUserId
      && getDeletionControlRecord()?.request?.id === saved.request!.id;
    let providerTokens: ProviderTokens;
    try {
      providerTokens = await withExplicitAuthAttempt(async () => {
        if (provider === 'apple') {
          if (!await AppleAuthentication.isAvailableAsync()) throw new Error('Apple confirmation is unavailable on this device.');
          const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
          if (!credential.identityToken || !credential.authorizationCode) throw new Error('Apple did not return fresh confirmation credentials.');
          await assertDeletionReceiptOwner(saved.ownerUserId);
          const signed = await available.client.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
          if (signed.error || signed.data.user?.id !== saved.ownerUserId) throw new Error('Choose the Apple account that owns this deletion request.');
          await verifiedSession(saved.ownerUserId, true);
          return { appleAuthorizationCode: credential.authorizationCode };
        }
        const redirectTo = Linking.createURL('auth/callback');
        const oauth = await available.client.auth.signInWithOAuth({ provider: 'google', options: {
          redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' },
        } });
        if (oauth.error || !oauth.data.url) throw new Error('Google confirmation could not start.');
        const result = await WebBrowser.openAuthSessionAsync(oauth.data.url, redirectTo);
        if (result.type !== 'success') throw new Error('Google confirmation was cancelled.');
        const callback = new URL(result.url), expected = new URL(redirectTo);
        if (callback.protocol !== expected.protocol || callback.hostname !== expected.hostname || callback.pathname !== expected.pathname) throw new Error('Unexpected Google confirmation callback.');
        const params = new URLSearchParams(callback.search || callback.hash.slice(1));
        const code = params.get('code');
        const signed = code ? await available.client.auth.exchangeCodeForSession(code)
          : params.get('access_token') && params.get('refresh_token') ? await available.client.auth.setSession({ access_token: params.get('access_token')!, refresh_token: params.get('refresh_token')! }) : null;
        if (!signed || signed.error || signed.data.user?.id !== saved.ownerUserId) {
          // A different login must never adopt retained history or change the
          // deletion owner. Remove only its transient SDK session, not data.
          await available.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
          await clearCachedSupabaseSession();
          throw new Error('Choose the Google account that owns this deletion request.');
        }
        const fresh = await verifiedSession(saved.ownerUserId, true);
        if (!fresh.user.identities?.some(i => i.provider === 'google') || !fresh.session.provider_token) throw new Error('Google did not return a fresh provider token.');
        return { google: fresh.session.provider_token };
      }, stillCurrent);
    } finally { active = false; }
    await assertDeletionReceiptOwner(saved.ownerUserId);
    const authorized = await verifiedSession(saved.ownerUserId, true);
    const result = await deletionHttp(endpoint('account-deletion'), 'POST', authorized.headers, {
      confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: saved.receiptSecret,
      refreshProviderCredentials: true, providerTokens,
    });
    if (!result.request || result.request.id !== saved.request.id) throw new Error('Credential repair was not confirmed.');
    await assertDeletionReceiptOwner(saved.ownerUserId);
    await acceptDeletionReceipt(result.request, false);
    return result.request;
  });
}

export function startAccountDeletion(): Promise<DeletionRequest | null> {
  return serialize(async () => {
    await initializeAccountDeletionControl();
    if (getDeletionControlRecord()) return poll();
    const lease = captureOwnerLease(true);
    if (!lease) throw new Error('Sign in online before requesting account deletion.');
    await requireNoRecording();
    const auth = await verifiedSession(lease.ownerUserId, false);
    const available = await deletionHttp(endpoint('account-deletion'), 'GET', auth.headers);
    if (!ownerLeaseIsCurrent(lease, true)) throw new Error('Your account changed. No new deletion request was sent.');
    if (!available.capabilities.automaticProcessing) throw new Error('Automatic deletion is not available. No new request has been sent.');
    const bytes = await Crypto.getRandomBytesAsync(32);
    if (bytes.length !== 32 || !ownerLeaseIsCurrent(lease, true)) throw new Error('Secure receipt could not be prepared for this account.');
    await requireNoRecording();
    const receiptSecret = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    await prepareDeletionIntent(lease.ownerUserId, receiptSecret);
    try { return await submitSavedIntent(true); }
    catch { reportDeletionError(); throw new Error('The request response is not confirmed. Your saved receipt will be reused when you retry.'); }
  });
}

async function requireNoRecording() {
  const [run, activity, ride, strength] = await Promise.all([
    import('../store/activeRunStore'), import('../store/activeActivityStore'), import('../store/activeIndoorRideStore'), import('../store/activeStrengthSessionStore'),
  ]);
  const { waitForPersistedStoreHydration } = await import('./trackingTaskHydration');
  const stores = [run.useActiveRunStore, activity.useActiveActivityStore, ride.useActiveIndoorRideStore, strength.useActiveStrengthSessionStore];
  if ((await Promise.all(stores.map(store => waitForPersistedStoreHydration(store)))).some(ready => !ready)) throw new Error('Recording state is still loading. Retry after unlocking this device.');
  if (run.useActiveRunStore.getState().isActive || activity.useActiveActivityStore.getState().isActive
    || ride.useActiveIndoorRideStore.getState().isActive || strength.useActiveStrengthSessionStore.getState().session) {
    throw new Error('Save or discard your current workout before requesting account deletion.');
  }
}

/** Compatibility GET never initiates deletion. */
export async function accountDeletionRequest(submit = false): Promise<DeletionRequest | null> {
  if (submit) return startAccountDeletion();
  const lease = captureOwnerLease(true);
  if (!lease) throw new Error('Sign in online to view account deletion status.');
  const auth = await verifiedSession(lease.ownerUserId, false);
  const result = await deletionHttp(endpoint('account-deletion'), 'GET', auth.headers);
  if (!ownerLeaseIsCurrent(lease, true)) throw new Error('Account changed while reading deletion status');
  return result.request;
}
