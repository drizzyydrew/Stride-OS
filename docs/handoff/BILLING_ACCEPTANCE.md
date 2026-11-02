# Billing acceptance and inert private QA preparation

## Latest preparation — November 2, 2026

Production 109 remains billing-off and selected in the saved manual-release
draft. The owner's newer request to prepare work before the home session
supersedes the earlier deferral for **preparation only**, not actual purchases
or public-payment activation. The existing inert owner-specific QA policy is
now deployed as AI Coach v14: all three downloaded source files match, JWT
verification is on, 49 focused tests and Deno checks passed, and all seven
post-deployment boundary responses plus reviewer login/signup guard passed.
Global billing and QA-owner settings remain absent. No QA account is bound,
no allowance reserved and no AI/purchase request was made by this preparation.
See `HOME_AI_QA_PREPARATION_20261102.json`.

Private purchase-test **110 is signed-archive verified and VALID /
IN_BETA_TESTING internally**, from isolated branch `codex/strideos-billing-qa110`,
source `fe8d4db`. The existing internal group was freshly verified to contain
only the owner. No external group/invitation was created. The public draft was
freshly read back selecting **109, manual release, Prepare for Submission**.
Never select 110 in that draft. The canonical checkout stays on production 109.
See `BILLING_QA110_RELEASE.md` and its artifact/Apple receipts. The optional
What to Test note is not confirmed saved: browser control disconnected during
entry, before Save/readback. The home-session guide carries the warning instead.
See `HOME_LAUNCH_SESSION_20261102.md` for timing and exact owner steps. Real
lifecycle acceptance and final paid-production alignment remain open.

## Historical status — November 1, 2026 late Pacific

Production **108** is VALID / IN_BETA_TESTING internally. Its explicit client
billing flag is false. The complete live Supabase secret-name inventory shows
both global server billing and private QA-owner controls absent (off/no QA owner
in the deployed policy). No secret values were opened or changed. No private
billing-QA build or real purchase-lifecycle acceptance occurred. The older 106
preparation and expected-next-number 107 passages below are historical; allocate
any future number from fresh EAS/Apple history rather than reuse 107 or 108.
See `BUILD108_RELEASE.md` and `BUILD108_ACCEPTANCE.md` for current receipts.


## Current preparation after the Build 106 cloud snapshot

Preparation began after the Build 106 snapshot was queued from source
`13feb937c5c94d223635ab9509ab1090ba7f0d2b`, EAS build
`6464cf85-f61a-4d9c-9eaa-92aec14056ba`, with source upload complete. The later
`BUILD106_RELEASE.md` receipt confirms its native build, signed archive, upload
to Apple and VALID / IN_BETA_TESTING state. These local QA changes were prepared
only after that immutable snapshot and remain unbuilt/undeployed/unactivated.
Neither receipt establishes device or purchase-lifecycle acceptance.
The parent's source regression receipt was **1412/1412 passed in 172 seconds**;
it is not a run of the QA changes below.

The new, unbuilt `billing-qa` profile extends `production`, explicitly uses
`distribution: store`, and overrides only its build-time client billing flag to
`"true"`. It inherits the existing production environment, signing defaults and
pinned `macos-tahoe-26.5-xcode-26.6` image. Stored production environment values
and the production profile are unchanged. EAS profile `env` overrides the same
named plain-text/sensitive environment variable during build configuration
resolution; see the [EAS CLI resolution source](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/evaluateConfigWithEnvVarsAsync.ts).
Both profiles now run identical production observability preinstall validation
with the same required variables; upload-bypass flags remain rejected.

There is no OTA channel added. Current source has no `expo-updates` dependency
or update URL/channel configuration, and generated iOS `Expo.plist` records
`EXUpdatesEnabled=false`. Reconfirm these properties before any future build;
adding updates later requires separately isolating QA from production updates.

### Server boundary and deliberate no-quota stop

`createRevenueCatBillingPolicy({ globalEnabled, qaOwnerId })` snapshots its
configuration and provides `enabled(verifiedUserId)` and `isQaOwner(verifiedUserId)`.
The verifier now receives the verified user ID in `enabled(verifiedUserId)`.
Global billing requires exactly `STRIDEOS_BILLING_ENABLED="true"`. The optional
server-only `STRIDEOS_BILLING_QA_OWNER_ID` accepts exactly one nonzero UUID;
missing, malformed, whitespace-padded, list and wildcard values enable no QA
owner. UUID comparison is case-insensitive. There is no request-body override.

The actual AI Coach factory still obtains identity from authenticated
`auth.getUser(token)`. It invokes the existing RevenueCat V2 GET for the exact
QA owner even while global billing is off. Its `consumeAllowance` callback
returns false for that owner **before the quota RPC**, also when global billing
is on. No quota fixture, database write or AI provider call is needed for QA.
Other owners retain existing global-off/default behavior; this preparation does
not change their coach access or perform a RevenueCat lookup for them.

| Authorized QA owner's valid POST | Existing response | Side effects |
| --- | --- | --- |
| Registered customer without active Pro | 402 | No quota RPC or AI call |
| Exact Pro entitlement with future expiry | 429 | Intentional QA stop; no quota RPC or AI call |
| Provider failure, malformed response or unregistered customer/404 | 503 | No quota RPC or AI call |

The 429 message still describes the existing daily limit; QA deliberately takes
that branch without reading or consuming quota. It proves the configured verifier
accepted access only when the exact QA owner binding is independently confirmed.
GET remains configuration-only and cannot establish entitlement verification.
The existing handler must also be configured and receive valid consent/payload;
an earlier 503 does not establish that RevenueCat was called. Responses expose
no entitlement/customer objects, private values or new diagnostic fields.

### Toggles and owner handoff — not activated

| Setting/action | State in this preparation | Separate future acceptance action |
| --- | --- | --- |
| Stored production client billing flag | False/off receipt retained; not changed or freshly read | Keep false |
| Global server billing flag | False/off/default receipt retained; not changed or freshly read | Keep false |
| `STRIDEOS_BILLING_QA_OWNER_ID` | **Must remain UNSET; no environment write performed** | Set one dedicated authenticated QA owner's UUID only for the authorized session |
| RevenueCat server key | Existing server-held credential untouched; no value retrieved | Reuse in server environment; do not copy to client or diagnostics |
| QA server deployment and private build | Neither performed | Review/deploy these server bindings, then build the QA profile only after explicit activation authorization |
| Build number | Current 106 retained; no version files changed | Before a future QA build, allocate next available number, expected **107**, and verify it is still unused across generated targets/archive |
| Public payments and store promotion | Off; no release action | Separate decision only after actual sandbox acceptance passes |

The owner must install the eventual QA build through a private owner-only
TestFlight group, log into the dedicated app account and Sandbox Apple Account,
and approve Apple's purchase dialogs. No public TestFlight link or App Store
promotion is part of this handoff. TestFlight uses Apple's sandbox; controlled
renewal/billing-failure scenarios use the Sandbox Apple Account controls.
See [Apple's TestFlight purchase guidance](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/).

Before any live POST, independently verify the deployed source and exact QA
configuration-to-authenticated-owner match. An unset/malformed or mismatched QA
owner leaves normal global-off behavior intact, which can reach quota/AI; do not
probe other owners or use an unconfirmed binding. Device SDK login must first
register the legitimate RevenueCat customer; a fresh Supabase account alone
does not establish that customer. Then capture timestamped client/RevenueCat
state and the expected 402 -> 429 -> 402 sequence as purchase/expiry occurs.
Cancellation alone preserves access until its entitlement expires.

Actual device acceptance must cover both approved products, canceled purchase,
purchase, relaunch/restore, renewal, cancellation/expiry, billing retry/grace,
refund/revocation where available, and owner switching. Record the exact build,
sandbox environment and observed outcomes. Local fixture tests and QA's 429 do
not prove purchase lifecycle acceptance, successful AI delivery or public-payment
readiness. No StoreKit/device result is claimed here.

After an authorized private session, remove `STRIDEOS_BILLING_QA_OWNER_ID` and
verify it is absent before normal AI use or public billing decisions. Otherwise
that owner intentionally remains stopped at 429, even if global billing later
turns on. Keep production client/server billing off until lifecycle acceptance
and the separate activation decision. Never select the private QA binary for
public promotion as a shortcut; retain the exact tested production candidate
and build identities. Do not delete a real account or its history for testing.

### Bounded preparation checks

```sh
./node_modules/.bin/tsx --test scripts/tests/revenueCatServer*.test.ts \
  scripts/tests/subscriptionLifecycle.test.ts scripts/tests/launchPrivacy.test.ts \
  scripts/tests/observabilityRelease.test.ts
deno check --no-config --no-lock supabase/functions/ai-coach/index.ts
git diff --check
```

Focused tests: **49/49 passed**, zero failures/skips. Twelve new QA policy/factory
tests execute the actual entrypoint, verifier and handler with external Deno,
Supabase and network boundaries mocked. They prove strict single-owner policy,
authenticated identity binding, 402/429/503 behavior, no QA quota RPC/AI call,
sanitized output and unchanged non-QA behavior. Four observability/config tests
cover production and QA validation plus inherited store-profile configuration.
The remaining 33 are existing server/probe/client/privacy tests. All identities,
credentials, purchases and provider replies are synthetic fixtures.

AI function Deno typecheck **passed** (exit 0, typecheck only; no function
execution). Diff whitespace review **passed**. The actual entrypoint's external
imports were checked without changing the dependency lockfile.
Focused TypeScript compilation of `revenueCatServerQa.test.ts` and
`observabilityRelease.test.ts` also **passed**, using `--allowJs` for the existing
CommonJS observability validator, `--noEmit` and `--ignoreConfig`; this was not a
full-app typecheck.
No full-app typecheck, Expo export, full suite, build, deployment, account action,
live API request, quota mutation or AI call is performed by this preparation.

## Historical Build 104 acceptance record

The following source/configuration statements and checks are the dated Build 104
record, preserved for history. They do not describe a deployment of the inert QA
changes above or freshly re-read flags/secrets.

Source baseline: `2d77acf`, canonical checkout
`/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.
This continuation adds acceptance tooling and tests only. It does not accept
payments, activate billing, or establish device/purchase lifecycle acceptance.

### Historical implementation reviewed

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

### Historical read-only live receipt

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

### Reusable bounded probe

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

### Historical focused local checks

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

### Acceptance still open

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
