// ─── Strava OAuth Integration ─────────────────────────────────────────────────
//
// Requires EXPO_PUBLIC_STRAVA_CLIENT_ID and EXPO_PUBLIC_STRAVA_CLIENT_SECRET
// in .env. Token refresh is handled transparently.

import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import type { CompletedWorkoutRecord } from '../types/training';

const CLIENT_ID     = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET;
const REDIRECT_URI  = 'strideapp://strava-callback';

const STORE_ACCESS_TOKEN  = 'strava_access_token';
const STORE_REFRESH_TOKEN = 'strava_refresh_token';
const STORE_EXPIRY        = 'strava_token_expiry';

// ── OAuth ─────────────────────────────────────────────────────────────────────

export async function startStravaOAuth(): Promise<void> {
  const url =
    `https://www.strava.com/oauth/mobile/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&approval_prompt=auto` +
    `&scope=activity%3Awrite`;

  const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
  if (result.type !== 'success') return;

  const code = new URL(result.url).searchParams.get('code');
  if (!code) return;

  const res  = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
    }),
  });
  const tokens = await res.json();
  await storeTokens(tokens);
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

async function getValidAccessToken(): Promise<string | null> {
  const [token, refresh, expiryStr] = await Promise.all([
    SecureStore.getItemAsync(STORE_ACCESS_TOKEN),
    SecureStore.getItemAsync(STORE_REFRESH_TOKEN),
    SecureStore.getItemAsync(STORE_EXPIRY),
  ]);

  if (!token || !refresh) return null;

  const expiry = Number(expiryStr ?? '0');
  if (Date.now() / 1000 < expiry - 300) return token;

  // Token expired — refresh it
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: refresh,
    }),
  });
  const tokens: StravaTokens = await res.json();
  await storeTokens(tokens);
  return tokens.access_token;
}

// ── Activity upload ───────────────────────────────────────────────────────────

const WORKOUT_TYPE_TO_STRAVA: Record<string, string> = {
  easy_run:    'Run',
  long_run:    'Run',
  tempo_run:   'Run',
  interval:    'Run',
  recovery_run:'Run',
  race:        'Run',
};

export async function uploadActivityToStrava(workout: CompletedWorkoutRecord): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) return;

  const durationMin  = workout.actualDurationMinutes ?? workout.durationMinutes;
  const distanceMi   = workout.actualDistanceMiles ?? workout.estimatedDistanceMiles;
  const startDate    = new Date(workout.timestamp - durationMin * 60 * 1000);

  await fetch('https://www.strava.com/api/v3/activities', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name:            workout.type.replace(/_/g, ' '),
      type:            WORKOUT_TYPE_TO_STRAVA[workout.type] ?? 'Run',
      start_date_local: startDate.toISOString(),
      elapsed_time:    durationMin * 60,
      distance:        distanceMi * 1609.344,
    }),
  });
}
