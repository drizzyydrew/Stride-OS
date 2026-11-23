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
