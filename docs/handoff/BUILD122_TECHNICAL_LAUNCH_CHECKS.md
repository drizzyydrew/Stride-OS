# Build 122 technical launch checks — 2026-11-19

Step 2 is **partial; public-launch acceptance remains blocked**. These were read-only checks. No server policy, quota, schema, entitlement, purchase, image, public submission or release changed. Machine-readable evidence is in `BUILD122_TECHNICAL_LAUNCH_CHECKS.json`.

## Current live evidence

The Supabase project is reported `ACTIVE_HEALTHY` by management metadata, but its actual Auth origin is unavailable. Provider edge logs for 02:30–02:54 UTC on November 20 record HTTP 522 on Auth health, settings and token requests. Three bounded database reads also timed out. The health advisor reports no lints and [Supabase's global status](https://status.supabase.com/) reports operational; neither overrides these project-specific failures. Root cause and a safe recovery action are not yet established. No restart, pause/restore, plan upgrade or blind policy change was attempted.

The deployed AI Coach v17 is ACTIVE with JWT verification on. Its four source files exactly match the canonical current source; hashes are recorded in the JSON receipt. Unauthenticated live GET, usage GET and message POST return401; preflight returns 200. Those results establish only the anonymous boundary, not functioning authenticated Auth/database/provider access.

A fresh CLI secret-name/digest read confirms `STRIDEOS_BILLING_ENABLED` and the private QA-owner setting are absent. Under the exact deployed code, **server Pro enforcement is therefore off**. The RevenueCat read credential exists, but its value was not read. The app's billing-enabled build and the owner's earlier successful sandbox purchase do not establish server-side paid access. The model setting digest matches `claude-haiku-4-5-20251001`; its provider key exists. No key value was retrieved.

## What is tested and what remains open

Forty-nine existing focused tests pass across real-handler entitlement bindings, active/expired/malformed synthetic RevenueCat responses, restoration contracts, ownership changes, usage reads and prompt budgets. They confirm that enabled enforcement rejects inactive access before quota/provider work, ignores client claims, and fails closed on provider errors. These are local synthetic contract tests, not a live RevenueCat or purchase-lifecycle acceptance.

The existing owner report of successful sandbox purchase, active Pro and restore remains accepted within that report's scope; no repeat purchase is needed. Live authenticated Pro acceptance, inactive denial, renewal/expiry/refund/revocation, current allowance concurrency/exhaustion and provider-key billing linkage are still unverified. No disposable account or owner session was created by this lane. Auth availability must recover before testing an isolated account. Private single-owner QA can test RevenueCat binding without consuming quota or calling AI; it requires a coordinated disposable identity and a temporary, explicitly reviewed setting with cleanup. Public enforcement must remain a separate release decision.

## Usage behavior and capacity

The source contract remains **20 reservations per account per UTC day and 500 globally per UTC day**. The last live database definition was read on November 18; the present database timeout prevents fresh readback. The deployed wrapper still invokes that same function. It authenticates before any owner read, reserves atomically before AI, and does not refund a reservation after provider failure. A usage GET spends nothing and reads only the authenticated owner's counter. Closing or reinstalling the app does not reset the database counter.

Personal or global exhaustion returns 429 with: “AI Coach has reached its daily request limit. Try again tomorrow; on-device Insights remain available.” The current UI counter reports account requests used/remaining and UTC reset; it does not expose global availability. Consequently a person may have personal requests remaining when the shared cap rejects a request. Unknown/offline reads are unavailable rather than an invented zero.

The shared cap supports only **25 people using all 20 requests/day**, or 500 people sending one request/day. At $9.99/month, $10,000 gross monthly recurring revenue requires **1,002 monthly subscribers**; the shared cap averages only 0.499 requests/day across them. A $79.99 annual subscription contributes $6.6658/month to normalized recurring revenue, requiring 1,501 annual subscribers for the same target. Sales, normalized MRR, proceeds and cash deposited are different measures. The target is not guaranteed by these changes.

## Operating cost estimate

The pinned model currently costs **$1 per million input tokens and $5 per million output tokens**. This comes from [Anthropic's Haiku 4.5 documentation](https://platform.claude.com/docs/en/models/haiku-4-5/overview). The deployed request caps output at 1,024 tokens. It caps the body at 65,536 bytes, context at 5,000 characters and history at 12 messages of 4,000 characters each, plus a server safety prefix. Those are **not an input-token cap**. No prompt-cache controls are configured and actual token usage is discarded from the provider response, so request counts cannot reconstruct the actual provider bill.

Illustrative USD costs, assuming standard input/output rates and a 30-day month:

| Input/output tokens per request | Per request | One account at 20/day | Shared cap at 500/day |
| --- | ---: | ---: | ---: |
| 2,000 / 400 | $0.00400 | $2.40 | $60.00 |
| 4,000 / 512 | $0.00656 | $3.94 | $98.40 |
| 12,000 / 1,024 | $0.01712 | $10.27 | $256.80 |
| 50,000 / 1,024 | $0.05512 | $33.07 | $826.80 |

These are scenarios, not observed usage, guaranteed upper bounds or profit forecasts. A paid user can cost more than the subscription proceeds when conversation input is long. The historical November3 receipt shows an approved $20/month Claude organization cap, but it was never independently matched to the deployed key's organization; current balance, current cap, rate limits and actual invoice remain unverified. If that cap is effective, access could stop well before the app's request cap. Do not promise unlimited AI or raise quotas until input/output spend and provider limits are measured.

[Apple's standard subscription terms](https://developer.apple.com/app-store/subscriptions/) pay 70% in a subscriber's first year and 85% after one year, before applicable taxes. [Small Business Program](https://developer.apple.com/app-store/small-business-program/) enrollment can reduce commission to 15%; enrollment is **not verified**, so both cases must be budgeted. A $9.99 monthly sale leaves approximately $6.99 at 30% commission or$8.49 at 15%, before all remaining costs. The annual plan's monthly equivalent leaves approximately $4.67 or$5.67 respectively.

[RevenueCat's standard pricing](https://www.revenuecat.com/pricing) is free up to $2,500 monthly tracked revenue, then 1% of tracked revenue once the threshold is reached (about $100 at $10,000 tracked). An account-specific plan/invoice has not been verified. Supabase management reports the organization on Free and recurring project cost $0; this is not a full operating-cost invoice. [Supabase pricing](https://supabase.com/pricing) lists separate resource allowances and paid plans; no upgrade was made. Mapbox, email, monitoring, EAS, taxes/refunds and acquisition costs require their own usage/account readback before claiming net profit.

## Required next acceptance

1. Diagnose project Auth/database origin availability using provider diagnostics; recover only through an identified action with appropriate authorization.
2. Use one isolated account to accept enabled server entitlement access/denial without a new owner purchase; restore/expiry lifecycle needs provider/device evidence and a no-charge sandbox identity.
3. Read the current database limiter/privileges and aggregate usage after recovery. Exercise personal/global failure boundaries only in isolated fixtures; do not exhaust the owner's or production global allowance.
4. Match the deployed AI key to its billing organization without displaying the key, confirm balance/spend cap/rate limits, and choose a sustainable public allowance/capacity budget before turning on public enforcement.

The technical council's strongest failure case is a paying user who has personal requests remaining but is rejected because the global pool or provider budget is depleted. A successful sandbox purchase and passing local tests do not remove that risk.


## Origin diagnosis follow-up

Official [connection-timeout guidance](https://supabase.com/kb/troubleshooting/failed-to-run-sql-query-connection-terminated-due-to-connection-timeout) and [522/table-retrieval guidance](https://supabase.com/kb/troubleshooting/failed-to-retrieve-tables) identify database overload/crash as possible causes of this symptom combination. This is a diagnostic lead, not proof of out-of-memory or an instruction to upgrade. Resource reports, logs and ongoing workload must be assessed before a restart; recurring crashes require fixing the underlying workload/resource issue.

Management API supports read-only [service health](https://supabase.com/docs/reference/api/v1-get-services-health), [Prometheus metrics](https://supabase.com/docs/reference/api/v1-scrape-project-metrics) and [disk utilization](https://supabase.com/docs/reference/api/v1-get-disk-utilization). Existing MCP exposes management metadata/advisors/logs but no raw health/metrics call. A new project-dashboard tab was opened after the Apple lane handed off Chrome; its initial loading state was not treated as evidence. Browser input/read was then held when root indicated the owner might be entering Apple credentials. No settled dashboard diagnosis has been claimed.

Root authorized fixed-host read-only Management diagnostics using an existing credential only if Keychain access could not prompt. Per-process Keychain user interaction was disabled successfully, but the profile credential read returned OSStatus -25293. The attempt stopped immediately; no credential was obtained, no Management request was sent, and no UI prompt or global Keychain setting was changed. Dashboard diagnostics remain pending a controller handoff.
