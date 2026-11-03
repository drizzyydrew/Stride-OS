import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { APPLE_SIGN_IN_INCOMPLETE, sameAppleSignInSession, signInWithCapturedAppleGrant } from '../lib/appleSignInFlow';
import {
  getSupabaseAvailability, getSupabaseConfigAvailability, supabaseUnavailableMessage, localDataOwner,
  initializeLocalOwnership, readCachedSupabaseSession, clearCachedSupabaseSession,
  withExplicitAuthAttempt, isExplicitAuthAttempt,
} from '../lib/supabase';
import { isTerminalSessionError, localAccessReason, initializeLocalOwnerBoundary, localOwnerAccessAllowed, type LocalAccessStatus } from '../lib/localDataOwner';
import {
  authRedirectUrl,
  completeSupabaseAuthFromUrl,
  hydrateUserData,
  authCallbackKey,
  isAuthCallbackUrl,
  type AuthCompletionResult,
} from '../lib/authRedirect';
import { useWorkoutStore } from './workoutStore';
import { useStrengthStore } from './strengthStore';
import { useCustomWorkoutStore } from './customWorkoutStore';
import { useCheckInStore } from './checkInStore';

type AuthStore = {
  session:         Session | null;
  user:            User | null;
  loading:         boolean;
  canAccessLocalData: boolean;
  localAccessStatus: LocalAccessStatus;
  localAccessReason: string | null;
  offlineOwnerId: string | null;
  initialize:      () => Promise<void>;
  signIn:          (email: string, password: string) => Promise<string | null>;
  signUp:          (email: string, password: string) => Promise<string | null>;
  signOut:         () => Promise<void>;
  lockForAccountDeletion: () => Promise<void>;
  resetPassword:   (email: string) => Promise<string | null>;
  resendConfirmation: (email: string) => Promise<string | null>;
  updatePassword:  (newPassword: string) => Promise<string | null>;
  signInWithApple: () => Promise<string | null>;
  signInWithGoogle:() => Promise<string | null>;
};

let initialization: Promise<void> | null = null;
let authGeneration = 0;
let authAttemptGeneration = 0;
let authListenerInstalled = false;
let recoverySession: { userId: string; attempt: number } | null = null;
let appleRevokeListenerInstalled = false;
const STALE_AUTH_ATTEMPT = 'This sign-in was cancelled by logout or a newer sign-in. Please retry.';
function beginAuthAttempt() {
  recoverySession = null;
  authGeneration += 1;
  return ++authAttemptGeneration;
}

function publishAccess(session: Session | null = null, user: User | null = session?.user ?? null) {
  const canAccessLocalData = localDataOwner.canAccess;
  useAuthStore.setState({
    session: canAccessLocalData ? session : null,
    user: canAccessLocalData ? user : null, loading: false,
    canAccessLocalData,
    localAccessStatus: localDataOwner.status,
    localAccessReason: localAccessReason(localDataOwner.status),
    offlineOwnerId: localDataOwner.status === 'offline' ? localDataOwner.ownerUserId : null,
  });
}

async function acceptSession(session: Session, explicitSignIn = false, offline = false): Promise<string | null> {
  const generation = ++authGeneration;
  await localDataOwner.accept(session.user.id, { explicitSignIn, offline });
  if (generation !== authGeneration) return 'The account changed. Please retry.';
  if (localDataOwner.canAccess) {
    try { await useWorkoutStore.getState().restorePendingCompletions(); }
    catch {
      if (generation !== authGeneration) return 'The account changed. Please retry.';
      localDataOwner.block('storage-error');
    }
  }
  if (generation !== authGeneration) return 'The account changed. Please retry.';
  publishAccess(offline ? null : session, session.user);
  if (localDataOwner.canAccess && !offline) {
    // Every cloud read is owner-fenced; no unowned records are adopted on login.
    void hydrateUserData().catch(() => undefined);
  }
  return localAccessReason(localDataOwner.status);
}

async function finishExplicitSignIn(session: Session | null, attempt: number): Promise<string | null> {
  if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
  if (!session) return null;
  let reason: string | null;
  try { reason = await acceptSession(session, true); }
  catch {
    if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
    localDataOwner.block('storage-error');
    publishAccess();
    return localAccessReason('storage-error');
  }
  const availability = getSupabaseAvailability();
  if (reason && attempt === authAttemptGeneration && availability.status === 'available') availability.client.auth.stopAutoRefresh();
  return reason;
}

// One owner for native/OAuth link exchange and local acceptance. A cold-start
// session event must not race the same one-use link or bypass a logout fence.
let linkedAttempt: { key: string; attempt: number; ownerGeneration: number; expires: number; cancel: (reason: string) => void; promise: Promise<AuthCompletionResult> } | null = null;
export function cancelAuthLink(url: string, reason = 'This sign-in was cancelled. Request a new link.'): void {
  if (isAuthCallbackUrl(url) && linkedAttempt?.key === authCallbackKey(url) && linkedAttempt.expires === Infinity) linkedAttempt.cancel(reason);
}
export function completeAuthLink(url: string, existingAttempt?: number): Promise<AuthCompletionResult> {
  if (!isAuthCallbackUrl(url)) return Promise.resolve({ handled: false, recovery: false, error: 'This link is not a StrideOS sign-in callback.' });
  if (localOwnerAccessAllowed && !localOwnerAccessAllowed(null)) return Promise.resolve({ handled: true, recovery: false, error: 'Finish the pending account recovery or deletion before signing in.' });
  const key = authCallbackKey(url);
  if (linkedAttempt?.key === key && linkedAttempt.attempt === authAttemptGeneration
    && (linkedAttempt.expires === Infinity || linkedAttempt.ownerGeneration === localDataOwner.accessGeneration)
    && linkedAttempt.expires > Date.now()) return linkedAttempt.promise;
  const attempt = existingAttempt ?? beginAuthAttempt();
  let cancelled = false, accepting = false;
  let acceptedUserId: string | null = null;
  const current = () => !cancelled && attempt === authAttemptGeneration;
  const failure = (error: string): AuthCompletionResult => ({ handled: true, recovery: false, error });
  let timer: ReturnType<typeof setTimeout>;
  let cancel = (_reason: string) => {};
  const deadline = new Promise<AuthCompletionResult>(resolve => {
    cancel = reason => {
      if (cancelled) return;
      cancelled = true;
      if (attempt === authAttemptGeneration) {
        authAttemptGeneration += 1;
        authGeneration += 1;
        if (accepting) {
          // A pending completion restore must not leave a restart-reusable
          // login after this attempt expires. Preserve data and fence access
          // durably; never erase a newer attempt's credentials during cleanup.
          const cancellationGeneration = authAttemptGeneration;
          const fence = localDataOwner.signOut();
          publishAccess();
          const cleanup = withExplicitAuthAttempt(async () => {
            if (cancellationGeneration !== authAttemptGeneration) return;
            const cached = await readCachedSupabaseSession();
            if (cancellationGeneration === authAttemptGeneration && cached?.user.id === acceptedUserId) await clearCachedSupabaseSession();
          }, () => cancellationGeneration === authAttemptGeneration);
          // Bound the UI independently, but do not report secured cancellation
          // until its durable fence/credential cleanup have actually settled.
          void Promise.allSettled([fence, cleanup]).then(results => {
            if (cancellationGeneration === authAttemptGeneration && results.some(result => result.status === 'rejected')) {
              localDataOwner.block('storage-error'); publishAccess();
              resolve(failure('Device storage could not secure sign-in. Please contact StrideOS support before continuing.'));
            } else resolve(failure(reason));
          });
          return;
        }
      }
      resolve(failure(reason));
    };
    timer = setTimeout(() => cancel('Sign-in is taking longer than expected. Go back and request a new reset link.'), 20_000);
  });
  const work = (async (): Promise<AuthCompletionResult> => {
    await useAuthStore.getState().initialize();
    if (!current()) return failure(STALE_AUTH_ATTEMPT);
    const availability = getSupabaseAvailability();
    if (availability.status !== 'available') return failure(supabaseUnavailableMessage('Sign in'));
    const result = await withExplicitAuthAttempt(async () => {
      const completion = await completeSupabaseAuthFromUrl(url);
      if (completion.error || !completion.handled || !current()) return { completion, session: null };
      if (!completion.verifiedSession) return { completion: failure('This link did not create a session. Request a new link.'), session: null };
      return { completion, session: completion.verifiedSession };
    }, current);
    if (!current()) return failure(STALE_AUTH_ATTEMPT);
    if (result.completion.error || !result.completion.handled) return result.completion;
    accepting = true;
    acceptedUserId = result.session?.user.id ?? null;
    const reason = await finishExplicitSignIn(result.session, attempt);
    if (!current()) return failure(STALE_AUTH_ATTEMPT);
    if (!reason && result.completion.recovery && result.session) recoverySession = { userId: result.session.user.id, attempt };
    // Do not cache credentials in the duplicate-delivery result.
    return { handled: result.completion.handled, recovery: result.completion.recovery, error: reason };
  })().catch(() => failure('This sign-in link could not finish. Request a new link and try again.'));
  const entry = { key, attempt, ownerGeneration: localDataOwner.accessGeneration, expires: Infinity, cancel, promise: Promise.resolve(failure('Sign-in is pending.')) };
  entry.promise = Promise.race([work.then(result => cancelled ? deadline : result), deadline]).then(result => {
    clearTimeout(timer!);
    entry.expires = Date.now() + 30_000;
    entry.ownerGeneration = localDataOwner.accessGeneration;
    if (result.error && linkedAttempt === entry) linkedAttempt = null;
    return result;
  });
  linkedAttempt = entry;
  return entry.promise;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user:    null,
  loading: true,
  canAccessLocalData: false,
  localAccessStatus: 'loading',
  localAccessReason: null,
  offlineOwnerId: null,

  initialize: async () => {
    if (initialization) {
      if (!localDataOwner.canAccess) publishAccess();
      return initialization;
    }
    initialization = (async () => {
      const generation = ++authGeneration;
      let cached: Session | null = null;
      try {
        await initializeLocalOwnerBoundary?.();
        if (localOwnerAccessAllowed && !localOwnerAccessAllowed(null)) {
          localDataOwner.block('signed-out'); publishAccess(); return;
        }
        await initializeLocalOwnership();
        cached = await readCachedSupabaseSession();
        const supabaseState = getSupabaseAvailability();
        if (supabaseState.status !== 'available') {
          localDataOwner.block('signed-out');
          publishAccess();
          return;
        }
        const { client: supabase } = supabaseState;
        if (!appleRevokeListenerInstalled) {
          // Ordinary provider revocation only signs out. A pending deletion
          // polls its receipt; a notification alone never authorizes a purge.
          try {
            AppleAuthentication.addRevokeListener(() => {
              if (localOwnerAccessAllowed && !localOwnerAccessAllowed(null)) {
                void import('../lib/accountDeletion').then(api => api.pollAccountDeletion()).catch(() => undefined);
              } else if (useAuthStore.getState().user?.identities?.some(identity => identity.provider === 'apple')) {
                void useAuthStore.getState().signOut().catch(() => undefined);
              }
            });
            appleRevokeListenerInstalled = true;
          } catch { /* Non-Apple platforms have no native revocation listener. */ }
        }
        if (!authListenerInstalled) {
        authListenerInstalled = true;
        supabase.auth.onAuthStateChange((event, session) => {
          if (isExplicitAuthAttempt()) return;
          const eventGeneration = authGeneration;
          // Avoid awaiting SDK work inside its own auth notification callback.
          setTimeout(() => {
            if (eventGeneration !== authGeneration) return;
            if (event === 'SIGNED_OUT') {
              if (localDataOwner.logoutFenced) { publishAccess(); return; }
              authGeneration += 1;
              const fence = localDataOwner.signOut('invalid');
              publishAccess();
              void fence.then(() => publishAccess()).catch(() => publishAccess());
            } else if (session && !localDataOwner.logoutFenced && event !== 'INITIAL_SESSION') {
              void acceptSession(session).catch(() => { localDataOwner.block('storage-error'); publishAccess(); });
            }
          }, 0);
        });
        }
        if (localDataOwner.logoutFenced) {
          supabase.auth.stopAutoRefresh();
          localDataOwner.block('signed-out');
          publishAccess();
          return;
        }
        const { data: { session }, error } = await supabase.auth.getSession();
        if (generation !== authGeneration) return;
        if (session) await acceptSession(session);
        else if (error && isAuthRetryableFetchError(error) && cached) await acceptSession(cached, false, true);
        else if (error && isAuthRetryableFetchError(error)) { localDataOwner.block('signed-out'); publishAccess(); }
        else if (isTerminalSessionError(error)) { await localDataOwner.signOut('invalid'); publishAccess(); }
        else if (error) { localDataOwner.block('storage-error'); publishAccess(); initialization = null; }
        else { localDataOwner.block('signed-out'); publishAccess(); }
      } catch (error) {
        if (isAuthRetryableFetchError(error) && cached && !localDataOwner.logoutFenced) {
          await acceptSession(cached, false, true);
          return;
        }
        localDataOwner.block('storage-error');
        publishAccess();
        initialization = null;
      }
    })();
    return initialization;
  },

  signIn: async (email, password) => {
    const attempt = beginAuthAttempt();
    await useAuthStore.getState().initialize();
    if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Sign in');
    const { client: supabase } = supabaseState;

    try {
      const { data, error } = await withExplicitAuthAttempt(() => supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }), () => attempt === authAttemptGeneration);
      if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
      return error?.message ?? await finishExplicitSignIn(data.session, attempt);
    } catch (error) {
      return attempt !== authAttemptGeneration ? STALE_AUTH_ATTEMPT : error instanceof Error ? error.message : 'Sign in could not finish. Please retry.';
    }
  },

  signUp: async (email, password) => {
    const attempt = beginAuthAttempt();
    await useAuthStore.getState().initialize();
    if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Account creation');
    const { client: supabase } = supabaseState;

    const normalizedEmail = email.trim().toLowerCase();
    try {
    const { data, error } = await withExplicitAuthAttempt(() => supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
      },
    }), () => attempt === authAttemptGeneration);
    if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
    if (error) return error.message;
    // If session is immediately set, email confirmation is disabled — auto-login happened
    return finishExplicitSignIn(data.session, attempt);
    } catch (error) {
      return attempt !== authAttemptGeneration ? STALE_AUTH_ATTEMPT : error instanceof Error ? error.message : 'Account creation could not finish. Please retry.';
    }
  },

  resetPassword: async (email) => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Password reset');
    const { client: supabase } = supabaseState;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: authRedirectUrl(),
    });
    return error?.message ?? null;
  },

  resendConfirmation: async (email) => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Email confirmation');
    const { client: supabase } = supabaseState;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: authRedirectUrl(),
      },
    });
    return error?.message ?? null;
  },

  updatePassword: async (newPassword) => {
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Password update');
    const { client: supabase } = supabaseState;

    const recovery = recoverySession;
    const current = () => recovery !== null && recovery === recoverySession
      && recovery.attempt === authAttemptGeneration && localDataOwner.canAccess
      && localDataOwner.ownerUserId === recovery.userId;
    if (!current()) return 'Request a new password-reset link before changing your password.';
    try {
      const error = await withExplicitAuthAttempt(async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error || !current() || data.session?.user.id !== recovery!.userId) return 'The account changed. Request a new reset link.';
        const result = await supabase.auth.updateUser({ password: newPassword });
        if (!current()) return 'The account changed. Request a new reset link.';
        const after = await supabase.auth.getSession();
        if (after.error || !current() || after.data.session?.user.id !== recovery!.userId) return 'The account changed. Request a new reset link.';
        return result.error?.message ?? null;
      }, current);
      if (!current()) return 'The account changed. Request a new reset link.';
      if (!error) recoverySession = null;
      return error;
    } catch { return 'The password update could not finish. Request a new reset link and try again.'; }
  },

  signInWithApple: async () => {
    const attempt = beginAuthAttempt();
    await useAuthStore.getState().initialize();
    if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Apple sign in');
    const { client: supabase } = supabaseState;

    try {
      const Crypto = await import('expo-crypto');
      const config = getSupabaseConfigAvailability();
      if (config.status !== 'configured') return supabaseUnavailableMessage('Apple sign in');
      // A process exit before grant capture must not leave a usable persisted login.
      const transient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      let commitStarted = false;
      let partialCommit: Session | null = null;
      const session = await signInWithCapturedAppleGrant<Session>({
        randomBytes: Crypto.getRandomBytesAsync,
        sha256: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
        authorize: challenge => AppleAuthentication.signInAsync({
          ...challenge,
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        }),
        current: () => attempt === authAttemptGeneration,
        exclusive: work => withExplicitAuthAttempt(work, () => attempt === authAttemptGeneration),
        authenticate: credentials => transient.auth.signInWithIdToken({ provider: 'apple', ...credentials }),
        capture: async (created, body) => {
          const result = await transient.functions.invoke('apple-grant', {
            headers: { Authorization: `Bearer ${created.access_token}` }, body, timeout: 15_000,
          });
          if (result.error) throw new Error(APPLE_SIGN_IN_INCOMPLETE);
          return result.data;
        },
        commitSession: async created => {
          commitStarted = true;
          const result = await supabase.auth.setSession({ access_token: created.access_token, refresh_token: created.refresh_token });
          partialCommit = result.data.session;
          if (result.error || !partialCommit) throw new Error(APPLE_SIGN_IN_INCOMPLETE);
          return partialCommit;
        },
        discardPartialSession: async created => {
          // The transient client never writes device credentials. Revoke only
          // its Supabase session; never unlink Apple or delete the Auth account.
          void transient.auth.signOut({ scope: 'local' }).catch(() => undefined);
          if (!commitStarted) return;
          const expected = partialCommit ?? created;
          const { data } = await supabase.auth.getSession();
          // setSession may refresh and persist before throwing. Match that
          // session's owner + issuer + session_id, never merely its owner.
          if (attempt !== authAttemptGeneration || !sameAppleSignInSession(expected, data.session)) return;
          const fence = localDataOwner.signOut();
          publishAccess();
          supabase.auth.stopAutoRefresh();
          try { await fence; }
          finally {
            // Remove the durable partial session before SDK logout can await a
            // network response. Restart must remain signed out even offline.
            try { await clearCachedSupabaseSession(); }
            finally { publishAccess(); }
            await supabase.auth.signOut({ scope: 'local' });
          }
        },
      });
      if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
      return finishExplicitSignIn(session, attempt);
    } catch (e: any) {
      if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
      if (e.code === 'ERR_REQUEST_CANCELED') return null;
      return APPLE_SIGN_IN_INCOMPLETE;
    }
  },

  signInWithGoogle: async () => {
    const attempt = beginAuthAttempt();
    await useAuthStore.getState().initialize();
    if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Google sign in');
    const { client: supabase } = supabaseState;

    try {
      const redirectTo = authRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
      if (error || !data.url) return error?.message ?? 'Google sign in failed.';
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
      if (result.type === 'success') {
        const completion = await completeAuthLink(result.url, attempt);
        if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
        return completion.error;
      }
      return null;
    } catch (e: any) {
      return e.message ?? 'Google sign in failed.';
    }
  },

  lockForAccountDeletion: async () => {
    authAttemptGeneration += 1;
    authGeneration += 1;
    await initializeLocalOwnership();
    const fence = localDataOwner.signOut();
    publishAccess();
    await fence;
    const available = getSupabaseAvailability();
    if (available.status === 'available') {
      available.client.auth.stopAutoRefresh();
      // Drain the SDK auth lock and our explicit exchange queue before removing
      // credentials; stale exchanges observe the cancelled attempt generation.
      await available.client.auth.getSession().catch(() => undefined);
    }
    await withExplicitAuthAttempt(async () => undefined);
    publishAccess();
  },

  signOut: async () => {
    authAttemptGeneration += 1;
    authGeneration += 1;
    const fence = localDataOwner.signOut();
    publishAccess();
    await fence;
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status === 'available') {
      supabaseState.client.auth.stopAutoRefresh();
      try { await supabaseState.client.auth.signOut(); } finally { await clearCachedSupabaseSession(); }
    } else {
      await clearCachedSupabaseSession();
    }
    publishAccess();
    // Local training history is intentionally kept on sign-out. Clearing it
    // here (then "restoring" from an empty cloud on sign-in) destroyed data.
  },
}));

// The outer deletion gate can cancel ownership without calling an auth action.
// Revoke navigation/bridge access synchronously, including a failed intent save
// whose retry later remounts the existing auth store in this JS runtime.
localDataOwner.onInvalidated?.(() => { publishAccess(); });
