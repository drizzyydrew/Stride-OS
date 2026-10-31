import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from './supabase';

export type DeletionRequest = { id: string; requested_at: string; status: 'pending' | 'processing' | 'completed' };
export async function accountDeletionRequest(submit = false): Promise<DeletionRequest | null> {
  const lease = captureOwnerLease(true);
  const endpoint = getSupabaseFunctionUrl('account-deletion');
  const headers = await getSupabaseFunctionHeaders();
  if (!lease || !endpoint || !headers || !ownerLeaseIsCurrent(lease, true)) throw new Error('Sign in online before requesting account deletion.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(endpoint, {
      method: submit ? 'POST' : 'GET', signal: controller.signal,
      headers: { ...headers, 'Content-Type': 'application/json' },
      ...(submit ? { body: JSON.stringify({ confirmation: 'DELETE MY STRIDEOS ACCOUNT' }) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!ownerLeaseIsCurrent(lease, true)) throw new Error('Your account changed. Please sign in again.');
    if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'The request could not be confirmed. No deletion is confirmed. Please retry.');
    if (result?.request == null && !submit) return null;
    const request = result?.request;
    if (!request || typeof request.id !== 'string' || !Number.isFinite(Date.parse(request.requested_at))
      || !['pending', 'processing', 'completed'].includes(request.status)) throw new Error('The server did not confirm your request. Please retry.');
    return request;
  } finally { clearTimeout(timeout); }
}
