# Paid-server acceptance — November 20, 2026

**The real public paid-access path passes.** Pro enforcement is enabled, the temporary QA override is removed, and one authorized synthetic AI request returned a real reply with a verified usage increment and provider metering. Public App Review submission and release remain with root; no image changed.

## Current live result

Root's initial telemetry deployment was v19. The reviewed hardened source was deployed as **v20**; the approved public billing/QA-setting changes produced the final cold runtime **v22**, ACTIVE with JWT verification. All six deployed files match the canonical source exactly. These phases and their hashes/timestamps are separate in `LAUNCH_READINESS_20261120_AI_DEPLOYMENT.json`.

`STRIDEOS_BILLING_ENABLED=true` was verified by digest, `STRIDEOS_BILLING_QA_OWNER_ID` is absent, and every other secret digest stayed unchanged. The revoked reviewer, genuinely outside QA, received **402 Pro required** with usage **0→0**. Anonymous valid POST and usage GET returned 401; preflight returned 200.

Root then saved a bounded one-month **promotional** reviewer grant. RevenueCat independently reports it active until **2026-12-22T01:12:35Z**. Exactly one public synthetic fitness request returned **200**, with a nonempty 169-character reply and usage **0→1**. The temporary reviewer session signed out 204. There were no model retries, owner training-account changes, purchases, budget increases or changes to prices/model/allowance. The local one-request authorization was removed and the one-attempt fence retained.

An independent metadata-only log query observed one v22 provider event: **124 input tokens, 36 output tokens, zero cache tokens**, usage available. The recomputed standard-rate estimate is **$0.000304**. This is one small synthetic request, not an invoice or an average conversation cost. See `LAUNCH_AI_CAPACITY_20261120.json` for the matched provider organization, current $20 monthly cap and capacity limits.

## Entitlement and StoreKit evidence

The reviewer-only QA phase established real **402 inactive →429 active →402 revoked** transitions without quota or AI use. The one-day promotional grant's provider expiry changed from November 22 to **2026-11-21T00:56:51Z** after root removed it. Earlier v19 counter reads timed out; the fresh v22 public negative and positive before/after reads pass. The historical failures remain recorded without claiming a diagnosed cause.

Separately, root inspected the existing owner's RevenueCat history read-only, with Sandbox enabled. The App Store monthly product is active. UI history shows a trial starting **November 16 at 07:27**, conversion **November 17**, and renewals **November 18–20**. The latest event is **SANDBOX / RENEWAL / APP_STORE**, renewal number 5: purchase **2026-11-20T07:27:49Z**, expiry **2026-11-21T07:27:49Z**. No owner UUID, transaction ID or event ID is stored here. These are existing sandbox events, with **no actual sales revenue or new purchase**.

That history proves the observed trial/conversion/renewal metadata and current sandbox access. It does not prove an actually expired/refunded StoreKit state or a newly observed native Restore operation. The owner's earlier successful purchase/active Pro/Restore report remains accepted within its original reported scope. Promotional revocation is separate from StoreKit refund/restoration.

## Notification configuration and limits

Fresh read-only App Store Connect API metadata confirms **Production and Sandbox notification URLs are both present, HTTPS on api.revenuecat.com, identical, and V2**. No opaque URL or credential was printed/saved. No notification or transaction was requested; actual production delivery is not claimed. [Apple's configuration guidance](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications) and [RevenueCat's integration guidance](https://www.revenuecat.com/docs/platform-resources/server-notifications/apple-server-notifications) support this configuration.

The actual limiter remains **20/account/UTC day and 500 globally**, atomic and service-role-only, with usage-table RLS. No allowance exhaustion test or quota change occurred. This establishes bounded technical review readiness inside the existing budget, **not capacity for 1,002 subscribers using their full allowance**.

The metadata wrapper retains the safety prefix, normal payload/model, 1,024-output-token bound and cancellation. It refuses redirects and bounds response JSON at 65,536 bytes. Owning-lane checks pass 68/68 with Deno checks; independent baseline/hardened subsets pass 48/48 and 21/21 (overlapping). Detailed proof and remaining lifecycle boundaries are in `LAUNCH_PAID_SERVER_20261120.json`.
