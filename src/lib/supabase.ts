import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { captureOwnerLease, ownerLeaseIsCurrent, configureLocalDataOwner, LOCAL_DATA_OWNER_KEY } from './localDataOwner';
import {
  createSupabaseAvailability,
  getSupabaseClientOrNull,
  resolveSupabaseConfig,
  type SupabaseAvailability,
  type SupabaseConfigAvailability,
} from './supabaseAvailability';

export type { SupabaseAvailability, SupabaseUnavailableReason } from './supabaseAvailability';

export const localDataOwner = configureLocalDataOwner({
  getItem: async key => Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key),
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      if (!globalThis.localStorage) throw new Error('Local ownership storage is unavailable');
      globalThis.localStorage.setItem(key, value);
    } else await SecureStore.setItemAsync(key, value);
  },
});

let explicitAuthAttempts = 0;
let credentialExchangeQueue: Promise<unknown> = Promise.resolve();
let activeAuthAttempt: (() => boolean) | null = null;
export function withExplicitAuthAttempt<T>(action: () => Promise<T>, isCurrent: () => boolean = () => true): Promise<T> {
  explicitAuthAttempts += 1;
  const task = credentialExchangeQueue.then(async () => {
    if (!isCurrent()) throw new Error('Authentication attempt was superseded or cancelled.');
    activeAuthAttempt = isCurrent;
    try {
      const result = await action();
      if (!isCurrent()) throw new Error('Authentication attempt was superseded or cancelled.');
      return result;
    } finally { activeAuthAttempt = null; }
  }).finally(() => { explicitAuthAttempts -= 1; });
  credentialExchangeQueue = task.catch(() => undefined);
  return task;
}
export function isExplicitAuthAttempt() { return explicitAuthAttempts > 0; }

const SecureStoreAdapter = {
  getItem: async (key: string) => Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => {
    const writeAttempt = activeAuthAttempt;
    if (key === supabaseSessionStorageKey()) {
      await initializeLocalOwnership();
      if (writeAttempt && (writeAttempt !== activeAuthAttempt || !writeAttempt())) return;
      if (!writeAttempt && (localDataOwner.logoutFenced || isExplicitAuthAttempt())) return;
      const candidate = JSON.parse(value) as Partial<Session>;
      if (localDataOwner.ownerUserId && candidate.user?.id !== localDataOwner.ownerUserId) return;
    }
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
    if (key === supabaseSessionStorageKey() && writeAttempt && !writeAttempt()) {
      // Logout may occur inside native storage I/O. A newer exchange cannot
      // start until this attempt has removed its own late credential write.
      const stored = Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key);
      if (stored === value) {
        if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
        else await SecureStore.deleteItemAsync(key);
      }
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

let cachedConfig: SupabaseConfigAvailability | null = null;
let cachedAvailability: SupabaseAvailability | null = null;
let refreshListenerInstalled = false;
let ownershipInitialization: Promise<Session | null> | null = null;

export function initializeLocalOwnership(): Promise<Session | null> {
  return ownershipInitialization ??= (async () => {
    try {
      const cached = await readCachedSupabaseSession();
      await localDataOwner.initialize(cached?.user.id ?? null, hasRetainedLocalData);
      return cached;
    } catch (error) {
      ownershipInitialization = null;
      throw error;
    }
  })();
}

export function supabaseSessionStorageKey(): string | null {
  const config = getSupabaseConfigAvailability();
  return config.status === 'configured' ? `sb-${new URL(config.supabaseUrl).hostname.split('.')[0]}-auth-token` : null;
}

export async function readCachedSupabaseSession(): Promise<Session | null> {
  const key = supabaseSessionStorageKey();
  if (!key) return null;
  const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key);
  if (!raw) return null;
  const session = JSON.parse(raw) as Session;
  if (!session.user?.id || !session.access_token || !session.refresh_token) throw new Error('Saved session is unreadable');
  return session;
}

export async function clearCachedSupabaseSession(): Promise<void> {
  const key = supabaseSessionStorageKey();
  if (!key) return;
  for (const item of [key, `${key}-user`, `${key}-code-verifier`]) {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(item);
    else await SecureStore.deleteItemAsync(item);
  }
}

/** Empty history snapshots written by hydration do not make a fresh install owned. */
export async function hasRetainedLocalData(): Promise<boolean> {
  const benign = new Set(['theme-store', 'settings-store', 'feature-tour-store', 'scheduled-session-selection-store']);
  const emptyHistoryFields: Record<string, string[]> = {
    'activity-store': ['activities'], 'workout-store': ['history', 'completedWorkouts'],
    'strength-store': ['history', 'completedSessions'],
    'custom-workout-store': ['logs', 'workouts', 'customRuns', 'overrides', 'notTodayLogIds', 'selectedTodayCustomRunId', 'selectedTodayDate', 'dismissedTodayCustomRunId'],
    'mobility-store': ['completions', 'recommendedWorkoutIds', 'recommendationSourceId'], 'checkin-store': ['checkIns'],
    'readiness-store': ['history', 'todayReadiness'],
  };
  const keys = (await AsyncStorage.getAllKeys()).filter(key => !benign.has(key) && key !== LOCAL_DATA_OWNER_KEY
    && (key.includes('-store') || key.startsWith('active-') || key === 'hydration-planner-inputs' || key === 'strideos-run-completion-journal-v1'));
  for (const key of keys) {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) continue;
    const state = (JSON.parse(raw) as { state?: Record<string, unknown> }).state;
    if (!state) return true;
    // Startup migrates reminder preferences before sign-in. Preferences alone
    // are not evidence of another athlete; connected accounts still are.
    if (key === 'integrations-store') {
      const preferences = new Set(['healthKitEnabled', 'locationEnabled', 'notificationsEnabled', 'notificationTime',
        'workoutNotifications', 'readinessNotifications', 'readinessNotificationSchedule', 'readinessNotificationDays',
        'morningReminderMigratedV37']);
      const emptyConnection = new Set(['stravaConnected', 'stravaAccessToken', 'stravaRefreshToken', 'stravaTokenExpiry']);
      if (Object.entries(state).every(([field, value]) => preferences.has(field)
        || (emptyConnection.has(field) && (value == null || value === false)))) continue;
      return true;
    }
    const fields = emptyHistoryFields[key];
    if (fields && fields.every(field => state[field] == null || (Array.isArray(state[field]) && state[field].length === 0))) continue;
    return true;
  }
  return false;
}

export function getSupabaseConfigAvailability(): SupabaseConfigAvailability {
  cachedConfig ??= resolveSupabaseConfig({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cachedConfig;
}

export function getSupabaseAvailability(): SupabaseAvailability {
  cachedAvailability ??= createSupabaseAvailability(
    getSupabaseConfigAvailability(),
    (supabaseUrl, supabaseAnonKey) => createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          storage:            SecureStoreAdapter,
          autoRefreshToken:   true,
          persistSession:     true,
          detectSessionInUrl: false,
        },
      },
    ),
  );
  if (cachedAvailability.status === 'available' && !refreshListenerInstalled && Platform.OS !== 'web') {
    refreshListenerInstalled = true;
    const client = cachedAvailability.client;
    AppState.addEventListener('change', state => {
      if (state === 'active' && !localDataOwner.logoutFenced) client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }
  return cachedAvailability;
}

export function getSupabaseClient() {
  return getSupabaseClientOrNull(getSupabaseAvailability());
}

export function supabaseUnavailableMessage(feature = 'Supabase'): string {
  const state = getSupabaseAvailability();
  if (state.status === 'available') return '';
  switch (state.reason) {
    case 'invalid-configuration':
      return `${feature} is unavailable because the Supabase URL is invalid.`;
    case 'initialization-failed':
      return `${feature} is unavailable because Supabase initialization failed.`;
    default:
      return `${feature} is unavailable because Supabase is not configured for this build.`;
  }
}

export function getSupabaseFunctionUrl(functionName: string): string | null {
  const config = getSupabaseConfigAvailability();
  if (config.status !== 'configured') return null;
  if (getSupabaseAvailability().status !== 'available') return null;
  return `${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;
}

export async function getSupabaseFunctionHeaders(): Promise<Record<string, string> | null> {
  const lease = captureOwnerLease(true);
  if (!lease) return null;
  const config = getSupabaseConfigAvailability();
  const supabase = getSupabaseClient();
  if (config.status !== 'configured' || !supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !ownerLeaseIsCurrent(lease, true) || data.session?.user.id !== lease.ownerUserId) return null;
  const anonKey = config.supabaseAnonKey;
  const bearer = data.session.access_token;

  return {
    apikey: anonKey,
    authorization: `Bearer ${bearer}`,
  };
}
