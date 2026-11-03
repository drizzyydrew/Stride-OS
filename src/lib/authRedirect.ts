import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { getSupabaseAvailability, supabaseUnavailableMessage } from './supabase';
import { hydrateFromSupabase } from './syncService';
import { ownerLeaseIsCurrent } from './localDataOwner';
import { useCheckInStore } from '../store/checkInStore';
import { useCustomWorkoutStore } from '../store/customWorkoutStore';
import { useStrengthStore } from '../store/strengthStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useActivityStore } from '../store/activityStore';

export const AUTH_CALLBACK_PATH = 'auth/callback';

export type AuthCompletionResult = {
  handled: boolean;
  recovery: boolean;
  error: string | null;
};
type AuthExchangeResult = AuthCompletionResult & { verifiedSession?: Session };

export function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'strideos:') return `${parsed.host}${parsed.pathname}`.replace(/^\/+|\/+$/g, '') === AUTH_CALLBACK_PATH;
    const expected = new URL(authRedirectUrl());
    return parsed.protocol === expected.protocol && parsed.host === expected.host && parsed.pathname === expected.pathname;
  } catch { return false; }
}

// Remember OS event delivery separately from getInitialURL(): on a later route
// mount, the latter still describes the original launch, not the newest email.
let latestAuthCallbackUrl: string | null = null;
export function rememberAuthCallbackUrl(url: string, initial = false): void {
  if (isAuthCallbackUrl(url) && (!initial || latestAuthCallbackUrl === null)) latestAuthCallbackUrl = url;
}
export function resolveAuthCallbackUrl(routeUrl: string, incoming?: string | null, initial?: string | null): string {
  const raw = [latestAuthCallbackUrl, incoming, initial].find((url): url is string => Boolean(url && isAuthCallbackUrl(url)));
  if (!raw) return routeUrl;
  const route = authParams(routeUrl), delivered = authParams(raw);
  // Identifiable current route credentials win over an old initial URL.
  for (const field of ['code', 'access_token', 'refresh_token']) {
    if (route.has(field) && route.get(field) !== delivered.get(field)) return routeUrl;
  }
  return raw;
}

export function authRedirectUrl(path = AUTH_CALLBACK_PATH): string {
  return Linking.createURL(path);
}

function authParams(url: string): URLSearchParams {
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const hash = url.split('#')[1] ?? '';
  const params = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);
  hashParams.forEach((value, key) => params.set(key, value));
  return params;
}

export async function hydrateUserData(): Promise<void> {
  const result = await hydrateFromSupabase();
  if (!ownerLeaseIsCurrent(result.ownerLease, true)) {
    throw new Error('Account changed during cloud restore. Please retry.');
  }
  useWorkoutStore.getState().hydrateWorkouts(result.workoutLogs);
  useStrengthStore.getState().hydrateStrength(result.strengthLogs);
  useCustomWorkoutStore.getState().hydrateLogs(result.customLogs);
  useCheckInStore.getState().hydrateCheckIns(result.checkIns);
  useActivityStore.getState().mergeRestoredActivities(result.activities);
}

export function authCallbackKey(url: string): string {
  const params = authParams(url);
  return JSON.stringify([...params.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export async function completeSupabaseAuthFromUrl(url: string): Promise<AuthExchangeResult> {
  if (!isAuthCallbackUrl(url)) return { handled: false, recovery: false, error: 'This link is not a StrideOS sign-in callback.' };
  const supabaseState = getSupabaseAvailability();
  const supabase = supabaseState.status === 'available' ? supabaseState.client : null;
  const params = authParams(url);
  const code = params.get('code');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  const authError = params.get('error_description') ?? params.get('error');

  if (authError) {
    return { handled: true, recovery: type === 'recovery', error: 'This sign-in link is invalid or expired. Request a new link and try again.' };
  }

  if (!supabase) {
    const hasAuthPayload = Boolean(code || accessToken || refreshToken);
    return {
      handled: hasAuthPayload,
      recovery: type === 'recovery',
      error: hasAuthPayload ? supabaseUnavailableMessage('Authentication callback') : null,
    };
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // An unrelated cached login is not proof that this one-use link worked.
      return { handled: true, recovery: type === 'recovery', error: 'This sign-in link is invalid or expired. Request a new link and try again.' };
    }
    if (!data.session) return { handled: true, recovery: false, error: 'This sign-in link did not create a session. Request a new link.' };
    // History restoration is already scheduled by the auth store after it
    // establishes the local owner. It must never block the recovery screen.
    return { handled: true, recovery: type === 'recovery' || ('redirectType' in data && data.redirectType === 'recovery'), error: null, verifiedSession: data.session };
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { handled: true, recovery: type === 'recovery', error: 'This sign-in link is invalid or expired. Request a new link and try again.' };
    if (!data.session) return { handled: true, recovery: type === 'recovery', error: 'This link did not create a session. Request a new link.' };
    return { handled: true, recovery: type === 'recovery', error: null, verifiedSession: data.session };
  }

  return { handled: false, recovery: false, error: null };
}
