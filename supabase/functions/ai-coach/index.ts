import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { createCoachHandler } from '../_shared/launchHandlers.ts';
import { createRevenueCatBillingPolicy, createRevenueCatProVerifier } from '../_shared/revenueCatAccess.ts';
import { readCoachAllowance } from '../_shared/coachAllowance.ts';
import { createAnthropicCoachReply } from '../_shared/coachProvider.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const key = Deno.env.get('ANTHROPIC_API_KEY');
const billing = createRevenueCatBillingPolicy({
  globalEnabled: Deno.env.get('STRIDEOS_BILLING_ENABLED'),
  qaOwnerId: Deno.env.get('STRIDEOS_BILLING_QA_OWNER_ID'),
});

Deno.serve(createCoachHandler({
  configured: () => Boolean(key),
  canUsePlan: createRevenueCatProVerifier({
    enabled: billing.enabled,
    apiKey: () => Deno.env.get('REVENUECAT_SECRET_API_KEY'),
  }),
  authenticate: async req => {
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },
  requiresUpdate: async userId => {
    // Deploy only after the additive v2 migration. Unenrolled Build 125 users
    // keep the existing allowance; migrated users cannot claim a second pool.
    const { data, error } = await admin.rpc('stride_coach_v2_is_enrolled', { p_owner: userId });
    if (error) throw new Error('Allowance verification unavailable');
    return data === true;
  },
  readUsage: userId => readCoachAllowance(userId, async (owner, day) => {
    const { data, error } = await admin.from('stride_coach_usage')
      .select('requests').eq('day', day).eq('scope', owner).maybeSingle();
    if (error) throw new Error('Usage unavailable');
    return data ? data.requests : null;
  }),
  consumeAllowance: async userId => {
    // QA stops at the existing 429 response after successful verification.
    // Never reserve quota or reach AI for this owner, even if global billing is on.
    if (billing.isQaOwner(userId)) return false;
    const { data, error } = await admin.rpc('consume_stride_coach_allowance', { owner_id: userId });
    if (error) throw new Error('Usage limiter unavailable');
    return data === true;
  },
  reply: createAnthropicCoachReply({ apiKey: key,
    model: () => Deno.env.get('ANTHROPIC_MODEL'),
    onTelemetry: event => console.info(JSON.stringify(event)),
  }),
}));
