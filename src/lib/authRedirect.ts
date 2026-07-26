import * as Linking from 'expo-linking';

import { getSupabaseAvailability, supabaseUnavailableMessage } from './supabase';
import { hydrateFromSupabase } from './syncService';
import { useCheckInStore } from '../store/checkInStore';
import { useCustomWorkoutStore } from '../store/customWorkoutStore';
import { useStrengthStore } from '../store/strengthStore';
import { useWorkoutStore } from '../store/workoutStore';

export const AUTH_CALLBACK_PATH = 'auth/callback';

type AuthCompletionResult = {
  handled: boolean;
  recovery: boolean;
  error: string | null;
};

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
  useWorkoutStore.getState().hydrateWorkouts(result.workoutLogs);
  useStrengthStore.getState().hydrateStrength(result.strengthLogs);
  useCustomWorkoutStore.getState().hydrateLogs(result.customLogs);
  useCheckInStore.getState().hydrateCheckIns(result.checkIns);
}

export async function completeSupabaseAuthFromUrl(url: string): Promise<AuthCompletionResult> {
  const supabaseState = getSupabaseAvailability();
  const supabase = supabaseState.status === 'available' ? supabaseState.client : null;
  const params = authParams(url);
  const code = params.get('code');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  const authError = params.get('error_description') ?? params.get('error');

  if (authError) {
    return { handled: true, recovery: type === 'recovery', error: authError.replace(/\+/g, ' ') };
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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await hydrateUserData().catch(console.warn);
        return { handled: true, recovery: false, error: null };
      }
      return { handled: true, recovery: false, error: error.message };
    }
    await hydrateUserData().catch(console.warn);
    return { handled: true, recovery: false, error: null };
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { handled: true, recovery: type === 'recovery', error: error.message };
    await hydrateUserData().catch(console.warn);
    return { handled: true, recovery: type === 'recovery', error: null };
  }

  return { handled: false, recovery: false, error: null };
}
