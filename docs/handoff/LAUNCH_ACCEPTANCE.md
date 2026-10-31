# Launch Acceptance And Reviewer Packet

This is an execution checklist, not a legal opinion, independent audit, physical-
device report, or assertion that the app is ready for the market. Public payments
and public release remain disabled until the relevant gates are actually passed.

## Owner-Independent Engineering Receipts

- Privacy/AI consent, server quotas, guarded purchases, tour replay, activity
  spacing and safer listing copy: committed baseline `399bcac`.
- Dependency high/critical remediation: pinned patched upstream packages plus
  CommonJS adapter; real dependency-consumer and malicious-input tests. Fresh
  lockfile installation and full iOS JavaScript/Hermes export completed.
- Backend separation: existing Bet Desk and StrideOS projects retained, empty
  legacy tables archived non-destructively, production URLs checked. See
  `BACKEND_ISOLATION.md`.
- Deletion: request receipts, immediate cloud freeze, private operator manifest,
  lease/ownership guards, Storage API removal and verified completion checks.
  Social-provider revocation and device cleanup are not accepted yet.

## Billing Handoff

RevenueCat project `1a3600d5`; entitlement `pro`; approved source identifiers
`strideos_pro_monthly` and `strideos_pro_annual`. No lifetime product or unlimited
analysis promise. The initial source paid gate is AI Coach chat only, capped at
20 requests/account/UTC day and service availability, not all future coaching.

1. Owner connects the Apple in-app purchase P8 key in RevenueCat's App Store app
   form, including Key ID, Issuer ID and `com.mooremovement.strideos`. Creating
   or granting credentials requires the owner's explicit action. No keys in chat.
2. Owner approves included paid features, prices, territories and any trial. The
   $9.99/month, $79.99/year, seven-day trial remain a proposal, not live products.
3. Create the Apple subscription group/products, attach them to `pro`, add the
   monthly/annual packages to the current offering, and verify localized prices.
4. Store only the public iOS key in EAS. Store the RevenueCat read secret only in
   Supabase's server secret store. Never put server keys in `EXPO_PUBLIC_*`.
5. Test sandbox new purchase, cancellation, restore after reinstall, owner switch,
   grace/expiration, refund/revocation, failed verification and duplicate taps.
6. Only after acceptance, align both client/server billing flags in one release.

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
