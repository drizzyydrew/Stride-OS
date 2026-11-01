# Billing acceptance after Build 104

Source baseline: `2d77acf`, canonical checkout
`/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.
This continuation adds acceptance tooling and tests only. It does not accept
payments, activate billing, or establish device/purchase lifecycle acceptance.

## Current implementation reviewed

- Client `src/lib/revenueCat.ts` enables billing only on iOS with the explicit
  client flag and an `appl_` SDK key. It serializes SDK operations, uses the
  current verified owner UUID as App User ID, and checks owner identity around
  awaited operations. Only `strideos_pro_monthly` and `strideos_pro_annual` are
  offered; displayed prices come from store package data. Purchases re-read the
  current offering. Restore is explicit. Client access uses active `pro`; no
  analysis credits are granted by this path.
- Server `supabase/functions/_shared/revenueCatAccess.ts` uses a fixed V2 GET:
  project `proj1a3600d5`, the authenticated Supabase UUID, and active-entitlement
  ID `entl0c642305f9`. Verification is bypassed when the server billing flag is
  off; that bypass is not proof of paid access. When enabled, a server-only V2
  key is required. Redirects and provider pagination URLs are not followed;
  requests have a ten-second deadline and responses have a 64 KiB limit.
- Only the exact Pro entitlement with a finite future expiry grants the
  subscription. Unknown/expired/null-expiry access does not grant. Incomplete
  negative pages, malformed payloads and provider failures are unavailable.
- The coach handler authenticates before handling GET. GET returns configuration
  availability without invoking the entitlement verifier. A valid authenticated
  POST verifies paid access, then reserves allowance, then calls AI. There is no
  deployed read-only entitlement-diagnostics route.

The V2 endpoint requires `customer_information:customers:read`; active entitlement
expiry is milliseconds. RevenueCat determines which entitlements remain active.
See the [official customer resources contract](https://www.revenuecat.com/docs/api-v2/customer/resources)
and [SDK CustomerInfo guidance](https://www.revenuecat.com/docs/customers/customer-info).
Supabase's [Edge Function auth guidance](https://supabase.com/docs/guides/functions/auth)
describes the JWT boundary separately from application authorization.

## Fresh read-only live receipt

Captured `2026-11-01T05:15:33.279Z` (October 31 in America/Los_Angeles):

| Check | Result | Meaning |
| --- | --- | --- |
| Supabase project metadata | `stride-os`, `pbzgrhnxpbtlkzpreizy`, ACTIVE_HEALTHY | Correct project identified through the existing connector |
| AI Coach metadata | ACTIVE, version **11**, `verify_jwt=true` | Current deployment metadata; older handoffs referred to v10 |
| Deployed source readback | All three files exactly match local source | Confirms deployed entrypoint, handler and V2 verifier code; does not inspect environment values |
| Credential-free GET `/functions/v1/ai-coach` | **401** | Unauthenticated public access denied; does not identify whether gateway or handler produced the denial |
| Credential-free OPTIONS, POST preflight headers | **200**, expected CORS contract | Preflight works; no application POST was sent |

Deployed/local SHA-256 matches:

| File under `supabase/functions` | SHA-256 |
| --- | --- |
| `ai-coach/index.ts` | `19fcbfbd2bb6ecd837a86b68d4dc5cb3f825a109d5e1374a137da4037592872b` |
| `_shared/launchHandlers.ts` | `eb5524995f3c61b42f84a57640c0ed40887cc249bb5320f32e46f06845eff856` |
| `_shared/revenueCatAccess.ts` | `139994350a660c83d5ee9b56e6dd02149541f51f379aea563e1e12b6e7c5a46e` |

No private credential values or customer records were retrieved. No live
authenticated RevenueCat lookup, quota reservation, AI call, purchase, customer
creation, entitlement grant, secret/configuration write, or deployment occurred.
The connector was used only to list projects/functions and read deployed source.
Current flag values and secret presence were **not re-read** in this pass; the
off/default settings and owner-saved key receipt remain historical evidence in
`LAUNCH_READINESS.md` and `LAUNCH_ACCEPTANCE.md`, not a fresh configuration check.

## Reusable bounded probe

```sh
npx tsx scripts/verify-revenuecat-server.ts --help
npx tsx scripts/verify-revenuecat-server.ts --live
```

Default/help makes no request. Explicit `--live` makes exactly one GET and one
OPTIONS request to the fixed StrideOS AI Coach URL, with no authorization/API
key, cookies, request body, redirects, automatic retries, or environment loading.
Each fetch has a ten-second timeout. Response bodies are canceled, not printed.
Unknown arguments are rejected without echoing their contents. There is no
endpoint override or credential argument. Exit 0 means both public-boundary
checks passed, exit 1 means a boundary/request failure, and exit 2 means invalid
arguments. The JSON always reports:

```json
{
  "scope": "live_public_boundary_only",
  "authenticatedRevenueCatLookupVerified": false,
  "purchaseLifecycleVerified": false
}
```

The probe cannot claim that the paid gate is enabled or that RevenueCat accepted
the stored server key. An authenticated GET would also skip that verifier. A
valid POST is excluded because it can reserve daily allowance and call a paid
AI provider. Direct V2 authentication cannot be tested from this sidecar without
retrieving a private server key; no such retrieval is authorized or implemented.
Do not activate flags or deploy a diagnostic endpoint merely to make this probe
report more coverage.

## Focused local checks

```sh
npx tsx --test scripts/tests/revenueCatServer*.test.ts \
  scripts/tests/subscriptionLifecycle.test.ts scripts/tests/launchPrivacy.test.ts
```

Fresh result: **33/33 passed**, zero failures/skips. This comprises 13 real-server
verifier/handler tests, five probe safety/CLI tests, five existing mocked-client
tests, and ten existing privacy/handler tests. All provider replies, purchase SDK
calls, owner identities, keys, trial/grace/cancellation scenarios, timeouts and
AI replies in these local tests are **synthetic fixtures**. They test code policy,
identity binding, input limits, failure handling, no redirects/retries, and
entitlement-before-allowance ordering. They do not demonstrate a real trial,
cancellation, renewal, refund, restore, charge, or StoreKit notification.

Focused TypeScript compilation also passed (exit 0), including the three
sidecar TypeScript files and their imported shared server code:

```sh
./node_modules/.bin/tsc --ignoreConfig --noEmit --module commonjs \
  --target ES2022 --moduleResolution node --ignoreDeprecations 6.0 \
  --allowImportingTsExtensions --esModuleInterop --skipLibCheck --types node \
  --lib ES2022,DOM scripts/verify-revenuecat-server.ts \
  scripts/tests/revenueCatServer.test.ts scripts/tests/revenueCatServerProbe.test.ts
```

Probe `--help` and diff whitespace checks passed. No new full-app typecheck,
full regression suite, native compilation, or device run is claimed here.

## Acceptance still open

| Gate | Status and required evidence |
| --- | --- |
| Authenticated server V2 lookup with existing stored key | **Not tested.** Requires an approved read-only execution path in the server environment or a later authorized acceptance session; no new key is needed merely for this tooling |
| Client/server paid-gate agreement | **Not tested live.** Verify the exact accepted app build and authorized test configuration against a dedicated account; a successful public boundary probe is insufficient |
| New sandbox purchase/trial and user cancellation | **Not tested.** Real StoreKit sandbox outcome, matching authenticated App User ID, client CustomerInfo and server entitlement decision |
| Renewal, grace, expiry and refund/revocation | **Not tested.** Actual lifecycle events plus timestamped server/client agreement; local future-expiry fixtures are insufficient |
| Restore after reinstall, owner switching, duplicate taps and failed verification | **Not tested on device.** Device/build/account identity, reproducible steps and resulting entitlement/charge behavior |
| Apple notification delivery | **Not retested.** Prior handoff records a successful sandbox TEST and unresolved production 401; neither proves a customer purchase lifecycle |

No SDK/runtime source, flags, signing, billing settings, store products, release
candidate or release state changed. No new credentials or paid service were used.
