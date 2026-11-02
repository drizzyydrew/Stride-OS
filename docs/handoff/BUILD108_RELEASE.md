# Build 108 — internal beta preparation

November 1, 2026. Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.

## Intended candidate

Production configuration, version 1.0.0 / iOS build 108. Billing explicitly off. Medium EAS worker and existing included build allowance; no plan/add-on purchase. Internal TestFlight only. Public submission and release remain blocked by the acceptance gates below.

Includes the fresh-install ownership fix accepted on Simulator 107, truthful profile/manual-activity copy from `9f9b5e0`, and deletion-retention wording. No deletion activation or customer-data mutation. Private browser exports and screenshot source documentation are excluded from EAS uploads.

## Current-turn verification

- Final complete suite after the retention-copy change: **1,451 / 1,451 passed**, no skipped tests. Log: `/tmp/strideos-publish108-final-tests.log`.
- TypeScript semantic and Expo dependency checks passed: `/tmp/strideos-publish108-final-check.log`.
- Whitespace checks clean. Clean native prebuild passed; generated phone/extension build numbers synchronized to 108. Previous ignored iOS project preserved at `/tmp/strideos-publish-preserved-ios107-20261101`.
- An earlier parallel Swift compile timed out at 30 seconds. The unchanged isolated case passed, followed by two full passing suites; no assertion or timeout weakened.
- Independent architecture/privacy and contrarian reviews support this bounded billing-off beta. Final copy is presentation-only. Their separate handoffs preserve dissent and public gates.
- Expo billing UI readback: Starter, $12 / $45 included build credit used, six medium builds, upcoming estimate $19 existing plan. One medium build fits observed remaining allowance. No upgrade or add-on selected.
- Production environment narrow readback: billing false, correct isolated StrideOS backend, iOS public purchase key present. No secret values recorded.
- Deletion control readback: disabled, zero allowed owners, zero worker cron jobs. Supabase advisors still report leaked-password protection disabled and four intentionally deny-client private tables with no policies; no paid upgrade or permissive policy added.

## Evidence still required

This preparation is not a signed archive, Apple processing receipt, device acceptance, or public-ready certification. Record exact EAS ID, source commit, archive identity/entitlements, and TestFlight status after they exist.

Public gates: working account-deletion initiation/fulfillment and provider/native acceptance; accurate privacy-label publication; owner-backed medical-device declaration; working reviewer access; current real-device GPS/Health/Watch/offline/interruption/account-switch tests. Paid launch additionally needs sandbox purchase/restore/renewal/expiration/refund and server-entitlement acceptance. Owner previously deferred the physical/purchase session. Preserve that deferral and group the eventual steps.

Three genuine native iPhone draft assets remain in place. Corrected Today/activity-detail and actual Watch captures are not yet accepted. Legacy Watch/iPad library assets are preserved, not certified current. Free marketing/support/privacy URLs remain unchanged.

## Finished archive and exact upload

- EAS production build `f647a146-5f2c-4ff9-b32d-ad15989c92c7` finished, source
  `cf41d1a38b3353f8de2fb84363fcdfdb1b16a428`.
- Actual IPA `/tmp/strideos-build108.ipa`: 129,563,691 bytes, SHA-256
  `1ff1268e562031ee0eb562e8d5257215f5c3c8bd1c8c967414d72d17e021cfef`.
- Actual phone, Watch and Live Activity targets all contain 1.0.0 / 108 and
  expected identifiers. Deep/strict signatures passed; debug signing false.
  Host APNs is production; expected HealthKit and app-group entitlements are
  present. Phone/widget SDK iphoneos26.5; Watch watchos26.5, from the pinned
  Xcode26.6 image. All 21 privacy manifests parsed, 1024px compiled icon opaque.
- Embedded Hermes contains 250829098.0.17, not the old .0.10 runtime. Cloud
  Doctor passed 21/21. Sentry's successful artifact-bundle/source-map report
  identifies release com.mooremovement.strideos@1.0.0+108 / dist108. This does
  not prove a consented-device event or symbolication result.
- Build completed with zero compilation errors. The summarized final compiler
  step reports 33 warnings; full logs also repeat dependency deprecation,
  nullability and library-evolution warnings, existing Live Activity contentState
  deprecations, and the cloud image's absent optional Metal toolchain search
  path. No warning was suppressed. No physical runtime guarantee follows.
- Exact-build upload submission `d4180bb6-437f-426f-9aa2-365ef33f6ac3` succeeded.
  Apple processing/internal availability is a separate receipt, not inferred
  from the upload. No public App Review or release was submitted.
- Medical declaration is now saved No after the owner confirmed general-fitness
  intent and no medical-device status; Apple readback confirms it. Existing
  reviewer credentials failed authentication; replacement is in owner handoff.
- All four retained free public URLs freshly returned HTTP200 via verified TLS.
  A Python installation's missing local CA bundle prevented its initial check;
  normal system curl verification succeeded without disabling TLS validation.
- Narrow server billing-secret digest readback was attempted with the supported
  CLI but stalled and was terminated. No secret value was printed or changed.
  Client billing-off was verified; no fresh server-secret value is claimed.


## Reviewer credential correction

After the owner created a new dedicated user and updated Apple's restricted
review fields, a fresh metadata pull and no-persisted-session authentication
check succeeded against the isolated StrideOS backend (HTTP200). The prior 400
is historical and superseded for the newly saved credentials. Native sign-in,
onboarding/reviewer navigation and synthetic-data content acceptance remain
separate. No password, email or token is copied into this record.

## Apple processing and internal availability

Supported EAS/App Store Connect status readback confirms **1.0.0 / 108 VALID,
IN_BETA_TESTING internally, not expired**, external state
READY_FOR_BETA_SUBMISSION. Exact EAS build and submission IDs match the archive
and upload above. Apple uploadedDate is `2026-11-01T23:18:55-08:00`.
This establishes internal availability, not installation, physical-device
acceptance, external-beta approval, public App Review or public release.

A subsequent read-only Supabase UI inventory established that both server
`STRIDEOS_BILLING_ENABLED` and `STRIDEOS_BILLING_QA_OWNER_ID` are **absent** from
the complete custom/default secrets tables. The deployed source treats absence
as global-off/no-QA-owner. No secret values were opened or changed. This resolves
the narrow applicability question left by the stalled CLI attempt above.


## Store/privacy completion

Goal archive/open training description saved and verified after reload. The
owner-supported medical declaration is saved No. New reviewer credentials saved
by the owner authenticate successfully against the isolated backend. The
complete 11-type privacy reconciliation is published and verified after full
reload, with no incomplete setups or unlinked/tracking preview sections. See
`PRIVACY_LABEL_RECONCILIATION.md` for the exact matrix and scope. These store
receipts do not close the real-device, deletion-operation or paid-lifecycle gates.
