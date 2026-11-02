export const PROVIDER_PENDING_REASONS = ['configuration_unavailable', 'provider_failure', 'credential_refresh_required', 'provider_retry_requested', 'not_prepared', 'capture_in_flight', 'capture_outcome_unknown'] as const;
export type ProviderAction = { provider: 'apple' | 'google'; status: 'revoked' | 'manual_required' | 'pending'; reason?: string };
export type DeletionRequest = {
  id: string; requested_at: string; status: 'pending' | 'processing' | 'completed';
  completed_at?: string | null; provider_actions?: ProviderAction[];
};
export type DeletionCapabilities = { automaticProcessing: boolean; appleCodeExchange: boolean; appleGrantRetained: boolean; googleTokenRevoke: boolean; providerCredentialRefreshReady: boolean };
export const RECEIPT_SECRET_PATTERN = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const APPLE_MANUAL_REVOKE_URL = 'https://support.apple.com/en-us/102571';

export function parseDeletionRequest(value: unknown): DeletionRequest {
  const r = value as DeletionRequest;
  if (!r || !UUID.test(r.id) || !Number.isFinite(Date.parse(r.requested_at))
    || !['pending', 'processing', 'completed'].includes(r.status)
    || (r.status === 'completed' && (typeof r.completed_at !== 'string' || !Number.isFinite(Date.parse(r.completed_at))))
    || (r.completed_at != null && !Number.isFinite(Date.parse(r.completed_at)))
    || (r.provider_actions !== undefined && (!Array.isArray(r.provider_actions) || r.provider_actions.some(a => !a
      || !['apple', 'google'].includes(a.provider) || !['revoked', 'manual_required', 'pending'].includes(a.status)
      || (a.status === 'pending' && !(PROVIDER_PENDING_REASONS as readonly unknown[]).includes(a.reason))
      || (a.reason !== undefined && (typeof a.reason !== 'string' || a.reason.length > 500)))))) {
    throw new Error('The server did not confirm a valid deletion receipt. No completion is assumed.');
  }
  // Pick only the status contract. Never retain an arbitrary response payload.
  return { id: r.id, requested_at: r.requested_at, status: r.status,
    ...(r.completed_at != null ? { completed_at: r.completed_at } : {}),
    ...(r.provider_actions ? { provider_actions: r.provider_actions.map(a => ({ provider: a.provider, status: a.status, ...(a.reason ? { reason: a.reason } : {}) })) } : {}) };
}
export function parseDeletionCapabilities(value: unknown): DeletionCapabilities {
  const c = value as Partial<DeletionCapabilities> | undefined;
  return { automaticProcessing: c?.automaticProcessing === true, appleCodeExchange: c?.appleCodeExchange === true,
    appleGrantRetained: c?.appleGrantRetained === true,
    googleTokenRevoke: c?.googleTokenRevoke === true, providerCredentialRefreshReady: c?.providerCredentialRefreshReady === true };
}
