import { readJson } from './launchHandlers.ts';

// Read back from the StrideOS dashboard. These identifiers are not credentials.
export const REVENUECAT_PROJECT_ID = 'proj1a3600d5';
export const REVENUECAT_PRO_ID = 'entl0c642305f9';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => new Error('Subscription verification unavailable');

// A single server-configured owner, never a list, wildcard or client claim.
// Snapshot this policy once so verification and the no-quota guard agree.
export function createRevenueCatBillingPolicy(config: {
  globalEnabled: string | undefined;
  qaOwnerId: string | undefined;
}) {
  const globalEnabled = config.globalEnabled === 'true';
  const value = config.qaOwnerId;
  const qaOwnerId = typeof value === 'string' && value.length === 36 && UUID.test(value)
    && value !== '00000000-0000-0000-0000-000000000000' ? value.toLowerCase() : null;
  const isQaOwner = (verifiedUserId: string): boolean => qaOwnerId !== null
    && verifiedUserId.length === 36 && verifiedUserId.toLowerCase() === qaOwnerId;
  return {
    isQaOwner,
    enabled: (verifiedUserId: string): boolean => globalEnabled || isQaOwner(verifiedUserId),
  };
}

export function createRevenueCatProVerifier(deps: {
  enabled(verifiedUserId: string): boolean;
  apiKey(): string | undefined;
  fetch?: typeof fetch;
  now?: () => number;
}) {
  return async (verifiedUserId: string): Promise<boolean> => {
    if (!deps.enabled(verifiedUserId)) return true;
    const key = deps.apiKey();
    if (!key?.startsWith('sk_') || !UUID.test(verifiedUserId)) throw unavailable();
    try {
      // Requires only customer_information:customers:read. No customer creation,
      // entitlement grants, account deletion, purchase writes or config access.
      const response = await (deps.fetch ?? fetch)(
        `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(verifiedUserId)}/active_entitlements?limit=100`,
        { method: 'GET', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
          redirect: 'error', signal: AbortSignal.timeout(10_000) },
      );
      if (response.status !== 200) { await response.body?.cancel(); throw unavailable(); }
      const body = await readJson(response) as Record<string, unknown> | null;
      if (!body || body.object !== 'list' || !Array.isArray(body.items) || body.items.length > 100
        || !(body.next_page === null || typeof body.next_page === 'string')) throw unavailable();
      const now = (deps.now ?? Date.now)();
      let granted = false;
      for (const value of body.items) {
        const item = value as Record<string, unknown> | null;
        if (!item || item.object !== 'customer.active_entitlement' || typeof item.entitlement_id !== 'string'
          || !(item.expires_at === null || Number.isSafeInteger(item.expires_at))) throw unavailable();
        // RevenueCat's active list and access expiry include its lifecycle/grace
        // decision. Never infer access from a client claim or a paid product name.
        if (item.entitlement_id === REVENUECAT_PRO_ID && typeof item.expires_at === 'number' && item.expires_at > now) granted = true;
      }
      // One Pro entitlement is configured. Never follow a provider-supplied URL
      // with the bearer key; an incomplete negative answer is unavailable.
      if (!granted && body.next_page !== null) throw unavailable();
      return granted;
    } catch { throw unavailable(); }
  };
}
