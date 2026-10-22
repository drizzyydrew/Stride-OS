# Health Metrics Read Follow-Up

Status: local source correction verified, October 22, 2026. The user authorized TestFlight submission of this correction; version 1.0.0 (101) is being prepared. Build 100 remains the last confirmed TestFlight release until the new signed archive and Apple status are verified. The latest screenshots show a selected-workout failure at the generic metrics stage, not the specific native query or decoder check. No device-root-cause or race-recovery claim is justified.

## Confirmed Source Defects

- Both Health split-refresh paths fetched unused heart-rate, step and running-dynamics summaries before distance evidence. A synchronous native statistic invocation failure escaped the attached Promise catch, reproducing the same generic metrics message. The refresh mutation consumes none of those summaries.
- The distance decoder rejected a resume while already active. Apple's HKWorkoutEvent contract says workouts start active and redundant pause/resume events do not change that state. The decoder already ignored redundant pauses, but not redundant resumes. Official source: https://developer.apple.com/documentation/healthkit/hkworkoutevent (Markdown read directly from Apple's corresponding `.md` endpoint).
- The adapter hid query and decoder failures behind one message that always suggested unlocking the phone. A metrics-stage failure alone does not establish protected-data unavailability.

## Correction And Limits

- Explicit distance-only exact-UUID reads on both linked refresh and first-link picker refresh skip route and optional summary calls. Full activity restore retains its route/summary reads.
- Preserve the exact native workout predicate, source, recording lineage, original bounds, duration, distance total, events and meter samples. No date-only query, nearest-record selection, route replacement or summary rescaling.
- Ignore valid in-bounds redundant resumes according to Apple's event contract. Invalid timestamps and out-of-range events still fail. No missing pause is invented; downstream duration, coverage and distance checks remain unchanged.
- Application-owned, closed diagnostic codes distinguish distance query, interval validity/range/conflict, sample size and pause decoding failures. Native error messages, identifiers, timestamps and sample payloads are not included. Unknown failures retain a sanitized read stage without blanket unlock advice.
- Application phase-callback exceptions are captured separately and retain their exact identity. Closing recovery, changing account or invalidating the current request is not mislabeled as a native Health read failure; native exceptions remain sanitized even with a callback present.
- Distance evidence saved is not equivalent to splits available. Existing strict split checks, including coverage, totals and 30-second interval resolution, remain intact. Positive distance samples with equal timestamps are still rejected; supporting instantaneous samples would require a separate representation and analysis policy.
- No native Watch, transport, startup, power, badge, signing or dependency changes. No private Health export or physical-device read performed.

## Verification Receipts

- Before correction, the new synchronous-statistic regression reproduced the generic metrics error (`/tmp/strideos-health-metrics-before.log`).
- Focused actual adapter/service/store, distance import and split tests passed 70/70 (`/tmp/strideos-health-metrics-targeted2.log`). Both linked and first-link refresh invoke zero route/statistic methods, preserve existing edits/totals/load and complete durable reads. Synchronous and asynchronous distance-query errors do not enter the mutation or change persisted bytes.
- Decoder/adapter cases use the installed generated event enum, including redundant resumes and explicit pauses. Invalid intervals, out-of-bounds events, conflicting sample IDs and oversized evidence still fail with fixed non-identifying codes.
- Independent platform and custody reviewers cross-examined the preservation objection and issued source GO. Custody review found callback masking; the final patch fixes it without a general native-error passthrough. Final independent checks passed 17/17 adapter tests and 37/37 adapter/persistence tests. No device verification implied.
- Full serial suite: 1,122/1,123 passed, one unrelated 30-second Swift compilation timeout (`/tmp/strideos-health-metrics-full-tests.log`). The same unchanged production Swift deadline probe passed when rerun alone in 19.7 seconds (`/tmp/strideos-health-metrics-swift-rerun.log`). No test timeout, Watch source or assertion was changed. Do not represent these receipts as one all-green full-suite invocation.
- Final semantic typecheck passed (`/tmp/strideos-health-metrics-final-typecheck.log`). Final iOS Hermes export passed (`/tmp/strideos-health-metrics-final-export.log`), output `/tmp/strideos-health-metrics-final-ios-export`, bundle `entry-3a61ae63c5eff282b7a07682155e85be.hbc`. Fixed query, interval-range and pause-time diagnostics verified in the actual generated bundle. Earlier typecheck/export processes were deliberately stopped after the last source edit to rerun against the finished patch without competing heavy processes; their interrupted logs are not acceptance receipts.
- `git diff --check` passed. Protected Watch/transport/achievement paths and dependency manifests are unchanged. The release-only app.json build-number bump is recorded below.

## Release And Device Acceptance

The user explicitly authorized this release with "You can submit to TestFlight if need be." Preparing commit, push and TestFlight version 1.0.0 (101) under that authorization. Existing EAS project, bundle IDs, production signing and App Store Connect app are retained. Archive/upload/Apple receipts pending; no public App Store release or tester expansion authorized.

- EAS account and existing production profile verified; prior build list showed build 100 latest and no 101 before this request.
- Set local build number 101; name StrideOS and app version 1.0.0 retained.
- Clean iOS prebuild passed with no dependency changes (`/tmp/strideos-build101-prebuild.log`). Host Info.plist explicitly reports version 1.0.0 / build 101; Watch and Live Activity project configurations also report 101.
- Watch native contract tests passed 22/22 (`/tmp/strideos-build101-native-contracts.log`).

On a released correction, update without uninstalling and refresh the original race using the exact corresponding Health workout. Confirm durable reopening, preserved original edits/totals and no duplicate completion. If a read still fails, capture the fixed diagnostic code; do not infer the private failure from an older generic screenshot. If evidence saves but quality remains partial, inspect the displayed quality reason rather than guessing missing splits.
