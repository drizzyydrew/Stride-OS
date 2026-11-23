import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { createCoachPackWebhook } from '../_shared/coachPackWebhook.ts';

// Preparation only: this route requires custom server-to-server authentication.
// Do not deploy without the reviewed custom-auth config and acceptance checks.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createCoachPackWebhook({
  enabled: Deno.env.get('STRIDEOS_COACH_PACKS_ENABLED') === 'true',
  appleApproved: Deno.env.get('STRIDEOS_APPLE_EXPIRING_CREDITS_APPROVED') === 'true',
  appId: Deno.env.get('STRIDEOS_REVENUECAT_APP_ID'),
  authorization: Deno.env.get('STRIDEOS_REVENUECAT_WEBHOOK_AUTHORIZATION'),
  apply: async event => {
    const { data, error } = await admin.rpc('stride_coach_v2_pack_event', { p_owner: event.owner,
      p_transaction: event.transactionId, p_purchased: event.purchasedAt, p_refund: event.refund });
    if (error || data === null) throw new Error('Pack ledger unavailable');
    return data;
  },
}));
