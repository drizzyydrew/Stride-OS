# Health Distance Association Follow-Up

Status: correction committed, pushed and submitted as version 1.0.0 (102), October 22, 2026. Apple readback confirms `VALID` and `IN_BETA_TESTING`. Original Rome race recovery remains device-unverified. The user reports that all Health permissions are enabled. The screenshot shows an empty-evidence failure after selecting the original race, not whether the Health bridge delivered zero samples or the old decoder excluded them.

## Evidence And Scope

- Build 101's decoder excluded every distance sample whose writer differed from the workout writer. Its empty-evidence message therefore did not prove an empty query response.
- Apple documents workout association separately from object authorship. The installed 14.0.2 bridge forwards an actual WorkoutProxy to HKQuery's workout predicate; a serialized workout must not replace that proxy. No Apple contract establishes equal writer bundles as a required association invariant.
- References: https://developer.apple.com/documentation/healthkit/hkquery/predicateforobjects(from:)-5irg9 and https://developer.apple.com/documentation/healthkit/hkobject/sourcerevision . This supports an exact-association reader correction, not a claim that the private race contained cross-writer samples.
- Workout totals do not establish that fine-grained associated intervals exist. The bridge can also omit a sample if serialization fails. A bridge-visible empty response cannot establish native zero, denied read permission, or absence of Health data.

## Correction

- Keep legacy v1 evidence and its same-writer semantics unchanged. Only an explicit exact-workout query result in the adapter mints v2 evidence with a matching `sampleScope` UUID.
- Retain the envelope's workout writer and every accepted sample's actual writer. Do not relabel samples, query by date, select a nearby record or infer GPS/split values.
- Validate v2 scope kind, UUID and workout writer in merge and split analysis. Reject missing/mismatched scope, unknown writers, manual samples for split reconstruction and conflicting duplicate UUID/writer claims.
- Permit only lossless v1-to-v2 scope upgrades; reject downgrades, dropped/changed samples, writer changes, changed context and contradictory identity. Continue checking latest data and durable readback through the existing serialized store path.
- A superset can introduce overlaps: reject any refresh that turns previously complete saved split analysis into unavailable/partial analysis in either unit system. Preserve the old evidence instead.
- Keep overlap, gap, duration, pause, interval-resolution and total-distance checks. Exact association alone does not guarantee usable split coverage.
- Distinguish reader-empty, manual-only and unknown-provenance failures with fixed non-identifying codes. Full workout/route restoration can still retain an activity even when associated distance intervals are empty. Distance-only refresh does not mutate in that case.
- Scope metadata records the adapter's assertion; it is not authentication of arbitrary persisted JSON or proof that a third-party bridge could never drop a predicate.

## Verification

- Focused decoder, split, actual adapter and actual service/store tests passed 78/78 (`/tmp/strideos-health-association-targeted2.log`).
- Cross-writer fixtures use only synthetic records. Both linked and first-link refresh preserve canonical ID, notes, totals and load, survive failed durable confirmation/retry, retain actual writer and v2 scope on disk, and yield complete analysis for complete synthetic coverage.
- Empty reader results preserve linked and unlinked recordings without entering the mutation. Default full restore still reads route evidence with empty distance intervals.
- Legacy scope, malformed scope, unknown source, conflicting UUID/writer, invalid intervals, downgrade and degraded-analysis cases remain fail-closed.
- Full serial suite passed 1,130/1,130, zero failures/skips (`/tmp/strideos-health-association-full-tests.log`). After the final empty-message-only correction, the actual adapter suite passed 19/19 (`/tmp/strideos-health-association-final-adapter.log`), including no settings/read-access redirection in the failure copy.
- Independent platform and custody reviewers cross-examined the scope/provenance and degraded-analysis objections and issued source GO. Custody's remaining copy finding was corrected: no instruction to revisit permissions and no claim that Health lacks data.
- Final semantic typecheck passed (`/tmp/strideos-health-association-typecheck.log`). iOS Hermes export passed (`/tmp/strideos-health-association-export.log`), output `/tmp/strideos-health-association-ios-export`, bundle `entry-8762e3f14ae9e60be95552c476e34af0.hbc`. Actual bundle contains exact-workout scope, distinct empty/manual diagnostics, no-settings empty wording and saved-analysis quality guard. No physical-device Health data read or Rome split parity verified.

## Release And Acceptance

The user's continuing authorization for this same issue is "You can submit to TestFlight if need be." Source review, full-suite and typecheck gates passed for version 1.0.0 (102). Existing account and production profile verified; the pre-release EAS build list showed 101 latest and no 102. No native Watch/startup/transport, power, badge, signing or dependency changes. No public App Store release, invitation or tester expansion authorized or performed.

- Local app version remains 1.0.0 and display name StrideOS; build number set to 102.
- Clean iOS prebuild passed without dependency changes (`/tmp/strideos-build102-prebuild.log`). Host Info.plist explicitly reports 1.0.0 / 102, and Watch/Live Activity project configurations report 102.
- Watch native contract suite passed 22/22 (`/tmp/strideos-build102-native-contracts.log`). Protected Watch/transport/achievement paths and dependency manifests unchanged. `git diff --check` passed.
- Binary source commit `d5a0aa09fa0a1b8b4fb9d7f7964ba6eb20ab38c3` was pushed and verified against remote branch `build-19-v3-foundation` before the build request. This handoff receipt update is a later documentation-only commit, not a different binary source.
- Exact EAS production/store build `fbaf44e2-384c-4285-851e-038fb673eb64` finished successfully. Created `2026-10-22T07:02:59.425Z`; completed `2026-10-22T07:12:45.222Z`. Receipt: `/tmp/strideos-build102-view5.json`.
- Downloaded and tested the actual finished IPA: 119,861,441 bytes; SHA-256 `ff74c69bd1c327b7b9eef96831aab24e15887d1a8a009055cd5e08f1820e2ac3`. `unzip -tq` passed. Host, Watch and Live Activity plists all report 1.0.0 / 102 with their expected bundle identifiers and signature-resource entries. Host display name is StrideOS.
- Actual archived Hermes bundle contains the refresh/confirmation controls, exact-workout scope, empty/manual/unknown-source diagnostic codes, no-settings empty wording and saved-analysis quality guard. Curated artifact receipt: `/tmp/strideos-build102-ipa-receipt.json`.
- Submitted this exact build ID, not an implicit latest build. EAS submission `cf4723e9-9d5f-4b04-b0ab-989bf56e7898`, created `2026-10-22T07:18:02.762Z`, finished successfully and reports the same build ID/source commit. Receipts: `/tmp/strideos-build102-submit.log` and `/tmp/strideos-build102-submission-final.json`.
- App Store Connect app `6782788130` reports version 1.0.0 / 102, `processingState: VALID`, `internalState: IN_BETA_TESTING`, not expired, with matching EAS build/submission IDs. Apple uploaded date `2026-10-22T00:30:23-07:00`. Readback: `/tmp/strideos-build102-apple-final.json`. External state is `READY_FOR_BETA_SUBMISSION`, distinct from internal testing and public App Store release. This does not establish installation or access for a particular tester.

For device acceptance, update to build 102 without uninstalling. Open the original Rome activity and choose "Refresh splits from Apple Health"; select the matching original Health workout if prompted. Verify the retained canonical activity, durable reopening, original summaries/edits and displayed Health split quality. If the reader still returns no usable intervals, record the specific diagnostic code; all permissions being enabled does not prove associated interval data was exposed. Do not substitute another workout, rescale summaries or invent missing times. No private Health records or physical-device split parity were verified during this release.
