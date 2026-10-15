// ─── Supabase Sync Service ────────────────────────────────────────────────────
//
// Non-blocking background upserts; hydrate-on-sign-in to restore data after
// reinstall. Each function resolves the current user internally — callers
// do not need to pass a user_id. Failures are safe to .catch(console.warn).
//
// Requires tables: workout_logs, strength_logs, custom_workout_logs,
// daily_check_ins, and profiles with onboarding_data / athlete_data columns.

import { getSupabaseAvailability } from './supabase';
import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { CustomWorkoutLog } from '../types/customWorkout';
import type { DailyCheckIn } from '../types/checkin';
import type { OnboardingData } from '../store/onboardingStore';
import type { Activity } from '../types/activity';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSupabaseClient() {
  const supabaseState = getSupabaseAvailability();
  return supabaseState.status === 'available' ? supabaseState.client : null;
}

async function getOwnerContext() {
  const lease = captureOwnerLease(true);
  if (!lease) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data.session;
  if (sessionResult.error || session?.user.id !== lease.ownerUserId || !ownerLeaseIsCurrent(lease, true)) return null;
  const { data, error } = await supabase.auth.getUser(session.access_token);
  if (error || data.user?.id !== lease.ownerUserId || !ownerLeaseIsCurrent(lease, true)) return null;
  return { supabase, user_id: lease.ownerUserId, lease, authorization: `Bearer ${session.access_token}` };
}

function assertRecordOwners(records: readonly unknown[], userId: string): void {
  if (records.some(record => record && typeof record === 'object' && 'ownerUserId' in record
    && record.ownerUserId != null && record.ownerUserId !== userId)) {
    throw new Error('Records belong to a different local account; no data was reassigned');
  }
}

// ── Workout logs ──────────────────────────────────────────────────────────────

export async function syncWorkoutLog(record: CompletedWorkoutRecord): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) return;
  const { supabase, user_id, authorization } = context;

  assertRecordOwners([record], user_id);

  const { error } = await supabase
    .from('workout_logs')
    .upsert({ id: record.id, user_id, data: record, updated_at: new Date().toISOString() }, { onConflict: 'user_id,id' }).setHeader('Authorization', authorization);
  if (error) throw error;
}

export async function deleteWorkoutLog(id: string): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) throw new Error('Cloud deletion requires the current data owner');
  const { supabase, user_id, authorization } = context;

  const { error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('user_id', user_id)
    .eq('id', id).setHeader('Authorization', authorization);
  if (error) throw error;
}

// ── Strength logs ─────────────────────────────────────────────────────────────

export async function syncStrengthLog(record: StrengthLogRecord): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) return;
  const { supabase, user_id, authorization } = context;
  assertRecordOwners([record], user_id);

  const { error } = await supabase
    .from('strength_logs')
    .upsert({ id: record.id, user_id, data: record, updated_at: new Date().toISOString() }, { onConflict: 'user_id,id' }).setHeader('Authorization', authorization);
  if (error) throw error;
}

export async function deleteStrengthLog(id: string): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) throw new Error('Cloud deletion requires the current data owner');
  const { supabase, user_id, authorization } = context;

  const { error } = await supabase
    .from('strength_logs')
    .delete()
    .eq('user_id', user_id)
    .eq('id', id).setHeader('Authorization', authorization);
  if (error) throw error;
}

// ── Custom workout logs ───────────────────────────────────────────────────────

export async function syncCustomLog(record: CustomWorkoutLog): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) return;
  const { supabase, user_id, authorization } = context;
  assertRecordOwners([record], user_id);

  const { error } = await supabase
    .from('custom_workout_logs')
    .upsert({ id: record.id, user_id, data: record, updated_at: new Date().toISOString() }, { onConflict: 'user_id,id' }).setHeader('Authorization', authorization);
  if (error) throw error;
}

export async function deleteCustomLog(id: string): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) throw new Error('Cloud deletion requires the current data owner');
  const { supabase, user_id, authorization } = context;

  const { error } = await supabase
    .from('custom_workout_logs')
    .delete()
    .eq('user_id', user_id)
    .eq('id', id).setHeader('Authorization', authorization);
  if (error) throw error;
}

// ── Activity history (the Activity tab: runs, hikes, rides, strength, …) ──────

export async function upsertActivityLogs(activities: readonly Activity[]): Promise<boolean> {
  if (activities.length === 0) return true;
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) return false;
  const { supabase, user_id, lease, authorization } = context;
  assertRecordOwners(activities, user_id);
  const now = new Date().toISOString();
  for (let i = 0; i < activities.length; i += 200) {
    if (!ownerLeaseIsCurrent(lease, true)) return false;
    const rows = activities.slice(i, i + 200).map(activity => ({ id: activity.id, user_id, data: activity, updated_at: now }));
    const { error } = await supabase.from('activity_logs').upsert(rows, { onConflict: 'user_id,id' }).setHeader('Authorization', authorization);
    if (error || !ownerLeaseIsCurrent(lease, true)) return false;
  }
  return true;
}

export async function deleteActivityLog(id: string): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) throw new Error('Cloud deletion requires the current data owner');
  const { supabase, user_id, authorization } = context;
  const { error } = await supabase.from('activity_logs').delete().eq('user_id', user_id).eq('id', id).setHeader('Authorization', authorization);
  if (error) throw error;
}

/** Upserts every local record of a kind (idempotent full backup). */
export async function backupRecords(
  table: 'workout_logs' | 'strength_logs' | 'custom_workout_logs',
  records: readonly { id: string }[],
): Promise<boolean> {
  if (records.length === 0) return true;
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) return false;
  const { supabase, user_id, lease, authorization } = context;
  assertRecordOwners(records, user_id);
  const now = new Date().toISOString();
  for (let i = 0; i < records.length; i += 200) {
    if (!ownerLeaseIsCurrent(lease, true)) return false;
    const rows = records.slice(i, i + 200).map(record => ({ id: record.id, user_id, data: record, updated_at: now }));
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' }).setHeader('Authorization', authorization);
    if (error || !ownerLeaseIsCurrent(lease, true)) return false;
  }
  return true;
}

// ── Daily check-ins ───────────────────────────────────────────────────────────

export async function syncCheckIn(checkIn: DailyCheckIn): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) return;
  const { supabase, user_id, authorization } = context;

  const { error } = await supabase
    .from('daily_check_ins')
    .upsert({ date: checkIn.date, user_id, data: checkIn, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' }).setHeader('Authorization', authorization);
  if (error) throw error;
}

// ── User profile ──────────────────────────────────────────────────────────────

export async function syncUserProfile(
  onboardingData: OnboardingData,
  athleteData: { athleteName: string; goalRace: string; weeklyMileage: number },
): Promise<void> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) return;
  const { supabase, user_id, authorization } = context;

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id:              user_id,
      onboarding_data: onboardingData,
      athlete_data:    athleteData,
      updated_at:      new Date().toISOString(),
    }).setHeader('Authorization', authorization);
  if (error) throw error;
}

// ── Hydrate from Supabase ─────────────────────────────────────────────────────

export type HydrateResult = {
  ownerLease: OwnerLease;
  workoutLogs:  CompletedWorkoutRecord[];
  strengthLogs: StrengthLogRecord[];
  customLogs:   CustomWorkoutLog[];
  checkIns:     DailyCheckIn[];
  activities:   Activity[];
};

export async function hydrateFromSupabase(): Promise<HydrateResult> {
  const context = await getOwnerContext();
  if (!context || !ownerLeaseIsCurrent(context.lease, true)) throw new Error('Cloud restore requires the current data owner');
  const { supabase, user_id, lease, authorization } = context;

  const [workouts, strength, custom, checkins, activities] = await Promise.all([
    supabase.from('workout_logs').select('data').eq('user_id', user_id).setHeader('Authorization', authorization),
    supabase.from('strength_logs').select('data').eq('user_id', user_id).setHeader('Authorization', authorization),
    supabase.from('custom_workout_logs').select('data').eq('user_id', user_id).setHeader('Authorization', authorization),
    supabase.from('daily_check_ins').select('data').eq('user_id', user_id).setHeader('Authorization', authorization),
    supabase.from('activity_logs').select('data').eq('user_id', user_id).setHeader('Authorization', authorization),
  ]);

  if (!ownerLeaseIsCurrent(lease, true)) throw new Error('Account changed during cloud restore');
  if ([workouts, strength, custom, checkins, activities].some(result => result.error)) throw new Error('Cloud restore is unavailable; local history was retained');
  for (const result of [workouts, strength, custom, checkins, activities]) {
    assertRecordOwners((result.data ?? []).map(row => row.data), user_id);
  }

  return {
    ownerLease: lease,
    workoutLogs:  (workouts.data  ?? []).map(r => r.data as CompletedWorkoutRecord),
    strengthLogs: (strength.data  ?? []).map(r => r.data as StrengthLogRecord),
    customLogs:   (custom.data    ?? []).map(r => r.data as CustomWorkoutLog),
    checkIns:     (checkins.data  ?? []).map(r => r.data as DailyCheckIn),
    activities:   (activities.data ?? []).map(r => r.data as Activity),
  };
}
