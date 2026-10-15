import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import {
  getSupabaseAvailability, supabaseUnavailableMessage, localDataOwner,
  initializeLocalOwnership, readCachedSupabaseSession, clearCachedSupabaseSession,
  withExplicitAuthAttempt, isExplicitAuthAttempt,
} from '../lib/supabase';
import { isTerminalSessionError, localAccessReason, type LocalAccessStatus } from '../lib/localDataOwner';
import {
  authRedirectUrl,
  completeSupabaseAuthFromUrl,
  hydrateUserData,
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
const STALE_AUTH_ATTEMPT = 'This sign-in was cancelled by logout or a newer sign-in. Please retry.';
function beginAuthAttempt() {
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
    catch { localDataOwner.block('storage-error'); }
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
    localDataOwner.block('storage-error');
    publishAccess();
    return localAccessReason('storage-error');
  }
  const availability = getSupabaseAvailability();
  if (reason && availability.status === 'available') availability.client.auth.stopAutoRefresh();
  return reason;
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
    if (initialization) return initialization;
    initialization = (async () => {
      const generation = ++authGeneration;
      let cached: Session | null = null;
      try {
        await initializeLocalOwnership();
        cached = await readCachedSupabaseSession();
        const supabaseState = getSupabaseAvailability();
        if (supabaseState.status !== 'available') {
          localDataOwner.block('signed-out');
          publishAccess();
          return;
        }
        const { client: supabase } = supabaseState;
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

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error?.message ?? null;
  },

  signInWithApple: async () => {
    const attempt = beginAuthAttempt();
    await useAuthStore.getState().initialize();
    if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
    const supabaseState = getSupabaseAvailability();
    if (supabaseState.status !== 'available') return supabaseUnavailableMessage('Apple sign in');
    const { client: supabase } = supabaseState;

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
      if (!credential.identityToken) return 'Apple sign in failed — no token returned.';
      const identityToken = credential.identityToken;
      const { data, error } = await withExplicitAuthAttempt(() => supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      }), () => attempt === authAttemptGeneration);
      if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
      return error?.message ?? await finishExplicitSignIn(data.session, attempt);
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return null;
      return e.message ?? 'Apple sign in failed.';
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
        const completion = await withExplicitAuthAttempt(() => completeSupabaseAuthFromUrl(result.url), () => attempt === authAttemptGeneration);
        if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
        if (completion.error) return completion.error;
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (attempt !== authAttemptGeneration) return STALE_AUTH_ATTEMPT;
        return sessionError?.message ?? await finishExplicitSignIn(data.session, attempt);
      }
      return null;
    } catch (e: any) {
      return e.message ?? 'Google sign in failed.';
    }
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
