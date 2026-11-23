# Build 127 release record

The owner authorized implementation and the next TestFlight build after the planning review. Build 125 remains the selected public App Review candidate with manual release. This work does not withdraw or replace that submission or publish a release. Exercise imagery, native Watch/Live Activity source, dependencies, AI product/pricing gates and provider budgets are unchanged.

## Scope

See [scope](BUILD127_SCOPE.md), [training content and primary sources](BUILD127_TRAINING_CONTENT.md), [history/archive contract](BUILD127_HISTORY_AND_ARCHIVES.md), and [device check](BUILD127_OWNER_TEST_GUIDE.md).

The implementation adds ordered goal profiles and sport-specific programming, optional foot modules, goal archive correction/deletion/repeat, durable whole-workout deletion, consistent month/week status colors, saved-route editing and geographic segments, fixed active-route snapshots, and AI Coach first-read/retry/input/spacing recovery.

## Council and review

Independent training/product and contrarian/data reviews plus platform cross-review found and resolved: secondary work replacing primary strength roles; sport goals receiving renamed runs rather than appropriate aerobic tasks; excessive reactive-foot dose advancement; holds/carries turning into repetitions during substitutions; optimistic deletion pruning before disk confirmation; and logical schedule IDs preventing a genuinely new performance after deletion. Source was rechecked after these changes. Confidence is based on concrete checks, not a measured reliability percentage.

## Hosted verification

Migration `20261123123200_workout_deletion_and_archive_revisions` is applied on `pbzgrhnxpbtlkzpreizy`. The local migration filename matches the live ledger. It introduces owner-only deletion intent, four anti-resurrection triggers, an atomic whole-workout deletion RPC, and a revisioned archive-correction RPC. The RPCs use invoker security with an empty search path; no Auth grants or new security-definer functions were added.

The exact acceptance script in `scripts/verification/build127-history-acceptance.sql` passed against the live database in a BEGIN/ROLLBACK transaction. It exercised deletion, stale legacy/Health re-upload rejection, owner isolation, archive snapshot preservation, stale archive writes and anonymous denial. The final readback reported `PASS_ROLLED_BACK` with zero remaining synthetic deletion rows. No real workout, account or purchase was deleted for verification. Foreign-key cascading, RLS, ACLs and all four triggers were read back.

The security advisor reported the same pre-existing private-table informational notices and leaked-password-protection warning as before this migration; it introduced no new notices. These existing settings were not changed. Current clients filter deleted history and the server rejects stale re-uploads; an already cached copy on an older app version may remain visible until that client updates.

## Build gates and delivery

The final aggregate run passed 2,393/2,393 tests with zero skips; TypeScript, dependency checks and diff checks passed. The owner then clarified retaining foot/ankle and dynamic-balance work in relevant plans; the bounded follow-up passed 60/60 focused regressions, followed by 27/27 race-preparation/plyometric checks and 49/49 legacy programming checks after the final integration correction, all with zero skips. TypeScript passed again against the final source before uploading. Signed-artifact and TestFlight receipts are recorded in the delivery artifact after verification. A clean iOS prebuild passed for 127 after the incremental prebuild encountered the existing Apple-target update limitation. Generated native files were backed up before regeneration. No physical-device, live GPS, native purchase-lifecycle or user-account acceptance is inferred from automated tests.

Policy links continue to use the existing versioned 126 beta pages; no standard/public-review policy page was changed. App Store Connect was read at 2026-11-23T12:31:48Z: public version 1.0 selected 125, WAITING_FOR_REVIEW, MANUAL; 126 was VALID. Release scope remains internal TestFlight only.


## Internal delivery complete

Source `45c540fc07218c6f473e5879cf2a5c6fa21abe70` is committed and pushed on `codex/build127-goals-routes-history`. EAS build `9337f289-c2b2-4f95-bff9-8ebbc7584080` finished; submission `8399fb35-c09d-4722-8993-c05bb58a00b1` uploaded that exact source-matched artifact.

The 130,160,104-byte IPA has SHA256 `9e004762fb672a2a5836872f24d590491ce384f9139b67e1d6b92124be102923`. App, Watch and Live Activity targets are all version 1.0.0/build 127, store-signed for the expected team/bundles. Twenty-one privacy manifests parsed, and embedded feature/legal-link text markers were found. The existing app icon and transparent Live Activity logo renditions were checked without changing imagery. Cloud Expo Doctor passed 21/21 and the native archive succeeded.

Apple build `e4353b61-4cf1-4fa7-a94d-1a7b8178596f` was verified VALID / IN_BETA_TESTING at 2026-11-23T13:14:42Z, assigned to the existing Team (Expo) internal group. The 1,131-character English testing notes were read back exactly. Apple's availability email also identifies 1.0.0 (127). Existing tester membership/status does not establish a physical installation of this particular build.

Apple sent the same ITMS-90725 future SDK advisory seen for 126. Delivery and TestFlight processing succeeded; the notice concerns the April 2027 iOS 27 SDK requirement.

The public version still selects 125, WAITING_FOR_REVIEW, with MANUAL release. No review withdrawal/replacement or public release occurred. Full sanitized delivery evidence is in [BUILD127_DELIVERY.json](BUILD127_DELIVERY.json). The next owner action is the [device check](BUILD127_OWNER_TEST_GUIDE.md).
