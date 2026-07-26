import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  createSupabaseAvailability,
  getSupabaseClientOrNull,
  resolveSupabaseConfig,
  type SupabaseAvailability,
  type SupabaseConfigAvailability,
} from './supabaseAvailability';

export type { SupabaseAvailability, SupabaseUnavailableReason } from './supabaseAvailability';

const SecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let cachedConfig: SupabaseConfigAvailability | null = null;
let cachedAvailability: SupabaseAvailability | null = null;

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
          storage:            Platform.OS !== 'web' ? SecureStoreAdapter : undefined,
          autoRefreshToken:   true,
          persistSession:     true,
          detectSessionInUrl: false,
        },
      },
    ),
  );
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
  const config = getSupabaseConfigAvailability();
  const supabase = getSupabaseClient();
  if (config.status !== 'configured' || !supabase) return null;

  const { data } = await supabase.auth.getSession();
  const anonKey = config.supabaseAnonKey;
  const bearer = data.session?.access_token ?? anonKey;

  return {
    apikey: anonKey,
    authorization: `Bearer ${bearer}`,
  };
}
