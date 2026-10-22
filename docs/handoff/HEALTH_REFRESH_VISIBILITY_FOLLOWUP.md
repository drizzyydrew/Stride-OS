# Health Refresh Visibility Follow-Up

Status: version 1.0.0 (100) committed, pushed and submitted on October 22, 2026. The signed archive is verified and Apple reports VALID / IN_BETA_TESTING for the exact EAS build and submission below. The user's installed-device Health refresh and Rome split parity remain unverified.

## Report And Confirmed Defect

The user supplied the full race-detail screen showing no refresh control between summary tiles and Distance Splits. Distance source is GPS and notes indicate live GPS tracking. The screenshot does not prove the installed build number or the private row's exact metadata, but source reproduction confirms build 99 hides the control when `activity.healthKit` is absent. Earlier navigation guidance incorrectly assumed a linked Health row; no phone/app setting can change this rendering condition.

## Scoped Correction

- Render refresh for supported outdoor recordings, including unlinked GPS entries. Retain intentional exclusion of indoor, unsupported and manual/plan-only entries with no recording evidence.
- A linked entry keeps direct exact-UUID refresh. An unlinked entry opens the existing Health picker with distinct consent: use Health distance for this existing activity, not restore or create another entry.
- Require exact, consistent recording lineage: matching recording instance, explicit StrideOS canonical activity ID, or explicit legacy workout ID. Reject contradictory populated claims even when another field matches; dates, distance, route similarity and selection alone are not identity proof.
- Re-fetch the selected UUID/source and atomically attach only Health metadata plus distance evidence through the serialized durable store path. Never insert, re-complete or recalculate load. Preserve summaries, notes, phone route/pauses/sensors, training links, source, row ID and creation time.
- Validate latest-row compatibility, all recording claims and competing claimants before mutation and again after durable flush. Owner, deletion, focus and picker-session guards remain active. A partial/different existing Health link is not silently replaced.
- Keep the picker owner mounted through early in-memory link publication. Only durable success switches to direct refresh; failed confirmation remains retryable on the same selected workout. Cancellation says not confirmed, not rollback.
- Mark a deliberately uninspected route as `not_read`, not unavailable. First-link split refresh does not inspect or replace the original route.
- Show original Health distance alongside Health split quality. The existing 13.8-mile GPS summary is deliberately not overwritten, and derived split boundaries are not represented as official Apple timestamps.

## Verification

- Final full serial suite: **1,115/1,115 passed**, zero failures/skips (`/tmp/strideos-missing-refresh-final-tests.log`).
- Semantic typecheck passed (`/tmp/strideos-missing-refresh-final-typecheck.log`).
- iOS Hermes export passed (`/tmp/strideos-missing-refresh-final-export.log`), output `/tmp/strideos-missing-refresh-final-ios-export`, bundle `entry-d6b122f279040f8f76014fec934d1fba.hbc`.
- Rendered parent-screen tests verify unlinked/linked GPS controls across all supported types, intentional exclusions and stable focus keys. An in-memory reintroduction of the old guard fails the visibility assertion. Paired picker-owner tests retain the pending selection through early link publication, failure and final acknowledgement.
- Actual native-shaped adapter, picker service and Activity store tests verify exact first-link proof, unchanged summaries/load/links, no route query, no duplicate/recalculation, failed readback and idempotent retry. Post-publication mutations of canonical claims, sole legacy proof and sport reject acknowledgement without undoing those edits.
- Independent custody and platform reviewers issued source GO after both findings were corrected: final lineage/type checks now run even after metadata publication, and uninspected routes persist as `not_read`. No native/device or Apple split-parity approval is implied.
- `git diff --check` passed. Tests use synthetic recording identities and samples, not the athlete's Health record.

No native Watch/startup/transport, badge, signing, dependency or power-model changes. No device Health read or native acceptance test performed. Build 100 submission is authorized; release receipts will be recorded separately below.

## Device Acceptance On A Corrected Build

Update without uninstalling. Open the original GPS race and confirm refresh is visible above Distance Splits. For an unlinked entry, open the picker, select the exact race and explicitly confirm Use Health Distance. Verify exact-lineage enforcement, one retained canonical activity, preserved summaries/edits and durable reopening. Record any source-quality/identity error; do not substitute a nearby workout or guess missing pace values. Apple Fitness having full visual splits does not prove the public native reader exposes fine-enough intervals for identical derived results.

## Build 100 Release Preparation

- Explicit user authorization: Approved, October 22, 2026.
- Existing EAS account/project and production signing retained. Prior build list confirmed 99 was latest and no build 100 existed before this request.
- Set local iOS build number to 100; app display name remains StrideOS, version 1.0.0.
- Clean iOS prebuild passed without package/dependency changes (`/tmp/strideos-build100-prebuild.log`). Generated host Info.plist has explicit CFBundleVersion 100 and version 1.0.0; Watch and Live Activity project versions are also 100.
- Watch native contract suite passed 22/22 (`/tmp/strideos-build100-native-contracts.log`). Protected Watch and achievement source paths remain unchanged. Whitespace validation passed.
- Binary source commit: `ed2fb557f9bfefa24eacbecef5e85b7022096782`, pushed to `build-19-v3-foundation` and verified by remote ref readback.

## Signed Archive And TestFlight Receipts

- EAS production iOS/store build: `7258082c-d524-4b1b-834f-4f27535bce3c`, FINISHED at `2026-10-21T23:52:04.699Z`; version 1.0.0 (100), exact source commit above.
- Downloaded actual IPA: `/tmp/strideos-build100.ipa`, 119,858,786 bytes; ZIP integrity passed.
- SHA-256: `ea17800dc464878957bbfece49210dfa2650196ae5ea180138cf910f00917f4a`.
- Inspected archived host, Watch and Live Activity Info.plists: all version 1.0.0 / build 100, expected bundle IDs and signature resources present. Host and Watch display names remain StrideOS.
- Actual Hermes bundle contains Refresh splits from Apple Health, Use Health distance for this activity?, No new activity is created., and Original Health distance:. Receipt: `/tmp/strideos-build100-ipa-receipt.json`.
- Submitted only that identified build using existing production credentials. EAS submission `97883c48-14e5-48a9-a962-5c35eadf9fb4` FINISHED at `2026-10-22T00:01:29.612Z`; successful upload confirmed by CLI and submission readback (`/tmp/strideos-build100-submission-final.json`).
- App Store Connect app `6782788130` reports build 100 VALID, internal IN_BETA_TESTING, not expired, and matching EAS build/submission IDs. Uploaded date `2026-10-21T16:59:23-07:00`; readback `/tmp/strideos-build100-apple-final.json`.
- External state READY_FOR_BETA_SUBMISSION is distinct from internal testing. No public App Store release, tester invitation or distribution expansion performed. Apple beta state does not establish a particular tester's installation or actual race-data acceptance.
