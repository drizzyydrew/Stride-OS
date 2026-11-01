# Launch Acceptance And Reviewer Packet

This is an execution checklist, not a legal opinion, independent audit, physical-
device report, or assertion that the app is ready for the market. Public payments
and public release remain disabled until the relevant gates are actually passed.

Latest deletion continuation (November 1, 2026 UTC): see
[`DELETION_ACCEPTANCE.md`](DELETION_ACCEPTANCE.md). The parent verified three
synthetic API/server completions, including scheduler-only recovery, with the
original account unchanged. Automation was then disabled and its allowlist and
cron job cleared. This is not real Apple/Google grant-revocation or native-device
cleanup acceptance. The updated privacy/terms/support pages are now published
separately to the existing Pages branch in
`d9e8749ddd55158a0145f31761d00887a44d6ecc` (only those three files). Pages built
at **06:06:56Z**; parent uncached readback verified all three **HTTP 200** and
byte-for-byte matches. Exact hashes are in `DELETION_ACCEPTANCE.md`. Billing
remains off; publication is not legal clearance or app release.

Current native candidate **106** is from pushed source
`13feb937c5c94d223635ab9509ab1090ba7f0d2b`, EAS
`6464cf85-f61a-4d9c-9eaa-92aec14056ba`. Canonical SDK 57 regression passed
**1,412/1,412**, zero failures/skips, **172.3s**; semantic TypeScript, Expo
compatibility and clean-cache Hermes export passed. Cloud Doctor passed 21/21;
the actual signed phone/Watch/widget archive passed the recorded checks and
contains the fixed Hermes runtime. Exact-build submission
`e089be5d-989e-4229-ac53-705afc49a660` finished; Apple confirms
**VALID / IN_BETA_TESTING** in the existing internal group. Device acceptance
is still open. See [`BUILD106_RELEASE.md`](BUILD106_RELEASE.md) for hashes and
receipts. Build 105 was compiled/inspected but deliberately not submitted.
Earlier 104 receipts below retain their historical scope.

Later pushed source `98c9729` prepares a private billing-QA profile and strictly
owner-scoped server verifier; its 49 focused checks passed independently. It is
unbuilt, undeployed and unactivated. Production payments and general deletion
automation remain off. The next necessary owner actions are installing 106 on
the physical iPhone/Watch, completing Apple sign-in/2FA for remaining store fields,
and participating in the later scoped sandbox purchase session. Never use the
owner's retained-history account as a disposable deletion fixture.

## Owner-Independent Engineering Receipts

- Privacy/AI consent, server quotas, guarded purchases, tour replay, activity
  spacing and safer listing copy: committed baseline `399bcac`.
- Dependency high/critical remediation: pinned patched upstream packages plus
  CommonJS adapter; real dependency-consumer and malicious-input tests. Fresh
  lockfile installation and full iOS JavaScript/Hermes export completed.
- Backend separation: existing Bet Desk and StrideOS projects retained, empty
  legacy tables archived non-destructively, production URLs checked. See
  `BACKEND_ISOLATION.md`.
- Deletion: secure recovery receipts, cloud freeze, private provider/ticket state,
  lease/ownership guards, scoped server fulfillment and local-cleanup source.
  Three synthetic API/server paths completed; real provider-grant revocation and
  native cleanup remain unaccepted. Automation is off after the fixture test.
- Goal/race archives, optional results, next-goal setup and durable open training
  shipped in source `2765920` / build 104. Final regression: 1,318/1,318; semantic
  TypeScript, Expo compatibility, iOS Hermes export and signed archive checks
  passed. Apple readback: VALID / IN_BETA_TESTING internally. This is not device
  acceptance, external-beta approval or public launch. See `GOAL_ARCHIVE.md`.

## Billing Handoff

RevenueCat project `1a3600d5`; entitlement `pro`; approved source identifiers
`strideos_pro_monthly` and `strideos_pro_annual`. No lifetime product or unlimited
analysis promise. The initial source paid gate is AI Coach chat only, capped at
20 requests/account/UTC day and service availability, not all future coaching.

Completed draft configuration on October 31, 2026:

- Owner uploaded/saved the Apple in-app purchase P8 key. RevenueCat's App Store
  connection reports Valid credentials for `com.mooremovement.strideos`.
- Owner approved USD 9.99/month, USD 79.99/year and a seven-day trial. Apple
  products `6829288874` and `6829293174` are saved in group `22532701`, both at
  service level 1. The group display name is StrideOS Pro in English (U.S.).
- Both subscriptions and their free-first-week offers cover the five candidate
  markets in `GLOBAL_ANDROID_PLAN.md`. Monthly and annual saved offer tables
  show October 31, 2026 to No End Date. These are drafts, not live purchases.
- RevenueCat products `prod5877abc7c7` and `proda125e21ccd` are attached to `pro`.
  The default/current offering `ofrng36b3a38697` maps `$rc_monthly` and
  `$rc_annual` to the corresponding Apple products.
- Public iOS SDK key is saved in production EAS, with the client billing flag
  explicitly false. These settings postdate compilation of Build 103 and do not
  change that uploaded binary. Server billing remains off/default.

Still required:

1. Finish truthful review screenshots. Both plans now allow individual App Store
   purchases only, with multiseat Not Allowed in saved readback.
   The five app storefronts now show Available on App Release, with automatic
   future territories off and manual public release saved. Exact local prices
   for both durations are read back in `LAUNCH_READINESS.md`. The old Build 1
   is still attached to the public version draft; candidate selection awaits
   acceptance. No public review yet.
2. Owner generated and saved the prepared RevenueCat V2 customer-read key directly
   into StrideOS Supabase. The custom-secret name REVENUECAT_SECRET_API_KEY and
   update time (October 31, 2026 20:50:06 UTC) were read back without revealing the
   value. AI Coach v10 uses the matching V2 active-entitlements contract. The owner
   separately approved the Apple notification connection; production and sandbox
   URLs now persist after reloading App Store Connect and point to the existing
   StrideOS RevenueCat app. The current Apple editor exposes no version selector.
   Apple's official sandbox TEST API returned HTTP 200 and delivery status
   SUCCESS for a version 2.0 TEST event at 21:23 UTC. Production returned 401,
   including one compatibility-host retry; the cause remains unconfirmed.
   Sandbox notification delivery does not prove a successful customer entitlement
   lookup or a real purchase/renewal/refund lifecycle. Production delivery remains
   an open post-eligibility check. An Apple Commerce Engineer states production
   API access is locked before a first production release; this is a plausible
   explanation, not a confirmed diagnosis of this exact notification endpoint:
   https://developer.apple.com/forums/thread/806452 . Do not release early merely
   to make the TEST API pass or rotate a sandbox-working key without evidence.
3. Test sandbox new purchase, cancellation, restore after reinstall, owner switch,
   grace/expiration, refund/revocation, failed verification and duplicate taps.
4. Only after acceptance, align both client/server billing flags in one release.

## Physical-Device Acceptance

Use dedicated disposable test accounts and synthetic training records, not the
owner's account. Record app build, iOS/watchOS/device, exact steps, result and any
video/log evidence. A source assertion or browser screenshot is not a pass here.

| Journey | Acceptance |
| --- | --- |
| Fresh install and email/Apple/Google sign-in | Correct owner and useful errors; no other account's history |
| Permissions denied, later enabled | Graceful unavailable states, no invented Health/location values |
| Screen locked GPS workout | Distance/time preserved, correct pause/resume/finish, no duplicate session |
| Interruption and force-close recovery | Explicit recovered state; saved history and active run not silently lost |
| Watch disconnect/reconnect | Correct phone/watch state without duplicate completion |
| Offline save and later sync | Same stable IDs, retained local records, truthful backup state |
| Account switching and reinstall | No ownership reassignment, restored backup matches the original owner |
| Goal expiry and next focus | Archive once after the local event day, retain actual history, optional result, next goal or durable open training; failed saves and relaunch preserve a usable current plan |
| Health recovery failure | Existing activity preserved, useful limitation/error; no fabricated splits |
| Tours and activity detail | Replay starts on the selected screen; safe bubbles and readable narrow layout |
| Optional analytics and diagnostics | No events before consent; no Health/GPS/media/chat in vendor payloads |
| Paid lifecycle | Real StoreKit sandbox outcomes and server entitlement agreement |
| Account deletion | Provider revocation, cloud purge, local cleanup, no recreation, actual completion receipt |

## App Review Draft Instructions

Create a dedicated reviewer account through the normal auth flow; keep its
credentials in App Store Connect's restricted review fields, not this file. Leave
the backend online. Do not disclose private API or signing keys.

- Sign in and review Today, Calendar, Running, activity history and Settings.
- Permissions are optional until their feature is used. Missing measurements
  appear unavailable, not estimated as if measured.
- AI Coach requires the separate AI-sharing choice. On-device Insights remain
  available when sharing is declined. Describe any enabled paid requirement
  accurately for the exact reviewed build.
- Account & Legal contains privacy, terms, support, Apple subscriptions and account
  deletion initiation. Explain the real processing workflow and time only after
  it is operationally accepted. Do not describe a pending request as completed.
- Work/appliance comparisons are labeled estimates/analogies, not electricity
  generation, clinical assessment or guaranteed injury prevention.

## Owner And Independent Review Gates

Apple agreements/tax/banking, current privacy/age/export declarations, legal
entity/contact details, territories, real release-candidate screenshots, reviewer
access, vendor spending controls, and manual public-release settings still need
verification. No blanket No answers to age-rating questions and no guessed legal
declarations. No public App Review submission or release is authorized by this file.

For outside review, request a capped fixed-scope report with severity, reproducible
steps, affected code and retest evidence. Suggested scopes are a senior iOS/RN
privacy/data/native audit, independent iPhone/Watch QA, and a licensed consumer-
fitness/privacy attorney. No contractor has been contacted, given source access,
or hired, and no budget has been approved. The assistant's multi-lens review is
not an independent professional clearance.
