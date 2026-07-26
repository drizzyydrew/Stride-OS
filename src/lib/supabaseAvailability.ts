import type { SupabaseClient } from '@supabase/supabase-js';

export type SupabaseUnavailableReason =
  | 'missing-configuration'
  | 'invalid-configuration'
  | 'initialization-failed';

export type SupabaseAvailability =
  | {
      status: 'available';
      client: SupabaseClient;
    }
  | {
      status: 'unavailable';
      reason: SupabaseUnavailableReason;
    };

export type SupabaseEnv = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

export type SupabaseConfigAvailability =
  | {
      status: 'configured';
      supabaseUrl: string;
      supabaseAnonKey: string;
    }
  | {
      status: 'unavailable';
      reason: Extract<SupabaseUnavailableReason, 'missing-configuration' | 'invalid-configuration'>;
    };

export type CreateSupabaseClient = (
  supabaseUrl: string,
  supabaseAnonKey: string,
) => SupabaseClient;

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function resolveSupabaseConfig(env: SupabaseEnv): SupabaseConfigAvailability {
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 'unavailable', reason: 'missing-configuration' };
  }

  if (!isValidSupabaseUrl(supabaseUrl)) {
    return { status: 'unavailable', reason: 'invalid-configuration' };
  }

  return {
    status: 'configured',
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function createSupabaseAvailability(
  config: SupabaseConfigAvailability,
  createSupabaseClient: CreateSupabaseClient,
): SupabaseAvailability {
  if (config.status !== 'configured') {
    return { status: 'unavailable', reason: config.reason };
  }

  try {
    return {
      status: 'available',
      client: createSupabaseClient(config.supabaseUrl, config.supabaseAnonKey),
    };
  } catch {
    return { status: 'unavailable', reason: 'initialization-failed' };
  }
}

export function getSupabaseClientOrNull(
  availability: SupabaseAvailability,
): SupabaseClient | null {
  return availability.status === 'available' ? availability.client : null;
}
