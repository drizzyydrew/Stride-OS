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
