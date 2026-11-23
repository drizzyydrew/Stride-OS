import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { createCoachV2Handler, createCoachV2Provider } from '../_shared/coachV2.ts';
import { createRevenueCatProVerifier } from '../_shared/revenueCatAccess.ts';

// Versioned endpoint: deploy and validate independently; never replace v1 while
// Build 125 remains in review. No QA owner or billing-disabled access bypass.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } });
const key = Deno.env.get('ANTHROPIC_API_KEY');
const isPro = createRevenueCatProVerifier({ enabled: () => true,
  apiKey: () => Deno.env.get('REVENUECAT_SECRET_API_KEY') });
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error || data === null) throw new Error('Coach ledger unavailable');
  return data;
}
Deno.serve(createCoachV2Handler({
  configured: () => Boolean(key) && Deno.env.get('STRIDEOS_COACH_V2_ENABLED') === 'true',
  authenticate: async req => {
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },
  isPro,
  readUsage: (owner, timezone, pro) => rpc('stride_coach_v2_usage', { p_owner: owner, p_timezone: timezone, p_pro: pro }),
  lookup: (owner, requestId) => rpc('stride_coach_v2_lookup', { p_owner: owner, p_request: requestId }),
  purchase: (owner, id, cancel) => rpc('stride_coach_v2_purchase', { p_owner: owner, p_intent: id, p_cancel: cancel }),
  reserve: (owner, timezone, pro, requestId, hash) => rpc('stride_coach_v2_reserve', {
    p_owner: owner, p_timezone: timezone, p_pro: pro, p_request: requestId, p_hash: hash,
  }),
  finish: (owner, requestId, response) => rpc('stride_coach_v2_finish', { p_owner: owner, p_request: requestId, p_response: response }),
  reply: createCoachV2Provider({ key, telemetry: event => console.info(JSON.stringify(event)) }),
}));
