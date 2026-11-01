/** Safe public-boundary probe. Never sends credentials, POSTs, or purchase data. */
export const REVENUECAT_COACH_PROBE_URL = 'https://pbzgrhnxpbtlkzpreizy.supabase.co/functions/v1/ai-coach';

export type RevenueCatBoundaryReceipt = {
  scope: 'live_public_boundary_only';
  testedAt: string;
  endpoint: string;
  checks: {
    name: 'unauthenticated_get_denied' | 'cors_preflight';
    method: 'GET' | 'OPTIONS';
    httpStatus: number | null;
    passed: boolean;
    detail: string;
  }[];
  passed: boolean;
  authenticatedRevenueCatLookupVerified: false;
  purchaseLifecycleVerified: false;
};

/**
 * GET returns before canUsePlan/consumeAllowance/reply in the deployed handler.
 * OPTIONS returns before authentication. Neither request tests paid access.
 * No environment, private secrets, user accounts, SDKs, or response bodies read.
 */
export async function verifyRevenueCatServerBoundary(deps: {
  fetch?: typeof fetch;
  now?: () => Date;
} = {}): Promise<RevenueCatBoundaryReceipt> {
  const checks: RevenueCatBoundaryReceipt['checks'] = [];
  for (const method of ['GET', 'OPTIONS'] as const) {
    try {
      const response = await (deps.fetch ?? fetch)(REVENUECAT_COACH_PROBE_URL, {
        method, redirect: 'error', credentials: 'omit', cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
        ...(method === 'OPTIONS' ? { headers: {
          Origin: 'https://billing-acceptance.invalid',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type',
        } } : {}),
      });
      const methods = response.headers.get('access-control-allow-methods')?.split(',').map(value => value.trim().toUpperCase()) ?? [];
      const headers = response.headers.get('access-control-allow-headers')?.split(',').map(value => value.trim().toLowerCase()) ?? [];
      const passed = method === 'GET' ? response.status === 401
        : [200, 204].includes(response.status) && response.headers.get('access-control-allow-origin') === '*'
          && methods.includes('POST') && headers.includes('authorization') && headers.includes('content-type');
      await response.body?.cancel();
      checks.push({ name: method === 'GET' ? 'unauthenticated_get_denied' : 'cors_preflight',
        method, httpStatus: response.status, passed,
        detail: method === 'GET' ? 'Expected 401 without any authorization or API key.'
          : 'Expected 200/204 and the handler CORS contract; this does not verify entitlements.' });
    } catch {
      checks.push({ name: method === 'GET' ? 'unauthenticated_get_denied' : 'cors_preflight',
        method, httpStatus: null, passed: false,
        detail: 'Request unavailable, timed out, or redirected; no automatic retry and no response body recorded.' });
    }
  }
  return { scope: 'live_public_boundary_only', testedAt: (deps.now ?? (() => new Date()))().toISOString(),
    endpoint: REVENUECAT_COACH_PROBE_URL, checks, passed: checks.every(check => check.passed),
    authenticatedRevenueCatLookupVerified: false, purchaseLifecycleVerified: false };
}

export async function runRevenueCatProbeCli(args: readonly string[], deps: {
  fetch?: typeof fetch;
  write?: (text: string) => void;
} = {}): Promise<number> {
  const write = deps.write ?? (text => process.stdout.write(`${text}\n`));
  if (args.length !== 1 || args[0] !== '--live') {
    write('Usage: npx tsx scripts/verify-revenuecat-server.ts --live');
    write('Two credential-free GET/OPTIONS requests only. No entitlement lookup, purchases, allowance writes, or AI calls.');
    return args.length === 0 || (args.length === 1 && args[0] === '--help') ? 0 : 2;
  }
  const receipt = await verifyRevenueCatServerBoundary({ fetch: deps.fetch });
  write(JSON.stringify(receipt, null, 2));
  return receipt.passed ? 0 : 1;
}

if (typeof require !== 'undefined' && require.main === module) {
  void runRevenueCatProbeCli(process.argv.slice(2)).then(code => { process.exitCode = code; })
    .catch(() => { process.stderr.write('Billing boundary probe could not finish; no private data recorded.\n'); process.exitCode = 1; });
}
