# StrideOS Launch Readiness

Password-reset incident update: the first reset reportedly worked, but repeating
it after closing StrideOS left build 109 on **Finishing sign in…**. Email delivery
is accepted; native recovery is not. The scoped source fix passed 1,623 tests and signed-archive checks; **build 111
is VALID / IN_BETA_TESTING internally**; see `AUTH_RESET_COLD_START_20261102.md`. Do not
claim the installed build or public draft contains this fix before replacement
artifact/upload/device acceptance is verified. No data deletion or public release.

Email update, November 2: the owner completed **strideosfitness.com** registration.
Vercel order is completed for one year; expiration November 2, 2027, listed
registration price $12.03 (final charged tax/total not independently inspected).
**Auto-renew was disabled and independently read back false.** Resend Free is
retained. **auth.strideosfitness.com is Verified / ready to send** after exact
DKIM/Forge DNS records were added and verified through authoritative/public DNS.
Root/wildcard/CAA records and the free website URLs are preserved. No paid
hosting, add-on, mailbox or agent-initiated second purchase.

Email connection follow-up: **the owner saved SMTP, and it remains enabled after
reload.** The saved password is hidden; the Resend key metadata confirms Sending
access restricted to auth.strideosfitness.com. Both branded confirmation/reset
subjects and complete HTML bodies are now saved and match canonical files after
reload. The exact native callback is already allowlisted. The privacy update
covering recipient/authentication-link/delivery processing is published and
verified live (HTTP 200, exact local match, Pages built).

**One real password-reset inbox delivery is accepted** from the owner report
and two iPhone Gmail screenshots: expected sender/subject, Inbox label, TLS
header and visible branded rendering. No message was sent by the agent and no
raw reset URL was retrieved. **Native recovery remains unaccepted**: the owner
has been asked to follow the link, save a password privately and verify sign-in. Signup is still off, and Confirm email is also off: enable and
test the intended confirmation policy before reopening registration. Stored SMTP
and template previews do not prove delivery. Current receipt:
`email-templates/RESEND_SMTP_ACCEPTANCE_20261102.json`.

The Claude API organization limit is separately saved/read back at **$20/month**;
no credits bought or auto-reload changed. The earlier Brevo/no-domain proposal
is superseded by the completed domain and Resend configuration above. It does
not reopen any closed launch gate or enable billing/public release.

Latest independent preparation, November 2: private purchase-test **110** is
signed-archive verified and **VALID / IN_BETA_TESTING internally**, isolated from
the saved public draft **109 / manual release / Prepare for Submission**. No
global billing or QA owner was enabled. AI Coach v14 deploys the existing inert
single-owner test policy; downloaded source matches, 49 focused tests and seven
post-deploy boundary checks passed. A new read-only home preflight passed 9/9
preparation checks; its ten focused safety/boundary tests and TypeScript passed.
These checks do not accept real devices, deletion, email or purchases.
The earlier undeployed email-template checkpoint is superseded by the saved
SMTP and exact template readback recorded above. RevenueCat product mappings and
the existing public iOS SDK key match were freshly verified. Production
notification TEST 401 remains unresolved. See
[`HOME_LAUNCH_SESSION_20261102.md`](HOME_LAUNCH_SESSION_20261102.md) for each
section's estimate and owner-only actions, and
[`BILLING_QA110_RELEASE.md`](BILLING_QA110_RELEASE.md) for the private build.

Latest continuation: **November 2, 2026** — see
[`LAUNCH_PROGRESS_20261102.md`](LAUNCH_PROGRESS_20261102.md). Source regression
passed 1,581/1,581; scoped live database acceptance passed 1,262 checks. Reviewed
Apple custody/deletion functions are deployed and privacy is updated. New public
registrations are temporarily closed pending secure email setup; existing
reviewer login is verified. The owner registered/downloaded the separate Apple
key and main installed/verified its server settings. New native **109** is
signed-archive verified, **VALID / IN_BETA_TESTING internally**, and selected in
the saved manual-release draft. See [`BUILD109_RELEASE.md`](BUILD109_RELEASE.md). Real
provider/device/billing acceptance, production email and current native assets
remain open. No public review submission or release has occurred.

Prior artifact checkpoint: November 1, 2026 Pacific. Canonical Developer source
`cf41d1a38b3353f8de2fb84363fcdfdb1b16a428` is committed and pushed. Engineering
and scoped council reviews are not a human security audit, clinical validation,
legal opinion or physical-device acceptance. Dated evidence below is preserved;
conflicting old readiness/next-build instructions are superseded by this status.

## Prior Checkpoint — 108 Internal TestFlight; Device Acceptance Pending

- **Source checks complete, per parent:** final full suite **1,451/1,451 passed**
  and `npm run check` passed. Ignore exclusions were verified. These are supplied
  main-task receipts, not a new test run by this documentation seat.
- **Intended target:** one production-configured iOS **1.0.0 / 108**, billing-off
  internal TestFlight candidate. `app.json` names 108; `eas.json` production now
  explicitly pins `EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED="false"`. Private billing
  QA is deferred. Production configuration does not imply public distribution.
- **Finished build and actual-artifact checks, per parent:** EAS
  `f647a146-5f2c-4ff9-b32d-ad15989c92c7`, source `cf41d1a`.
  Actual IPA deep/strict signature verification passed; all three targets are
  108, with 21 parsed privacy manifests, Hermes `.0.17`, and an opaque 1024 icon.
  Sentry source-map report 108 and cloud Doctor **21/21** passed.
- **Exact-build internal TestFlight upload succeeded, per parent:** submission
  `d4180bb6-437f-426f-9aa2-365ef33f6ac3`. Fresh supported CLI readback confirms
  **108 VALID / IN_BETA_TESTING, not expired**, with exact EAS/submission IDs.
  Internal availability is accepted; installation/device acceptance remains pending.
  Main records the detailed receipt in `BUILD108_RELEASE.md` and
  `APP_STORE_DRAFT_REVIEW.md`. No build or submission was initiated by this
  documentation edit.
- **Medical-device declaration complete, per owner/parent receipt:** owner
  confirmed general fitness only and no medical-device status; Apple saved
  **No**, with readback “declared not a regulated medical device in any country
  or region”. This supersedes historical pending wording, without asserting
  independent regulatory certification.
- **Reviewer credential mismatch resolved, per owner/parent receipt:** owner
  created a dedicated user and updated Apple's restricted review fields. A fresh
  supported metadata pull followed by the same private authentication check
  returned `correctProject: true`, `reviewerLoginSucceeded: true`, HTTP 200.
  This supersedes the earlier HTTP 400 failure. Native reviewer sign-in and
  navigation remain pending; no credentials are recorded here.
- **App Privacy publication gate closed for current billing-off 108, per parent
  final full-reload receipt:** exactly 11 types, all linked to user identity,
  with the agreed core purposes. Health, Fitness, Name and Other User Content
  use Functionality + Personalization; Product Interaction uses Functionality +
  Analytics; Email Address, User ID, Precise Location, Photos or Videos, Crash
  Data and Other Diagnostic Data use Functionality. No incomplete/Set Up banner,
  Data Not Linked section or Data Used to Track section remains. Explicitly
  reselecting Yes for Health, Fitness and Other User Content removed the earlier
  duplicate unlinked preview entries on final reload. Temporary evidence:
  `/tmp/strideos-publish108-privacy-readback.json` and
  `/tmp/strideos-publish108-privacy-final.png`; the JSON was checked by this seat.
  Parent's complete secrets-name inventory found both server billing enablement
  and QA-owner settings absent; source defaults disable RevenueCat verification.
  Reassess the labels before future purchase enablement or support-workflow
  changes. This closes the declaration gate, not the other public gates below.
- Source includes the fresh-install ownership bootstrap fix, profile-based
  greeting/Settings identity, removal of fabricated Settings history, corrected
  account/injury copy, truthful unlinked manual-activity presentation, and the
  final deletion-retention wording. The last copy diff changes two text nodes,
  not handlers or state behavior; retained status/recovery records are disclosed.
  It does not activate deletion or billing.
- Simulator **107**, source `3e1513c`, has bounded native evidence for isolated
  first-login/onboarding and fictional manual run/hike save/readback. It predates
  the later product-copy fixes. Its accepted original captures remain evidence
  of that exact build; held/outdated views are not corrected by editing image
  text. See `NATIVE_CAPTURE_BOOTSTRAP_FIX.md` and the capture manifest. Historical
  106 archive/internal-TestFlight receipts are not fresh-login acceptance for 108.

### Public Gates Remain Open

- Accept the exact inspected 108 artifact on the physical phone and advertised
  paired Watch/Health/GPS paths, including history safety, interruptions/offline,
  permissions and account isolation. Owner-deferred testing remains pending.
- Make ordinary-user in-app deletion operational and accepted. Latest parent
  readback: automation **off**, allowed-owner count **0**, deletion cron **0**;
  endpoint v3 and status/worker v1 being active does not change that. Real
  provider revocation, native cleanup/restart, support timing and retention/
  backup decisions remain open. Synthetic completions and retention copy are
  not activation or public-service acceptance.
- Finish remaining applicable store answers, native reviewer navigation and
  current native assets. The current billing-off privacy publication gate is
  closed on the receipt above. Preserve manual public release. Existing Active
  agreements/banking/W-9 are not erased
  by these remaining gates and need not be repeated absent changed evidence.
- Public purchases remain off; the separate server-applicability readback above
  supports the current billing-off privacy scope. If monetizing later,
  real purchase/restore/lifecycle acceptance and the intended paid artifact are
  still required; a billing-off beta does not prove them.

The independent recommendations in `PUBLISH_REVIEW_20261101_CONTRARIAN.md` and
`PUBLISH_REVIEW_20261101_DATA.md` support bounded beta preparation while keeping
public gates open. The data review's P2 retained-record copy finding is resolved
in `cf41d1a`; its operational/provider/privacy findings remain distinct.
The current label-publication finding is closed by the later receipt above;
operational/provider acceptance remains open.

## Historical Continuations — 106 And Earlier

The following dated receipts retain their original source/build scope. They do
not supersede the current 108 build/submission status or close its public gates.

- Owner completion, November 1 Pacific: live Apple reload confirms the updated
  Developer Program agreement was accepted November 1. After the owner accepted
  the separate updated paid terms, **Paid Apps Agreement, Free Apps Agreement,
  bank account and U.S. Form W-9 all show Active**, with no new-agreement banner.
  Earlier missing/processing/new-agreement business states below are historical.
  No public release or production billing activation. See `APP_STORE_DRAFT_REVIEW.md`.
- November 1 Pacific store continuation: saved Health & Fitness / Sports
  categories and corrected/completed the current age questionnaire; main rating
  remains 13+. Apple Business now explicitly requires the Account Holder's
  updated Developer Program agreement and missing bank/W-9 information for paid
  apps. No agreement was accepted, financial data entered or medical-device
  declaration submitted. Privacy-label reconciliation is prepared locally;
  Apple's immediate Publish action was not used. See `APP_STORE_DRAFT_REVIEW.md`
  and `PRIVACY_LABEL_RECONCILIATION.md`. The owner deferred device testing; this
  continuation does not claim it occurred.
- Supported runtime candidate: Expo 57.0.31 / RN 0.86.3 replaces SDK 56's known
  Hermes memory regression. Build 106 finished from exact source
  `13feb937c5c94d223635ab9509ab1090ba7f0d2b`, EAS
  `6464cf85-f61a-4d9c-9eaa-92aec14056ba`. Canonical tests passed 1,412/1,412;
  TypeScript/Expo checks and Hermes export passed. Cloud Doctor passed 21/21 and
  installed Hermes 250829098.0.17 on pinned Xcode 26.6. The actual IPA passed
  signature, entitlement, icon, privacy-manifest and embedded-runtime checks;
  Sentry source-map upload was confirmed. Submission
  `e089be5d-989e-4229-ac53-705afc49a660` finished, and Apple confirms
  **VALID / IN_BETA_TESTING** for the existing internal group. Physical device
  installation and acceptance remain open; see `BUILD106_RELEASE.md`.
  Build 105 remains a compiled/inspected baseline,
  deliberately not submitted. The post-snapshot private billing-QA preparation
  is source-only, unbuilt and undeployed; production payment settings were not
  enabled. Its 49 focused checks passed independently, with no live side effects.
- Earlier Build 105 source/publication receipt (superseded by 106 above): app
  source `04158fc924692611e6f4bbef4b4ff9128f96ed2b` is pushed. Final regression
  **1,412/1,412 passed**, zero skips, **154.8s**; 49 backend Deno tests and
  backend checks, native prebuild and Hermes export passed. Build **105** is
  finished as `d639ada9-80c2-413c-adb8-2f59da229b5a` from that exact commit.
  Its actual archive was inspected, then held from submission because of the
  documented SDK 56 runtime regression; 106 replaces it for internal testing.
  Privacy/terms/support were published separately as only three files to the
  existing Pages branch in `d9e8749ddd55158a0145f31761d00887a44d6ecc`.
  Pages built at **06:06:56Z**; parent uncached readback verified all three
  **HTTP 200** and byte-for-byte matches. Exact hashes are recorded in
  [`DELETION_ACCEPTANCE.md`](DELETION_ACCEPTANCE.md). Billing remains off;
  policy publication is not app release or legal clearance.
- Post-Build-104 deletion checkpoint: [`DELETION_ACCEPTANCE.md`](DELETION_ACCEPTANCE.md)
  records parent-verified `account-deletion` v3, status/worker v1, three live
  synthetic server completions including scheduler-only recovery, unchanged
  original-account counts, and the final automation-off/empty-allowlist/no-cron
  state. Real Apple/Google grant revocation and native cleanup/device QA remain
  open. The corrected policy pages are published with the receipt above;
  billing remains off. Earlier operator-only/deployment receipts below retain
  their historical scope and do not describe this latest checkpoint.
- The owner explicitly authorized separating Bet Desk and StrideOS without unnecessary deletion. Both apps already had dedicated projects; the mistaken shared-auth conclusion came from empty legacy Bet Desk tables in StrideOS. Bet Desk's web and mobile production URLs were freshly verified against its dedicated project. Nine empty legacy tables were preserved in a private archive schema, with the same relation identities and counts, and their obsolete Auth foreign keys detached. No accounts, files, training history, bets, or projects were deleted. No paid upgrade was needed. See `BACKEND_ISOLATION.md` for evidence and the failed, non-billed new-project attempt.
- All seven high dependency findings were removed through narrowly scoped patched upstream dependencies. The later runtime upgrade addresses the separate Hermes regression. The CommonJS adapter delegates URI parsing to exact upstream decode-uri-component 0.5.1. Real Router parsing, bounded malicious inputs, Metro assets, Expo CLI schemas, and both plist consumers have dedicated tests. SDK 56's post-Babel audit had 17 findings; the latest SDK 57 audit has **16 (15 moderate, one low), zero high/critical**. See [`DEPENDENCY_EXPOSURE_REVIEW.md`](DEPENDENCY_EXPOSURE_REVIEW.md) for the earlier root exposure review and `BUILD106_RELEASE.md` for runtime receipts. Residual findings are not zero vulnerabilities or independent clearance.
- Guarded deletion fulfillment is implemented as an operator command with a read-only default, an exact-receipt execution confirmation, database leases, Storage API removal before Auth removal, and verified completion. Cloud access freezes at the recorded request even for older clients. The real existing Apple-linked account remains blocked until provider revocation is configured; no deletion command was run against it. This is not a completed automatic end-user deletion service.
- RevenueCat project `1a3600d5` now has a saved App Store connection with Valid credentials, both Apple product mappings attached to `pro`, and the verified default offering. The owner approved USD 9.99/month, USD 79.99/year and seven-day trial drafts. Public iOS SDK and owner-saved read-only server credentials are configured; billing remains off. Apple notification URLs persist in both environments. Official sandbox TEST delivery succeeded; production TEST returned 401. Real subscription lifecycle acceptance and the remaining public-launch gates are still open.
- Initial full regression rerun passed 1,227/1,227 tests. A fresh `npm ci --ignore-scripts` succeeded from the lockfile; clean-install validation is tracked in the continuation's final receipts. Full iOS Metro/Hermes export passed (3,713 modules, 109 assets). This proves JavaScript bundling, not native compilation or device behavior.

### Final Engineering Checkpoint

- Final regression after the additional false-completion test: **1,228/1,228
  passed**, no failures/skips, `/tmp/strideos-launch-release-tests.log`, 120.5s.
  Semantic TypeScript, Expo SDK compatibility and diff checks passed.
- Actual-component browser fixture rerun: **28/28**, no page errors or external
  requests, dark/light and 320/393/768 widths. Still synthetic, not native QA.
- A separate directory with no pre-existing `node_modules` installed the lockfile
  successfully. Its decoder resolves to its own copied vendor adapter, not the
  canonical checkout. Phone, Watch and Live Activity prebuild passed there. The
  existing missing optional `expo-system-ui` background-color warning remains;
  neither SDK 57 nor React Native 0.86 was adopted despite CLI recommendations.
- All deletion SQL changes were transaction-probed before applying and probed
  again afterward. Null leases, mismatched storage ownership, client RPC access,
  false completion and cross-app Auth references are checked. Synthetic users,
  requests and Storage metadata fixtures were rolled back and absence verified.
  No physical test object was uploaded/deleted and no customer was removed.
- Latest security advisor: only leaked-password protection (paid-plan setting).
  Latest dependency scan: zero high/critical, 18 moderate/low.
- GPS, HealthKit, Watch/Live Activity code, route builder, strength engine and
  root startup show no diff from this continuation's baseline.

Single-assistant multi-lens release review: the platform view supports a limited
TestFlight candidate after these checks; the contrarian view rejects any public-
launch claim while provider revocation, billing and physical/independent reviews
remain open. The resolution is beta testing only, payments unchanged/off, not
App Review or public release. Engineering confidence for that bounded candidate
is 95/100 as a judgment under the repository gate, not a measured reliability
probability. Native compilation, upload and Apple processing must each be checked
separately and appended after they happen. No score waives the public-launch gates.

## Scope And Decision

### Build 103 Native Dependency Correction

- EAS attempt `0305390e-f719-4834-8273-0c7c93488835`, source `5cd58a0`,
  stopped at CocoaPods resolution. No archive or submission was produced.
  RevenueCat 11.0.0 requires unpublished PurchasesHybridCommon 20.1.0.
- RevenueCat's official 11.0.0 release notes explicitly tell Expo apps to remain
  on 10.x: https://github.com/RevenueCat/react-native-purchases/releases/tag/11.0.0 .
  Pinned 10.16.0 uses PurchasesHybridCommon 19.17.0, verified present in the
  CocoaPods registry (published October 27). A regression test checks the actual
  installed podspec and exact lockfile pin. No Sentry, tracking or Watch change.
- Build number 103 is retained for a corrected retry because Apple never received
  the failed attempt. This correction does not enable payments or settle the
  outstanding purchase/device/public-launch acceptance gates.
- Corrected-source checks: **1,229/1,229 tests passed**, zero failures/skips,
  `/tmp/strideos-build103-fixed-tests.log`; TypeScript, Expo compatibility and
  diff checks passed. The dependency scan remains 18 moderate/low, zero
  high/critical. Native compilation and Apple processing are still separate.

### Build 103 Archive And Upload Receipts

- Corrected EAS build `897870a6-e736-43fb-a0d5-a9618bac60e9` finished successfully
  at 18:49 UTC on October 31, source `4e06c841cff504375503a9efced213af7bfa20e4`.
- The actual IPA was downloaded and inspected, not just its dashboard metadata.
  Phone, Watch and Live Activity plists all resolve to version 1.0.0, build 103
  and the intended bundle identifiers. Phone/extension use iPhoneOS 26.4 SDK;
  Watch uses watchOS 26.4. Strict deep code-signature verification passed; the
  phone has the expected team, HealthKit, Apple sign-in, production APNs and
  app-group entitlements, with debugging disabled. All 20 included privacy
  manifests parsed successfully. These are archive checks, not device tests.
- The archive's compiled asset catalog contains an opaque 1024x1024 AppIcon,
  verified with `assetutil`. Expo prebuild also generated an RGB/no-alpha icon;
  the source PNG's alpha channel was not mistaken for the final compiled icon.
- IPA SHA-256: `04d709da1979dd165e221f4e042c203b07450ed2207c52630ca8dc3424a7d24f`.
  Local artifact `/tmp/strideos-build103.ipa`; extracted archive
  `/tmp/strideos-build103-archive`.
- Xcode logs confirm Hermes source-map artifact upload to Sentry release
  `com.mooremovement.strideos@1.0.0+103`, dist 103, and 29 missing debug files
  uploaded. This is not proof of a consented device event or symbolication.
- Exact-build submission `48eade6b-98b4-4067-81e3-e4478e54aff1` successfully
  uploaded the binary to Apple App Store Connect (`FINISHED`, 18:53 UTC).
  Subsequent `eas submit:status` readback lists 103 as `VALID`,
  `IN_BETA_TESTING` internally and `READY_FOR_BETA_SUBMISSION` externally.
  This proves Apple processing/internal beta state, not a particular tester's
  installation, external-beta approval or device acceptance.
  No public App Review submission, public release or paid switch was performed.

### Private Purchase-Key Handoff

- The owner generated and downloaded a dedicated Apple In-App Purchase key.
  Apple keys are account-level, not app-limited; the intended RevenueCat
  connection is StrideOS only. Do not reuse an EAS upload key or Sign in with
  Apple key in this field.
- At the owner's explicit request, the downloaded folder was moved outside both
  source checkouts into the owner's private home credentials directory. Inode
  and byte count matched after the move; directory permissions are 700 and the
  key is 600. The key contents were not opened, printed, committed or uploaded
  by the assistant. The owner must maintain a secure backup; none is asserted.
- The older iCloud checkout already ignored `.p8` files in Git but lacked that
  explicit EAS rule. A one-line `*.p8` safety exclusion was added there only,
  without building from or committing that older checkout. The canonical
  Developer checkout already had both exclusions. No private key is tracked.
- The owner uploaded and saved the P8 key directly in RevenueCat. App Store app
  `app173317761f`, bundle `com.mooremovement.strideos`, shows **Valid credentials**.
  The optional general App Store Connect API key was not added; the products
  were mapped manually, avoiding another broad credential handoff.

### Billing And Store Draft Receipts

- Apple subscription group `22532701` / StrideOS Pro. Monthly product
  `strideos_pro_monthly` has Apple ID `6829288874`, duration one month; annual
  `strideos_pro_annual` has Apple ID `6829293174`, duration one year. Both are
  prepared, not submitted for public review. USD base prices 9.99 and 79.99 were
  selected, reviewed and saved with Apple's generated currency schedules.
- Both products now have service level 1, read back after saving, because monthly
  and annual grant the same Pro service. English (U.S.) group display name
  StrideOS Pro is saved, with the app's normal name used in subscription settings.
- Both products have English (U.S.) display names and the bounded description
  "AI Coach chat with training context and daily limits." No unlimited-analysis,
  medical, video-analysis or additional paid-planning promise was added.
- Initial product availability drafts use United States, United Kingdom, Canada,
  Australia and New Zealand, with automatic future territories off. The annual
  upfront plan has an explicit five-country saved readback. Its separate
  monthly-with-a-12-month-commitment variant remains unconfigured. Monthly
  availability has the saved readback of five of 175 selected countries.
- Annual introductory offer readback: October 31, 2026 to No End Date, five
  regions, free for the first week. The monthly saved offer table now matches;
  its five-country popover explicitly lists Australia, Canada, New Zealand,
  United Kingdom and United States.
  These do not establish actual sandbox eligibility, renewal or public sale.
- Saved current-price readback, filtered to the five available markets:

  | Storefront | Monthly | Annual |
  | --- | ---: | ---: |
  | United States (USD) | 9.99 | 79.99 |
  | United Kingdom (GBP) | 9.99 | 79.99 |
  | Canada (CAD) | 12.99 | 99.99 |
  | Australia (AUD) | 14.99 | 129.99 |
  | New Zealand (NZD) | 19.99 | 149.99 |

  These are Apple's saved generated price schedule, not a hand-calculated foreign
  exchange quote or a promise that prices never change. All ten rows also showed
  free for the first week. Both purchase options are now saved/read back as
  App Store only, multiseat Not Allowed. This matches the individual-account
  implementation; no group seat-management feature is represented as available.
- RevenueCat product IDs: monthly `prod5877abc7c7`, annual `proda125e21ccd`.
  Both saved product pages were reloaded and read back as attached to entitlement
  `pro` (`entl0c642305f9`). Default offering `ofrng36b3a38697` / `default` /
  StrideOS Pro was saved and read back with `$rc_monthly` and `$rc_annual` mapped
  to those exact products. Its default status is confirmed by the dashboard.
  No Test Store placeholder products or paid paywall tool were used.
- Production EAS project now contains `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and
  `EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED=false`, verified by narrow readback.
  These settings were saved after Build 103 was compiled; they do not alter that
  already-uploaded binary or activate billing. The server flag remains off by
  configuration/default. The later owner handoff configured the server secret,
  as recorded in the build 104 continuation below.
- Apple's saved listing draft still had stale injury-prevention/video-upload
  claims. Promotional text, description and keywords were replaced with the
  truthful draft in `docs/app-store.md` and saved without Add for Review.
  The public version draft still references old build 1; it must not be mistaken
  for the accepted 103 beta. Candidate selection remains an acceptance gate.
- App-level availability now matches the five candidates, automatic future
  territories off. A stale July 5, 2026 pre-order schedule was removed from this
  not-yet-submitted app. Saved readback shows all five Available on App Release,
  not Pre-Order Pending Developer Release. Clearing the pre-order exposed Apple's
  automatic-release default; this was changed to Manually release this version
  and saved (Save disabled afterward). No Add for Review or release was clicked.
- The owner's delegated geography/Android council decision is documented in
  `GLOBAL_ANDROID_PLAN.md`: international-first architecture, phased activation,
  initial five-market candidates, shared StrideOS identity/entitlement, no new
  paid infrastructure or Android account purchase. It is not independent or
  regional legal clearance, and Android is not represented as implemented.

### Scoped Server Verification Continuation

- AI Coach v10 is deployed with JWT verification still on. Deployed source for
  the entrypoint, shared handler and new RevenueCat verifier exactly matches the
  reviewed local files. A live unauthenticated request returned 401. These checks
  do not establish a successful authenticated RevenueCat request or purchase.
- The verifier now uses RevenueCat REST v2 active entitlements, requiring only
  `customer_information:customers:read`, instead of a broad v1 secret. The exact
  API project ID `proj1a3600d5` was read from Project Settings, and the Pro ID is
  `entl0c642305f9`. The dashboard Pro mapping has only the two intended products.
  Reference: https://www.revenuecat.com/docs/api-v2/customer/resources .
- Only a verified Supabase UUID is queried. The server uses an HTTPS GET to the
  fixed project/customer route, a 10-second deadline, a 64 KiB response limit,
  exact Pro identity and finite future access expiry. It never follows a supplied
  pagination URL or a redirect with the bearer credential. Missing credentials,
  malformed/incomplete answers and provider failures fail closed before spending
  any AI allowance. RevenueCat computes the active access/grace-period state;
  actual StoreKit lifecycle behavior still requires sandbox acceptance.
- Single-assistant council check, not independent reviewers: Architecture favors
  least privilege and no customer writes. The Contrarian notes a new API contract
  can regress access and the credential is project-wide, not scoped to one athlete.
  Chair's call: keep payments off, bind the exact StrideOS project/Pro IDs, test
  real handler failures and verify deployed source before granting a key. No new
  SDK, client build, paid service or Watch/startup change is needed for this server
  adjustment. Revocation and sandbox acceptance remain separate gates.
- Eighteen focused runtime tests passed, including the real handler's allowance
  ordering, unknown/expired access, malformed/oversized answers, credential/owner
  validation and provider failures. TypeScript and Expo compatibility checks also
  passed. The earlier 1,229 full-suite receipt belongs to Build 103; it is not a
  fresh full-suite result for this continuation.
- Supabase's live secret-name table lists only ANTHROPIC_API_KEY and
  ANTHROPIC_MODEL as custom secrets. No STRIDEOS_BILLING_ENABLED override or
  REVENUECAT_SECRET_API_KEY exists, so server billing remains off by default.
  The public client flag was not changed. The CLI metadata read hung and was
  terminated; the dashboard readback, not that CLI attempt, is the receipt.
- Prepared owner handoff: RevenueCat key form named StrideOS server entitlement
  verification, API V2, Customers Configuration Read only; every other category
  remains No access. Generate was not clicked. The StrideOS Supabase secret form
  has only the name REVENUECAT_SECRET_API_KEY filled; its private value is empty.
  Owner must generate/copy/save the private key directly between the vendor UIs.
- Apple purchase notifications remain unconfigured. RevenueCat displays No
  notifications received. Connecting production and sandbox purchase events to
  the existing StrideOS RevenueCat app needs the owner's action-time approval.
  Leave Track new purchases from server-to-server notifications off for the
  SDK-driven identity flow unless a later review establishes otherwise.

### Build 104 Goal Lifecycle And Billing Continuation

- Added fixed goal/race archives, optional race results, next-goal setup and
  durable open training without deleting actual history. Expiry uses the local
  event day; a past tune-up race does not retire a future primary event. Explicit
  replacements use an owner-fenced recovery journal and atomic primary choice;
  failed saves preserve the active plan. See `GOAL_ARCHIVE.md` for semantics.
- Migration `20261031210327_owner_scoped_goal_archives` applied only to StrideOS.
  A rolled-back synthetic probe verified owner isolation, immutable summaries,
  newer explicit result merges and foreign-owner rejection; fixture absence was
  checked afterward. The RPC is security invoker; anonymous execution is denied.
  Bet Desk and customer records were not changed or deleted.
- Three independent engineering agents reviewed the scoped implementation and
  failure recovery. Final verdicts had no remaining must-fix findings. Startup
  ownership review confidence was 95/100 as a scoped judgment, not a measured
  device reliability probability or a whole-app professional audit.
- The owner saved the RevenueCat V2 read-only customer key in Supabase; only its
  name and update timestamp were read. Both billing switches remain off/default.
  After explicit approval, Apple's production and sandbox notification URLs were
  saved and verified after reload. The current editor had no version selector.
- Apple's official sandbox TEST endpoint and status lookup returned 200 with
  notificationType TEST, version 2.0 and sendAttemptResult SUCCESS at
  2026-10-31T21:23:01.834Z. Production returned 401; one compatibility-host retry
  also returned 401. Its cause remains unconfirmed. No real purchase, renewal,
  refund, charge or entitlement grant was performed.
- Apple's Commerce Engineer explains that production API access is locked before
  a first production release: https://developer.apple.com/forums/thread/806452 .
  This makes release eligibility a plausible explanation for the production 401,
  but the cited answer concerns transaction APIs, not an explicit notification
  TEST guarantee. Retest when eligible; do not release prematurely to clear it.
- For that test only, the private purchase key was read into memory to sign a
  five-minute JWT. Neither key contents nor JWT were printed, committed or
  persisted. The earlier private-key handoff receipt describes the initial move,
  not this later authorized signing use.
- Actual-component synthetic browser checks covered four new screens in both
  themes at 320/393/768 pixels (24 layout combinations), invalid inputs, failed
  save draft retention and retry. Existing web SVG/accessibility and deprecated
  pointerEvents warnings remain; console-clean or native acceptance is not claimed.
- Build number is 104. Final source, regression, native archive, upload and Apple
  processing receipts are recorded below. Build 104 is now the accepted internal
  TestFlight candidate; physical installation and device acceptance remain open.
- Frozen-source regression: **1,318/1,318 passed**, no failures/skips, 165.8s,
  `/tmp/strideos-build104-frozen-tests.log`. Final semantic TypeScript and Expo
  dependency compatibility passed (`/tmp/strideos-build104-frozen-check.log`).
  Final iOS Hermes export passed with bundle
  `entry-04dd5d53c860cb97a9c296187e0d5872.hbc` (15 MB),
  `/tmp/strideos-build104-final-export`. Diff checks passed; no private key tracked.
- Clean phone/Watch/Live Activity prebuild succeeded without installing or
  upgrading packages. All 22 Watch/version tests passed; generated embedded
  targets use build 104. Watch, GPS, HealthKit and root startup source are
  unchanged. The bounded local ownership-discovery guard now also recognizes
  retained archives/journals; its regression is included in the full suite.

### Build 104 Archive And Upload Receipts

- Source `2765920e6eaaca9ef8ea0d65acfd6841dfe537cc` was committed, pushed and
  remotely read back before the build request. EAS production/store build
  `fa67ddd8-4081-4f6b-8a1b-246fcc3a3624` finished successfully at
  2026-10-31T22:01:01.187Z. Existing plan resources and credentials were used;
  no plan upgrade, new paid service or optional add-on was purchased.
- Actual downloaded IPA inspected at `/tmp/strideos-build104.ipa`, extracted at
  `/tmp/strideos-build104-archive`. Phone, Watch and Live Activity all resolve to
  version 1.0.0/build 104 and their intended bundle identifiers. Phone/extension
  use iPhoneOS 26.4 SDK; Watch uses watchOS 26.4. Strict deep signature validation
  passed. The app has the intended team, HealthKit, Apple sign-in, production
  APNs and app-group entitlements, with debugging disabled.
- All 20 included privacy manifests parsed. The compiled asset catalog has an
  opaque 1024x1024 AppIcon. IPA SHA-256:
  `1ce41b2a97c2d4b8f158da27c11b0517c2a2f31b4e766699d81f29ad295d6d4a`.
  Receipt `/tmp/strideos-build104-archive-receipt.json` records these checks.
- Xcode log confirms source-map upload to Sentry release
  `com.mooremovement.strideos@1.0.0+104`, dist 104, and one missing debug file
  uploaded. This does not prove a consented device event or symbolication.
- Exact-build submission `11fd163d-5cb3-47b0-80bf-857359f43f5a` uploaded the
  binary successfully to Apple at 2026-10-31T22:03:30.847Z (`FINISHED`). Apple's
  Build Uploads table first listed it as Processing. Subsequent supported CLI
  readback confirms version 1.0.0/build 104 is `VALID`, `IN_BETA_TESTING` internally
  and `READY_FOR_BETA_SUBMISSION` externally, not expired, with the matching EAS
  build/submission IDs. Apple uploadedDate is 2026-10-31T15:04:53-07:00. This
  proves processing/internal-beta state, not a particular tester's installation,
  external-beta approval or physical-device acceptance. No public App Review,
  public release, tester invitation or payment activation was performed.

The user authorized working through the launch checklist autonomously and using Chrome/computer use, with owner-dependent steps last. No paid service purchase, freelancer hire, acceptance of third-party contracts, or public App Store release is being performed without the owner's specific decision. Engineering review agents do not replace independent device QA or professional legal/security review.

## Implemented In Source

- Explicit, versioned, account-bound Anthropic sharing choice. Enabling waits for storage confirmation; logout, revocation, failed storage and owner races fail closed. Chat requests and late responses are owner/consent fenced. Context disclosure includes potentially sensitive training/recovery/movement information; unrelated on-device guidance stays usable without consent.
- Authenticated AI handler with bounded input, fixed server safety instructions, sanitized errors, cancellation, no automatic retry, maximum 1,024 output tokens, and atomic reservations capped at 20 requests/account/UTC day and 500 requests globally/UTC day. Reservations are charged even if a provider call fails, to prevent retry abuse. This bounds requests, not a guaranteed dollar bill; vendor spend caps remain an owner setting.
- Authenticated, idempotent in-app account-deletion requests and receipt/status UI. Client-supplied user IDs are ignored. No existing user account or activity has been deleted to test this feature.
- Account/legal controls and signup links, corrected privacy statements about local media, route backups, AI context, deletion versus reset, and optional purchase processing. Terms and support pages and safer listing copy are prepared.
- Subscription SDK installed and exact version locked; owner-fenced serialized purchase/restore operations, only known monthly/annual products, locale prices from Apple/RevenueCat, cancellation/renewal disclosures, and no fabricated active entitlement. Billing is disabled unless explicitly enabled with a valid iOS project key.
- Tutorial replay consumes its request only after the focused/hydrated screen starts the walkthrough. Background mounted tabs cannot steal it. Bubble pointer and in-bubble close control added. Activity metric spacing increased; split refresh moved to the bottom.

## Hard Launch Gates Still Open

1. **Complete intended-user deletion acceptance.** The new backend and recovery/cleanup source are implemented, and the parent verified three synthetic API/server completions, including scheduler-only recovery. The original account remains unchanged; automation is now off. This does not accept real Apple/Google grant revocation, native cleanup/restart, other-device behavior, support operations or retained-record/backup handling. See `DELETION_ACCEPTANCE.md` for exact receipts and limitations. A request reference or plan reset is not completed deletion. Confirm the intended in-app availability, processing expectations and operational responsibility before making public completion-time claims.
2. **Paid configuration and lifecycle.** Do not enable `EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED` merely because purchase UI compiles. AI Coach chat has source-level Pro gates and server-authoritative RevenueCat entitlement verification; core recording/history/Insights remain free. Products, `pro`, default offering, group levels, five territories, individual purchase options, exact local prices/trials, public iOS key, read-only server key and notification URLs are configured. Sandbox TEST delivery passed; production TEST returned 401 and needs resolution. Keep client/server billing switches aligned (`EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED` and Supabase `STRIDEOS_BILLING_ENABLED`). Test real sandbox purchase/restore/refund/expiration, grace and revocation before enabling either switch. No paid feature or charge is activated in this run.
3. **Owner account settings.** Apple agreements, banking/tax, App Store labels/age rating/export compliance/reviewer account/availability, provider spend limits and billing setup are unverified. Leaked-password protection remains disabled; do not purchase a plan or alter shared auth settings blindly. Existing trigger-function search paths/direct-execution privileges were hardened and the new security advisor scan cleared those warnings.
4. **Physical-device acceptance.** Independent testers must exercise fresh installation, Apple/Google/email login, denied permissions, screen-locked GPS, pause/resume/interruption, Watch reconnect, offline save, account ownership, restore/reinstall, failed Health recovery, and purchase lifecycle when enabled. Source/browser checks cannot prove these paths.
5. **External human review.** No lawyer, QA contractor, security engineer, or sports-domain reviewer has been hired or represented as having approved the app. Gather fixed-scope quotes and obtain owner approval before spending.
6. **Release.** Final tests, exact native archive, SDK/privacy manifests, source-map upload, TestFlight processing, external beta feedback, and App Review/public-release decisions are separate gates. Current Build 106 compiled, passed actual archive checks, uploaded to Apple and is VALID / IN_BETA_TESTING internally. Physical installation, independent beta acceptance and public-review readiness remain. No public release is claimed.
7. **Residual dependency review.** High/critical findings are now zero without changing Expo SDK 56. Eighteen moderate/low upstream findings remain. The release review must assess their actual exposure and compatible fixes; neither a clean high-severity threshold nor successful bundling establishes whole-app security.

## Deletion Operator Runbook (Not Yet An Accepted End-User Service)

The implementation is `scripts/process-account-deletion.ts` and the pure engine
`src/utils/deletionFulfillment.ts`. It requires secure, server-only operator
configuration. Running it without `--execute` only inventories the exact request
and reports blockers. Execution additionally requires
`STRIDEOS_DELETION_CONFIRM_REQUEST` to match that receipt. Never provide credentials
through command-line arguments, public variables, source, screenshots or chat.
Social-provider accounts and any unexpected shared Auth/storage dependencies fail
closed before a lease or destructive action. Dedicated database functions are
service-role-only; completion refuses residual records/files or a live Auth user.
No real user has been removed to test this engine.

- Monitor pending `stride_account_deletion_requests` through restricted operator access; do not expose the queue to other users. Each request has an authenticated owner and stable receipt. A duplicate submission does not reset its original date or falsely mark completion.
- Verify request ownership and identify StrideOS-only database/media records and any shared identity dependencies. Do not inspect or delete unrelated app records as a substitute for identity separation.
- Stop the account's StrideOS sync and writes before removal so queued writes cannot recreate records. Revoke active sessions and applicable social-provider grants. Handle Apple refresh-token revocation with the properly configured server credentials.
- Remove owned objects through the Storage API, not direct SQL deletes from `storage.objects`. Purge only the requester's app records. Delete a shared auth identity only when doing so cannot erase another service's account and is authorized for that identity.
- Account for local copies and other devices, restricted backups, legal holds and paid subscriptions. Account deletion does not cancel Apple renewal or remove Apple Health/photo originals.
- Verify record/object isolation and removal, notify the requester, then record completion appropriately. Test the whole procedure using dedicated test identities first. This runbook is not permission to delete existing users.

## External Review Brief

Hire a senior React Native/iOS reviewer with shipped HealthKit, Watch, Supabase RLS/storage and StoreKit/RevenueCat experience for a fixed-scope launch audit, not a rewrite. Ask for prioritized findings, repro steps, affected code, test evidence and a capped remediation estimate. Add real-device QA and a licensed privacy/consumer-app attorney. Give least-privilege access and dedicated test accounts; retain ownership of all accounts and source. Proposed planning budgets, not quotes: engineer $1,000-$3,000, QA $400-$1,000, legal $750-$2,000; optional independent training-content review $300-$1,000.

## Verified Checkpoint Receipts

- Latest complete serial regression suite after compatible dependency patches, hiding unavailable legacy Movement Lab promotion panels, and durable AI-consent failure recovery: **1,212/1,212 passed**, no failures/skips, `/tmp/strideos-launch-tests-complete.log`. Final `npm run check` passed both the semantic TypeScript check and Expo dependency compatibility. The grid retains its existing narrow-screen two-column sizing and changes vertical spacing; no tracking or metrics calculation changed.
- New privacy/AI/server entitlement/purchase race/replay tests exercise actual factories and runtime bindings, including owner changes during awaited SDK identity and offering lookups, no SDK initialization while billing is disabled, and consumed replay timers on retained screens.
- Actual component browser fixture: **28/28 checks passed**, dark/light at 320/393/768 widths, no page errors or external requests. Includes real AI consent and Account & Legal components plus the real tour provider, safe bubble bounds and dismiss/replay. Screenshots under `/tmp/strideos-launch-preview`. Synthetic storage/accounts only; not native Switch, StoreKit, VoiceOver, or physical-device proof. Browser QA exposed and fixed a pre-existing web-only `findNodeHandle` focus crash without changing the native focus path.
- Supabase migrations applied: `launch_privacy_and_coach_limits`, `harden_trigger_privileges`, `grant_strideos_owner_access`. The deeper authenticated-role probe found missing CRUD table grants that prevented backup operations despite existing ownership policies, plus unnecessary client maintenance grants. Restricted StrideOS-only grants were corrected; other-app table privileges were not changed.
- Live transactional RLS probe `scripts/sql/launch-rls-probe.sql` then passed: signup profile trigger still works, users can access/update their own records, and cross-account reads/writes are denied across the four backup-log tables. The quota probe allowed exactly 20 of 25 requests per owner, denied the exhausted global quota, and isolated deletion receipts. All synthetic auth/request/activity records were rolled back and absence was read back. No customer data was deleted. These are SQL role probes, not a device-to-API backup/restore test.
- Deployed Edge Functions: `account-deletion` v1 (JWT verification on), `ai-coach` v9 (JWT verification on). No-auth and public-anon-key requests both returned **401** for both endpoints. A real signed-in client/SDK delivery remains unverified. Older clients lacking the AI consent-version field cannot send chat to the new handler; an updated app is required.
- Last live security advisor scan: only `auth_leaked_password_protection` remained. Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Private movement bucket and owner-prefix policies were inspected; actual media upload/download isolation needs signed-in test users.
- Privacy, support, and terms were published atomically to the existing GitHub Pages hosting branch only, preserving its unrelated files. Commit `5e5d315dea1b70bee743d741b44e567236811b41`; all three pages returned HTTP 200 with the new copy. Follow-up privacy-only commit `fd5a2895155a595b247f739f5b1f65bbdb58419d` discloses first-party operational counters and deletion receipts; Pages reported that commit built. This does not publish an iOS app or constitute attorney approval.
- GPS, HealthKit, native Watch/Live Activity, route-builder, strength-engine and root startup sources were not edited. The native subscription dependency still requires an actual archive/StoreKit test before any paid launch.

## Owner Handoff Prepared Last

- Supabase and RevenueCat are signed in. The owner completed the private Apple key upload/save; RevenueCat shows Valid credentials. Products, Pro mapping and the default offering are saved. No private key contents, password, OTP, or new binding agreement was entered by the assistant.
- Backend isolation is complete with the existing projects, not blocked on another paid project. Needed decisions/access: provider revocation and end-to-end deletion acceptance, RevenueCat/App Store keys and approved paid scope, optional paid security settings, independent-review budget, and eventual public-release approval. Credentials belong in the relevant vendor UI/secret store, never in chat.
- Build 104 is processed and in internal TestFlight testing, not public App Review or release. The unresolved public-launch gates above remain deliberately open.

## Owner-Approved Pricing Drafts, Not Active Billing

The owner explicitly approved Pro USD 9.99/month or USD 79.99/year and a seven-day trial for product drafts. Recording/calendar/history remain free. Store-local prices are generated by Apple, not assumed equal to the USD amounts. Validate eligibility, renewal disclosure, included features, actual AI/storage/support costs and willingness to pay before activating billing. Do not promise unlimited expensive analysis or a lifetime service. An annual plan is a recurring service obligation, not immediate profit.
