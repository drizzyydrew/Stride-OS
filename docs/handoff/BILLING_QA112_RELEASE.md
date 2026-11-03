# Build 112 — private purchase QA

This is the separate reset-fixed purchase-testing candidate. It must never be
selected as the normal public-release candidate. Normal internal build 111 and
the saved public draft 109/manual release remain distinct.

## Preparation and compilation

November 3, 2026. EAS and Apple's build list both showed 111 as the latest
build before allocation. Existing Expo Starter usage was $18 of $45, leaving
$27 in included build credit. One medium iOS job was started without a plan,
credit-pack or add-on purchase.

After completion, a fresh billing-page reload still displayed $18/$45 and the
$19 base-plan estimate. That display may lag job accounting; no final per-job
charge or zero-cost conclusion is inferred. No billing setting was changed.

- Source: `821f113af4b00303b57f890c1d70df1bdf8f9a47`, local branch
  `codex/strideos-billing-qa112` in
  `/Users/drew/.cache/strideos-billing-qa112-20261103`.
- Parent: `2506b97`, containing the build-111 recovery fix. The only candidate
  change is `app.json` build number 111 → 112. No app feature code changed.
- Resolved configuration: store distribution, production environment, medium
  worker, SDK 57, intended host bundle ID, client purchase flag true via the
  existing billing-qa override. Canonical production remains billing-off/111.
- EAS job: `f8dd8a90-7da4-4a4f-ba8c-e85d1580daac`, created
  `2026-11-03T15:07:57.911Z`.
- Local semantic TypeScript and Expo dependency compatibility checks passed on
  the isolated candidate. The 71 focused auth/billing/observability tests from
  the immediately preceding desk pass cover identical app source; they were not
  needlessly repeated for a build-number-only change.
- EAS status: **FINISHED** at `2026-11-03T15:18:53.114Z`. The exact downloaded
  IPA is 129,573,732 bytes, SHA-256
  `b6a3c5c83aad9538ae4b193737777f0fea2481a1107a74f27f7fd16cc1c6cf24`.

## Signed artifact inspection

`BILLING_QA112_ARTIFACT_VERIFICATION.json` records direct inspection of the
downloaded artifact. Host, Watch and Live Activity all report 1.0.0/112, pass
strict/deep signature verification, match the intended signer/bundle IDs, and
have no debug signing. Expected HealthKit/app-group capabilities and the host
location/Health purpose strings are present. The strideos native callback scheme
is present, 21 privacy manifests parse, the JavaScript bundle is Hermes bytecode,
and the compiled 1024px phone icon is opaque. No credential-like filenames were
found in the IPA. No physical recording, Watch interaction or purchase was tested.

The IPA is retained at
`/Users/drew/.cache/strideos-qa112-artifact-20261103/QA112.ipa`. The repeatable
inspection helper is
`/Users/drew/Documents/StrideOS Launch Review/inspect_qa112_archive.py`.
Sentry upload/crash-symbolication was not independently accepted by this
archive inspection.

## Delivery state

**Not submitted to Apple or delivered to TestFlight in this session.** Normal
internal build 111 and public draft 109/manual release are preserved. Deliver
the exact inspected QA artifact in coordination with the private purchase
session, verify Apple processing and the intended owner-only assignment, and
make its QA-only purpose explicit before installation. This avoids an unsolicited
change to the owner's normal internal app while device use is deferred.

The source commit is retained locally, not pushed. The EAS source archive was
uploaded for this explicit job. No TestFlight delivery/group assignment, server
QA binding, product change, public billing or release activation occurred.

## Sandbox account is ready

The owner completed the Apple Sandbox tester. Read-only browser confirmation
shows one StrideOS QA tester, United States, monthly renewal every five minutes,
and Interrupt Purchases off. Those defaults were inspected without changing
them. `SANDBOX_ACCOUNT_ACCEPTANCE_20261103.json` records the scoped readback;
no email/password is in the repository.

The Apple Sandbox account and authenticated StrideOS/Supabase user are separate
identities. This account's creation does not bind a Supabase QA owner or prove
RevenueCat registration, sandbox sign-in or a purchase.

## Before any purchase session

Verify the finished archive, intended private delivery, exact authenticated
StrideOS test owner and RevenueCat App User ID/customer registration. Only then
bind that single owner for the controlled server session. No binding is set by
this preparation. An unset or mismatched binding must not be probed as though
the deliberate no-quota QA policy is active.

Keep public billing off. Owner enters any device-side Sandbox credentials and
completes purchase dialogs privately. Accept both products, canceled purchase,
restore/relaunch, renewal, expiry, retry/grace, refund/revocation and account
switching against real client/server events. A verified QA 429 is an intentional
no-quota stop, not a successful AI response. Remove and verify the binding after
the session. No physical or purchase-lifecycle acceptance is implied here.
