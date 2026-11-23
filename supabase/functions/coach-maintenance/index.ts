import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { createCoachExpirySender, createCoachMaintenanceHandler, type CoachReminder } from '../_shared/coachMaintenance.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } });
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw Error('Maintenance ledger unavailable');
  return data;
}
const reminderArgs = (item: CoachReminder) => ({ p_transaction: item.transactionId, p_days: item.daysBefore, p_lease: item.leaseId });
const emailKey = Deno.env.get('STRIDEOS_COACH_REMINDER_RESEND_KEY');
const from = Deno.env.get('STRIDEOS_COACH_REMINDER_FROM');
Deno.serve(createCoachMaintenanceHandler({
  // Retention and previously-sold expiry obligations survive a generation or
  // new-sales shutdown. These operational switches are deliberately separate.
  enabled: Deno.env.get('STRIDEOS_COACH_MAINTENANCE_ENABLED') === 'true',
  remindersEnabled: Deno.env.get('STRIDEOS_COACH_EXPIRY_REMINDERS_ENABLED') === 'true' && Boolean(emailKey && from),
  authorization: Deno.env.get('STRIDEOS_COACH_MAINTENANCE_AUTHORIZATION'),
  purge: () => rpc('stride_coach_v2_purge'),
  claim: () => rpc('stride_coach_v2_reminder_claim', { p_limit: 25 }),
  check: item => rpc('stride_coach_v2_reminder_check', reminderArgs(item)),
  ownerEmail: async owner => {
    const { data, error } = await admin.auth.admin.getUserById(owner);
    if (error) throw Error('Account lookup unavailable');
    return data.user?.email_confirmed_at ? data.user.email ?? null : null;
  },
  send: createCoachExpirySender({ key: emailKey, from }),
  bindRecipient: (item, hash) => rpc('stride_coach_v2_reminder_bind', { ...reminderArgs(item), p_hash: hash }),
  finish: (item, sent, skip) => rpc('stride_coach_v2_reminder_finish', { ...reminderArgs(item), p_sent: sent, p_skip: skip }),
}));
