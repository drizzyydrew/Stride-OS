// ─── Supabase Sync Service ────────────────────────────────────────────────────
//
// Non-blocking background upserts; hydrate-on-sign-in to restore data after
// reinstall. Each function resolves the current user internally — callers
// do not need to pass a user_id. Failures are safe to .catch(console.warn).
//
// Requires tables: workout_logs, strength_logs, custom_workout_logs,
// daily_check_ins, and profiles with onboarding_data / athlete_data columns.

import { supabase } from './supabase';
import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { CustomWorkoutLog } from '../types/customWorkout';
import type { DailyCheckIn } from '../types/checkin';
import type { OnboardingData } from '../store/onboardingStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ── Workout logs ──────────────────────────────────────────────────────────────

export async function syncWorkoutLog(record: CompletedWorkoutRecord): Promise<void> {
  const user_id = await getUserId();
  if (!user_id) return;

  await supabase
    .from('workout_logs')
    .upsert({ id: record.id, user_id, data: record, updated_at: new Date().toISOString() });
}

export async function deleteWorkoutLog(id: string): Promise<void> {
  const user_id = await getUserId();
  if (!user_id) return;

  await supabase
    .from('workout_logs')
    .delete()
    .eq('user_id', user_id)
    .eq('id', id);
}

// ── Strength logs ─────────────────────────────────────────────────────────────

export async function syncStrengthLog(record: StrengthLogRecord): Promise<void> {
  const user_id = await getUserId();
  if (!user_id) return;

  await supabase
    .from('strength_logs')
    .upsert({ id: record.id, user_id, data: record, updated_at: new Date().toISOString() });
}

export async function deleteStrengthLog(id: string): Promise<void> {
  const user_id = await getUserId();
  if (!user_id) return;

  await supabase
    .from('strength_logs')
    .delete()
    .eq('user_id', user_id)
    .eq('id', id);
}

// ── Custom workout logs ───────────────────────────────────────────────────────

export async function syncCustomLog(record: CustomWorkoutLog): Promise<void> {
  const user_id = await getUserId();
  if (!user_id) return;

  await supabase
    .from('custom_workout_logs')
    .upsert({ id: record.id, user_id, data: record, updated_at: new Date().toISOString() });
}

export async function deleteCustomLog(id: string): Promise<void> {
  const user_id = await getUserId();
  if (!user_id) return;

  await supabase
    .from('custom_workout_logs')
    .delete()
    .eq('user_id', user_id)
    .eq('id', id);
}

// ── Daily check-ins ───────────────────────────────────────────────────────────

export async function syncCheckIn(checkIn: DailyCheckIn): Promise<void> {
  const user_id = await getUserId();
  if (!user_id) return;

  await supabase
    .from('daily_check_ins')
    .upsert({ date: checkIn.date, user_id, data: checkIn, updated_at: new Date().toISOString() });
}

// ── User profile ──────────────────────────────────────────────────────────────

export async function syncUserProfile(
  onboardingData: OnboardingData,
  athleteData: { athleteName: string; goalRace: string; weeklyMileage: number },
): Promise<void> {
  const user_id = await getUserId();
  if (!user_id) return;

  await supabase
    .from('profiles')
    .upsert({
      id:              user_id,
      onboarding_data: onboardingData,
      athlete_data:    athleteData,
      updated_at:      new Date().toISOString(),
    });
}

// ── Hydrate from Supabase ─────────────────────────────────────────────────────

export type HydrateResult = {
  workoutLogs:  CompletedWorkoutRecord[];
  strengthLogs: StrengthLogRecord[];
  customLogs:   CustomWorkoutLog[];
  checkIns:     DailyCheckIn[];
};

export async function hydrateFromSupabase(): Promise<HydrateResult> {
  const user_id = await getUserId();
  if (!user_id) return { workoutLogs: [], strengthLogs: [], customLogs: [], checkIns: [] };

  const [workouts, strength, custom, checkins] = await Promise.all([
    supabase.from('workout_logs').select('data').eq('user_id', user_id),
    supabase.from('strength_logs').select('data').eq('user_id', user_id),
    supabase.from('custom_workout_logs').select('data').eq('user_id', user_id),
    supabase.from('daily_check_ins').select('data').eq('user_id', user_id),
  ]);

  return {
    workoutLogs:  (workouts.data  ?? []).map(r => r.data as CompletedWorkoutRecord),
    strengthLogs: (strength.data  ?? []).map(r => r.data as StrengthLogRecord),
    customLogs:   (custom.data    ?? []).map(r => r.data as CustomWorkoutLog),
    checkIns:     (checkins.data  ?? []).map(r => r.data as DailyCheckIn),
  };
}
