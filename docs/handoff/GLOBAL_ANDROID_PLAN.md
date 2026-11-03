# International And Android Release Decision

## November 3 preparation update

The current owner-independent council used two independent automated reviewers
and cross-examination; see `COUNCIL_LAUNCH_PREPARATION_20261103.md`. No Android
implementation, build, account purchase or Play acceptance occurred. Keep this
as a post-iOS track and respect the naming review in `SOCIAL_HANDLE_REVIEW.md`.
The older geography, fee and configuration observations below retain their dated
scope; reverify provider prices and storefront requirements before execution.

Existing groundwork is limited: `app.json` defines the Android package, version
code, adaptive icons and basic permissions; `eas.json` has a preview APK profile.
Expo 57 dependencies do not establish an accepted Android artifact or device flow.

| Preparation step | Source-grounded gap and acceptance target |
| --- | --- |
| Define initial supported features | Preserve phone training/history/manual workflows. HealthKit is iOS-gated in `src/lib/healthKit.ts`; Apple Watch, Live Activities and Apple-only pose modules do not establish Android equivalents. Health Connect is a separate implementation decision; Wear OS is outside this initial draft. |
| Resolve existing-user sign-in | Google uses browser OAuth in `src/store/authStore.ts`. Test Android callback, cold start, cancellation, recovery and account isolation later. The non-iOS Apple button in `src/components/auth/SocialAuthButtons.tsx` still calls native Apple auth; that SDK does not support Android. Define a supported existing-Apple-user access/linking route without duplicate identities. |
| Accept Android recording and devices | Review foreground-service/background-location configuration, visible notifications, battery restrictions, interruptions, maps, BLE, media permissions, single save/restart and deletion on actual Android devices. `app.json` currently enables the iOS location background flag, not proof of Android background behavior. |
| Prepare Play billing separately | `src/lib/revenueCat.ts` explicitly gates billing to iOS. Prepare separate Play products/base plans, SDK key mapping, entitlement ownership and server verification. Require actual pending/cancelled purchase, purchase/restore, renewal, expiry and refund/revocation evidence before enabling it. |
| Prepare owner signing and store handoff | Existing Play ownership, account verification, upload-key custody/recovery, Play signing and scoped submission access are unverified. Prepare actual Android screenshots and privacy/Data safety/health/deletion declarations for implemented behavior. Create no new credentials, accounts or services during preparation. |

Primary versioned references: [Expo 57 AppleAuthentication](https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/)
and [Expo 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/).
An iOS acceptance result does not close any Android row.

## Historical October 31 decision

Decision checkpoint: October 31, 2026. The owner delegated the geography decision
to the council, requested a path informed by Runna, Strava and Nike Run Club,
asked to avoid unnecessary costs, and confirmed eventual Android availability.
This is a single-assistant multi-lens review, not independent agents or legal
clearance. It authorizes preparation, not public release or new spending.

## Evidence

- Runna's September 2025 announcement describes more than 180 countries, iOS and
  Android, and a staged expansion beyond English into seven additional languages.
  This dated company statement is not an exact current storefront matrix:
  https://www.runna.com/press/runna-launches-in-seven-languages .
- Nike's November 2024 announcement reports NRC on both platforms, more than 160
  countries and 11 languages, with free member experiences. This is also dated,
  not a complete current country list. Nike's retail website country selector is
  not evidence of NRC availability:
  https://about.nike.com/en/newsroom/releases/nike-run-club-app-new-features .
- Strava's September 2026 support page explicitly describes partial/full regional
  restrictions, including purchases. Do not copy its restrictions as a legal
  determination for StrideOS:
  https://support.strava.com/en-us/articles/15401978-is-strava-available-in-my-country .
- Apple permits specific storefront selection and future expansion; selecting all
  also enables future territories automatically. Availability is not compliance:
  https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store/ .
- Current source has an Android package identifier but billing is explicitly
  iOS-only and HealthKit is iOS-gated. No Android build/device/Play acceptance is
  established by the Expo configuration.

## Council And Cross-Examination

- First Principles: athlete trust and useful repeat use precede territory count;
  support the current English experience well and preserve metric/imperial units.
- Expansionist: a permanent US-only strategy would unnecessarily restrict future
  reach. Keep global distribution, localization and both phone platforms in the
  architecture rather than create separate national products.
- Contrarian: more countries are not costless just because there is no new
  database fee. Health data, consumer renewals, tax, AI-provider permissions,
  language obligations and support all still matter, including for free users.
- Athlete/Outsider: show the real local store price and supported features. Never
  advertise Android, translations or hardware parity before they work.
- Platform/Data: use the same StrideOS identity and durable history across stores;
  retain store-specific billing products and native permission boundaries.
- Executor: prepare reversible drafts, keep billing off and manual public release,
  avoid new paid services, and require concrete acceptance before expansion.

Cross-examination: the Expansionist accepts that established brands' legal and
support capacity cannot be assumed for a new product. The Contrarian accepts
that staged expansion is better than an indefinite single-country ceiling.
Neither a country checkbox nor a successful iOS archive clears another market
or proves Android readiness.

## Chair's Call

International-first architecture, phased activation. Initial candidate draft
footprint: United States, United Kingdom, Canada, Australia and New Zealand.
Prepare both subscription durations and matching trial coverage consistently.
Do not auto-enable newly added territories. This is a commercial preparation
choice, not a finding that English-only materials satisfy every local obligation;
regional review, including Canadian language requirements, remains a launch gate.
Do not remove an existing live market blindly; verify the actual app status first.

Expand beyond these candidates in measured batches after reliable core usage,
real local demand, language/content QA, support capacity and applicable regional
requirements are verified. No exact match to all three competitors' territories
has been established, and no fabricated universal competitor list is used.

AI-provider geographic rules must be checked for the actual release date and
users, not merely the backend's US location. The Anthropic supported-regions page
retrieved during this review is effective November 12, 2026, which is later than
this checkpoint; do not treat that future policy as proof of current permission:
https://www.anthropic.com/legal/supported-regions .

## Cost Boundaries

- No new national Supabase projects, duplicate RevenueCat projects, attribution
  SDKs, ads, paid translation service, plan upgrade or contractor is purchased.
  Existing infrastructure is reused; usage growth can still increase costs.
- RevenueCat currently advertises no charge up to USD 2,500 monthly tracked
  revenue, then a 1% MTR fee. It is not free forever, and MTR is not profit:
  https://www.revenuecat.com/pricing .
- Google's currently stated Play registration fee is USD 25 once, if a new
  developer account is needed. Verify existing ownership first and obtain the
  owner's payment approval when Android publication is actually needed. Do not
  pay or create a duplicate account now:
  https://support.google.com/googleplay/android-developer/answer/6112435 .
- Existing store commissions, vendor renewals, AI, maps, media, hosting and support
  costs remain. Request-count limits are not guaranteed dollar spending caps.

## Android Acceptance Path

1. Keep `com.mooremovement.strideos`, the StrideOS Supabase project and the same
   account UUID/RevenueCat App User ID model; do not mix Bet Desk into this path.
2. Reuse entitlement `pro`, with separate Google Play products/base plans and a
   client-safe Google SDK key. Remove the current iOS-only billing gate only in
   a tested Android implementation. Never put server keys in public app config.
3. Review sign-in/account linking, owner switching, offline history and account
   deletion on both platforms. Cross-platform access must not cause duplicate
   subscriptions or reassign someone else's training history.
4. Add Android health integration only through an appropriate Health Connect
   implementation and permissions; do not represent HealthKit or Apple Watch as
   cross-platform. Audit custom native-module Android fallbacks first.
5. Test background/locked-screen GPS, foreground service/notification permissions,
   interruption, battery restrictions, maps, media, denied permissions and cloud
   recovery on real Android devices, not only an emulator or JS tests.
6. Verify the then-current Play API/SDK, privacy/health declarations, Data safety,
   testing-track and billing requirements. Stage an Android beta after iOS core
   acceptance; do not promise a public Android date without these receipts.

## Execution Status

Apple monthly/annual product drafts and RevenueCat mappings are saved. Both
availability readbacks list five markets and both saved free-first-week offers
list five with no end date. The monthly country popover explicitly matches the
five candidates. Both subscriptions are service level 1, with StrideOS Pro as
the English (U.S.) group display name. App-level availability now matches those
five, with automatic future territories off. The stale pre-order schedule was
removed; saved rows show Available on App Release. Manual release was selected
and saved after clearing that schedule. The saved RevenueCat default offering
maps both standard packages to
the correct Apple products, with both products attached to `pro`. Prices and
seven-day trial drafts are owner-approved. Exact saved local prices are recorded
in `LAUNCH_READINESS.md`. Both durations now disallow multiseat purchasing and
use individual App Store purchases only. Server v10 supports a V2 customer-read
key; owner key entry, notification delivery and sandbox lifecycle acceptance are
still pending. Billing remains disabled.
No Android account purchase, Android build, public App Review submission or public
release has been performed by this decision.
