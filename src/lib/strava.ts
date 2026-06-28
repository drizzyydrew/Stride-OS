// ─── Strava OAuth Integration ─────────────────────────────────────────────────
//
// Requires EXPO_PUBLIC_STRAVA_CLIENT_ID in .env. STRAVA_CLIENT_ID and
// STRAVA_CLIENT_SECRET must be set as Supabase Edge Function secrets.
// Token refresh is handled transparently without bundling the client secret.

import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import type { CompletedWorkoutRecord } from '../types/training';
import { getSupabaseFunctionHeaders } from './supabase';

const CLIENT_ID     = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
const REDIRECT_URI  = 'strideos://strava-callback';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const STORE_ACCESS_TOKEN  = 'strava_access_token';
const STORE_REFRESH_TOKEN = 'strava_refresh_token';
const STORE_EXPIRY        = 'strava_token_expiry';

function createOAuthState(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export async function startStravaOAuth(): Promise<StravaTokens> {
  if (!CLIENT_ID) {
    throw new Error('Missing Strava client ID. Add EXPO_PUBLIC_STRAVA_CLIENT_ID to .env.');
  }
  assertStravaTokenProxyConfigured();

  const state = createOAuthState();
  const url =
    `https://www.strava.com/oauth/mobile/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&approval_prompt=auto` +
    `&scope=activity%3Awrite` +
    `&state=${encodeURIComponent(state)}`;

  const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
  if (result.type !== 'success') throw new Error('Strava sign-in was cancelled.');

  const callbackUrl = new URL(result.url);
  const returnedState = callbackUrl.searchParams.get('state');
  if (returnedState !== state) {
    throw new Error('Strava sign-in returned an invalid state. Please try connecting again.');
  }

  const code = callbackUrl.searchParams.get('code');
  if (!code) throw new Error('Strava did not return an authorization code.');

  const tokens = await requestStravaTokens({
    grant_type: 'authorization_code',
    code,
  });
  await storeTokens(tokens);
  return tokens;
}

type StravaTokenRequest =
  | { grant_type: 'authorization_code'; code: string }
  | { grant_type: 'refresh_token'; refresh_token: string };

export type StravaSetupStatus = {
  ok: boolean;
  clientConfigured: boolean;
  proxyConfigured: boolean;
  error?: string;
};

function assertStravaTokenProxyConfigured(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration for Strava token exchange.');
  }
}

export function isStravaClientConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

export async function checkStravaSetup(): Promise<StravaSetupStatus> {
  const clientConfigured = isStravaClientConfigured();
  const proxyBaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  if (!clientConfigured) {
    return {
      ok: false,
      clientConfigured,
      proxyConfigured: proxyBaseConfigured,
      error: 'Missing EXPO_PUBLIC_STRAVA_CLIENT_ID in the app .env file.',
    };
  }

  if (!proxyBaseConfigured) {
    return {
      ok: false,
      clientConfigured,
      proxyConfigured: false,
      error: 'Missing Supabase configuration for Strava token exchange.',
    };
  }

  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/strava-token`, {
      method: 'GET',
      headers: await getSupabaseFunctionHeaders(),
    });
    const body = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
    if (!response.ok) {
      return {
        ok: false,
        clientConfigured,
        proxyConfigured: false,
        error: body.error ?? `Strava setup check failed with HTTP ${response.status}.`,
      };
    }
    return {
      ok: Boolean(body.ok),
      clientConfigured,
      proxyConfigured: Boolean(body.ok),
      error: body.ok ? undefined : 'STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET are not set on the Supabase Edge Function.',
    };
  } catch (error) {
    return {
      ok: false,
      clientConfigured,
      proxyConfigured: false,
      error: error instanceof Error ? error.message : 'Could not reach Strava token setup check.',
    };
  }
}

async function requestStravaTokens(body: StravaTokenRequest): Promise<StravaTokens> {
  assertStravaTokenProxyConfigured();

  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/strava-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getSupabaseFunctionHeaders()),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string; message?: string }).error ?? (body as { message?: string }).message ?? `Strava OAuth failed with HTTP ${res.status}.`);
  }
  return res.json();
}

// ── Token management ──────────────────────────────────────────────────────────

export type StravaTokens = {
  access_token:  string;
  refresh_token: string;
  expires_at:    number;
};

async function storeTokens(tokens: StravaTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(STORE_ACCESS_TOKEN,  tokens.access_token),
    SecureStore.setItemAsync(STORE_REFRESH_TOKEN, tokens.refresh_token),
    SecureStore.setItemAsync(STORE_EXPIRY,        String(tokens.expires_at)),
  ]);
}

export async function clearStravaTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORE_ACCESS_TOKEN),
    SecureStore.deleteItemAsync(STORE_REFRESH_TOKEN),
    SecureStore.deleteItemAsync(STORE_EXPIRY),
  ]);
}

export async function hasStoredStravaTokens(): Promise<boolean> {
  const [token, refresh] = await Promise.all([
    SecureStore.getItemAsync(STORE_ACCESS_TOKEN),
    SecureStore.getItemAsync(STORE_REFRESH_TOKEN),
  ]);
  return Boolean(token && refresh);
}

async function getValidAccessToken(): Promise<string | null> {
  const [token, refresh, expiryStr] = await Promise.all([
    SecureStore.getItemAsync(STORE_ACCESS_TOKEN),
    SecureStore.getItemAsync(STORE_REFRESH_TOKEN),
    SecureStore.getItemAsync(STORE_EXPIRY),
  ]);

  if (!token || !refresh) return null;

  const expiry = Number(expiryStr ?? '0');
  if (Date.now() / 1000 < expiry - 300) return token;

  const tokens = await requestStravaTokens({
    grant_type: 'refresh_token',
    refresh_token: refresh,
  });
  await storeTokens(tokens);
  return tokens.access_token;
}

// ── Activity upload ───────────────────────────────────────────────────────────

const WORKOUT_TYPE_TO_STRAVA: Record<string, string> = {
  easy_run:     'Run',
  long_run:     'Run',
  tempo_run:    'Run',
  interval:     'Run',
  recovery_run: 'Run',
  race:         'Run',
};

export async function uploadActivityToStrava(workout: CompletedWorkoutRecord): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) return;

  const durationMin  = workout.actualDurationMinutes ?? workout.durationMinutes;
  const distanceMi   = workout.actualDistanceMiles ?? workout.estimatedDistanceMiles;
  if (!durationMin || durationMin <= 0 || !distanceMi || distanceMi <= 0) {
    throw new Error('Strava upload requires a workout duration and distance.');
  }
  const startDate    = new Date(workout.timestamp - durationMin * 60 * 1000);
  const sportType    = WORKOUT_TYPE_TO_STRAVA[workout.type] ?? 'Run';
  const body         = new URLSearchParams({
    name:             workout.type.replace(/_/g, ' '),
    sport_type:       sportType,
    type:             sportType,
    start_date_local: startDate.toISOString(),
    elapsed_time:     String(Math.round(durationMin * 60)),
    distance:         String(distanceMi * 1609.344),
  });

  const response = await fetch('https://www.strava.com/api/v3/activities', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = (data as { message?: string; error?: string }).message
      ?? (data as { error?: string }).error
      ?? `Strava upload failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
}
