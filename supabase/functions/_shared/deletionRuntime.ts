import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@6.1.3';
import { fulfillDeletion, validateDeletionPlan } from '../../../src/utils/deletionFulfillment.ts';
import { disconnectDeletionProvider, ProviderRemovalError } from './deletionProviders.ts';
import type { DeletionHandlersDependencies, DeletionUser } from './deletionHandlers.ts';
import { STRIDEOS_GOOGLE_CLIENT_ID } from './deletionProviderConfig.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'), { timeoutDuration: 10_000 });
const fields = 'id,requested_at,status,completed_at';
type ProviderToken = { provider: 'apple' | 'google'; kind: 'google_access_token' | 'apple_authorization_code' | 'apple_refresh_token' | 'apple_capture_refresh_token' | 'apple_capture_access_token'; subject: string; token: string; capture_id?: string; client_id?: string };

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error('Deletion database operation is not confirmed.');
  return data;
}
async function assertLease(requestId: string, token: string) {
  if (await rpc('renew_stride_deletion', { request_id: requestId, claim_token: token }) !== true) throw new Error('Deletion lease is not confirmed.');
}

async function appleDeletionClientSecret(): Promise<string | undefined> {
  const fallback = Deno.env.get('STRIDEOS_APPLE_CLIENT_SECRET');
  const mint = Deno.env.get('STRIDEOS_APPLE_PRIVATE_KEY') && Deno.env.get('STRIDEOS_APPLE_KEY_ID') && Deno.env.get('STRIDEOS_APPLE_TEAM_ID');
  // Load signing code only when minting is needed. Existing static-secret deployments remain supported.
  return mint ? (await import('./appleGrantCrypto.ts')).configuredAppleClientSecret() : fallback;
}

// A successful revoke covers the supplied token, not every saved authorization.
// Acknowledge each refresh/access credential separately; retain progress on retry.
export async function revokeRetainedAppleTokens(requestId: string, lease: string, tokens: ProviderToken[]) {
  if (!tokens.length) return;
  const clientId=Deno.env.get('STRIDEOS_APPLE_CLIENT_ID');
  const secret=await appleDeletionClientSecret();
  if (!clientId || !secret) throw new ProviderRemovalError('configuration');
  for (const token of tokens.slice(0,6)) {
    if (!token.capture_id || token.client_id!==clientId || !['apple_capture_refresh_token','apple_capture_access_token'].includes(token.kind)) throw new ProviderRemovalError('identity');
    await assertLease(requestId,lease);
    const response=await fetch('https://appleid.apple.com/auth/revoke',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(10_000),headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:secret,token:token.token,
        token_type_hint:token.kind==='apple_capture_refresh_token'?'refresh_token':'access_token'}).toString(),
    });
    await response.body?.cancel();
    if (response.status!==200) throw new ProviderRemovalError('provider_unavailable');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token.token));
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if (await rpc('ack_stride_apple_capture_token',{request_id:requestId,claim_token:lease,capture_id:token.capture_id,token_kind:token.kind,token_hash:hash})!==true)
      throw new ProviderRemovalError('provider_unavailable');
  }
  // Bound a single worker turn without abandoning unprocessed credentials.
  if (tokens.length>6) throw new ProviderRemovalError('provider_unavailable');
}

export async function processDeletionRequest(requestId: string) {
  await fulfillDeletion(requestId, {
    plan: id => rpc('stride_deletion_plan', { request_id: id }),
    claim: id => rpc('claim_stride_deletion', { request_id: id }),
    assertLease,
    prepareProviders: async (id, lease) => {
      const plan = validateDeletionPlan(await rpc('stride_deletion_plan', { request_id: id }), id);
      const tokens = await rpc('read_stride_deletion_provider_tokens', { request_id: id, claim_token: lease }) as ProviderToken[];
      if (!Array.isArray(tokens) || tokens.some(t => !t || !['apple', 'google'].includes(t.provider)
        || !['google_access_token', 'apple_authorization_code', 'apple_refresh_token', 'apple_capture_refresh_token', 'apple_capture_access_token'].includes(t.kind)
        || (t.provider === 'google' && t.kind !== 'google_access_token')
        || (t.provider === 'apple' && t.kind === 'google_access_token')
        || typeof t.subject !== 'string' || !t.subject || t.subject.length > 512
        || typeof t.token !== 'string' || !t.token || t.token.length > 16_384)) throw new Error('Provider state is unavailable.');
      for (const provider of plan.identity_providers) {
        if (provider === 'email') continue;
        if (provider !== 'apple' && provider !== 'google') throw new Error('Unsupported provider.');
        const previous = plan.provider_actions?.find(a => a.provider === provider);
        if (previous?.status === 'revoked' || previous?.status === 'manual_required') continue;
        const retained = tokens.filter(t => t.provider === provider && !t.kind.startsWith('apple_capture_'));
        if (retained.length > 1) throw new Error('Ambiguous provider state.');
        const token = retained[0];
        await assertLease(id, lease);
        try {
          if (provider==='apple') await revokeRetainedAppleTokens(id,lease,tokens.filter(t=>t.provider==='apple' && t.kind.startsWith('apple_capture_')));
          const action = await disconnectDeletionProvider(provider, token?.subject ?? 'legacy-unavailable',
            token?.kind === 'apple_authorization_code' ? { authorizationCode: token.token } : { token: token?.token }, {
              appleClientId: Deno.env.get('STRIDEOS_APPLE_CLIENT_ID'),
              appleClientSecret: provider === 'apple' && token ? await appleDeletionClientSecret() : undefined,
              googleClientId: Deno.env.get('STRIDEOS_GOOGLE_CLIENT_ID') ?? STRIDEOS_GOOGLE_CLIENT_ID,
            }, {
              fetch,
              verifyAppleIdentity: async (jwt, clientId) => {
                const result = await jwtVerify(jwt, appleKeys, { issuer: 'https://appleid.apple.com', audience: clientId, algorithms: ['RS256'] });
                return { sub: result.payload.sub };
              },
              saveAppleRefreshToken: async refresh => {
                if (!token || token.kind !== 'apple_authorization_code') throw new Error('Apple exchange state changed.');
                if (await rpc('replace_stride_deletion_apple_code', { request_id: id, authorization_code: token.token,
                  refresh_token: refresh, provider_subject: token.subject, claim_token: lease }) !== true) throw new Error('Apple exchange is not secured.');
              },
            });
          await assertLease(id, lease);
          if (await rpc('attest_stride_deletion_provider', { request_id: id, provider,
            disposition: action.status, reason: action.status === 'manual_required' ? action.reason : null,
            claim_token: lease }) !== true) throw new Error('Provider disposition is not secured.');
        } catch (error) {
          await rpc('attest_stride_deletion_provider', { request_id: id, provider, disposition: 'retry_pending',
            reason: error instanceof ProviderRemovalError && error.code === 'configuration' ? 'configuration_unavailable'
              : error instanceof ProviderRemovalError && error.code === 'credential_refresh_required' ? 'credential_refresh_required' : 'provider_failure', claim_token: lease });
          throw new Error('Provider disconnection remains pending.');
        }
      }
    },
    revokeSessions: async userId => {
      // The deletion request already freezes cloud RLS/AI writes. Prevent new
      // login/refresh before file removal; Auth deletion then drops sessions.
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: '8760h' });
      if (error) throw new Error('Account access could not be secured.');
    },
    removeObjects: async paths => {
      const { error } = await admin.storage.from('movement-videos').remove(paths);
      if (error) throw new Error('Storage removal is not confirmed.');
    },
    deleteAuthUser: async userId => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error('Auth removal is not confirmed.');
    },
    complete: async (id, lease) => {
      if (await rpc('complete_stride_deletion', { request_id: id, claim_token: lease }) !== true) throw new Error('Completion is not confirmed.');
    },
  }, true);
}

export async function consumeDeletionTicket(id: string, ticket: string) {
  return await rpc('consume_stride_deletion_job_ticket', { request_id: id, ticket_secret: ticket }) === true;
}
export function scheduleDeletionRequest(id: string) {
  EdgeRuntime.waitUntil(processDeletionRequest(id).catch(() => {
    console.warn('Account deletion remains queued for verified retry.');
  }));
}
export const deletionDependencies: DeletionHandlersDependencies = {
  authenticate: async req => {
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user as DeletionUser;
  },
  readAuthenticated: userId => rpc('read_stride_deletion_owned_status', { owner_id: userId }),
  requestLegacy: async userId => {
    const { error } = await admin.from('stride_account_deletion_requests').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error) throw new Error('Request save is unavailable.');
    const result = await admin.from('stride_account_deletion_requests').select(fields).eq('user_id', userId).single();
    if (result.error) throw new Error('Request confirmation is unavailable.');
    return result.data;
  },
  automationEnabled: async ownerId => await rpc('stride_deletion_automation_enabled', { owner_id: ownerId }) === true,
  capabilities: () => ({
    appleCodeExchange: Boolean(Deno.env.get('STRIDEOS_APPLE_CLIENT_ID') && (Deno.env.get('STRIDEOS_APPLE_CLIENT_SECRET')
      || Deno.env.get('STRIDEOS_APPLE_PRIVATE_KEY') && Deno.env.get('STRIDEOS_APPLE_KEY_ID') && Deno.env.get('STRIDEOS_APPLE_TEAM_ID'))),
    googleTokenRevoke: Boolean(Deno.env.get('STRIDEOS_GOOGLE_CLIENT_ID') ?? STRIDEOS_GOOGLE_CLIENT_ID),
  }),
  start: (userId, hash, tokens) => rpc('start_stride_deletion', { user_id: userId, receipt_hash: hash, provider_tokens: tokens }),
  refresh: (userId, hash, tokens) => rpc('refresh_stride_deletion_provider_tokens', { user_id: userId, receipt_hash: hash, provider_tokens: tokens }),
  readReceipt: (id, secret) => rpc('read_stride_deletion_receipt', { request_id: id, receipt_secret: secret }),
  enqueue: async id => {
    const ticket = await rpc('issue_stride_deletion_job_ticket', { request_id: id });
    if (typeof ticket !== 'string' || !await consumeDeletionTicket(id, ticket)) return;
    scheduleDeletionRequest(id);
  },
};
