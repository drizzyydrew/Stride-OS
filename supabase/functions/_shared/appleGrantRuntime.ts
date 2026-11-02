import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@6.1.3';
import { createAppleGrantHandler, type AppleGrantUser } from './appleGrant.ts';
import { configuredAppleClientSecret } from './appleGrantCrypto.ts';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const keys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'), { timeoutDuration: 10_000 });
async function rpc(name: string, args: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await admin.rpc(name, args);
  if (error || typeof data !== 'boolean') throw new Error('Apple custody unavailable');
  return data;
}
async function reserve(owner: string, subject: string, audience: string, codeHash: string): Promise<string | null> {
  const { data, error } = await admin.rpc('reserve_stride_apple_capture', { owner_id: owner, apple_subject: subject, client_id: audience, code_hash: codeHash });
  if (error || data !== null && typeof data !== 'string') throw new Error('Apple reservation unavailable');
  return data;
}
export const appleGrantHandler = createAppleGrantHandler({
  authenticate: async req => {
    const token = req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user as AppleGrantUser;
  },
  clientId: () => Deno.env.get('STRIDEOS_APPLE_CLIENT_ID'),
  clientSecret: configuredAppleClientSecret,
  verifyIdentity: async (jwt, audience) => (await jwtVerify(jwt, keys, { issuer: 'https://appleid.apple.com', audience, algorithms: ['RS256'] })).payload,
  captured: (owner, subject, audience, codeHash) => rpc('stride_apple_grant_captured', { owner_id: owner, apple_subject: subject, client_id: audience, code_hash: codeHash }),
  reserve,
  uncertain: async captureId => { await rpc('mark_stride_apple_capture_uncertain', { capture_id: captureId }); },
  store: (owner, subject, audience, codeHash, tokens, captureId) => rpc('store_stride_apple_grant', { owner_id: owner, apple_subject: subject, client_id: audience, code_hash: codeHash, token_response: tokens, capture_id: captureId }),
  fetch,
});
