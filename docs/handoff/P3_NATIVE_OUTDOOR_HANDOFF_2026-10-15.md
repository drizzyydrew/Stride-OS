# P3 Native / Outdoor Worker Handoff

Date: 2026-10-15. Worker C implementation checkpoint, not release approval.

Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.
The Documents checkout is not the implementation destination.

## Council Status

| Gate | Worker judgment | Meaning |
| --- | --- | --- |
| P3 amended Round 1 | **95/100 PASS, design only** | Additive timestamped telemetry, explicit sport mapping, source/quantity semantics, bounded freshness, preserved startup and exact-instance ownership make the amended plan acceptable. |
| P2 amended native/platform Round 1 | **95/100 PASS, design only** | One root-owned fixed navigation escape, guarded leaf delegation, disabled stack gestures, preserved modal cancellation contracts, and bounded tour fallback address the original native concerns. |
| P3 Round 2 | **Pending independent re-review; no PASS claimed** | Original 85 REVISE and subsequent 92 REVISE are historical reviewer results. Dewey is rechecking the replacement global outdoor completion path. |
| P3 Round 3 | **Not claimed / not cleared** | Must follow an independently cleared Round 2 on the final candidate. |

These scores are bounded council judgments, not measured reliability percentages,
device success rates, or a numerical guarantee. P2's later review results belong
to the parent/reviewers, not this worker's Round 1 score. Parent plan text still
showing P3 amended signoff pending should reconcile with this explicit worker
judgment without treating it as Round 2 or release approval.

## Completed Implementation

- Shared phone/watch outdoor taxonomy covers running, walking, hiking, cycling,
  downhill skiing, cross-country skiing, snowboarding, ski touring, and snowboard
  touring. Unknown native kinds do not silently become running. The established
  default run path is preserved.
- Telemetry uses actual observation timestamps, `rawHeartRateSamples`, separate
  step SPM / cycling RPM cadence kinds, and power kind/source/model provenance.
  Existing scalar and heart-rate-summary contracts remain compatible. Summary
  averages are time/coverage qualified; incompatible streams are not blended.
- Run telemetry is captured outside the Run screen. The parent mounted
  `RunTelemetryBridge` and `RunCompletionRecovery` in the local-data access group.
  Run live display consumes fresh HR/cadence with clock-driven expiry, not the old
  ten-minute HR wrapper. Activity live payloads carry supported real fields/units.
- Cycling live estimates identify model `stride-road-load/2`, require defensible
  inputs, and remain estimates. `PowerEstimate.quantity` distinguishes cycling
  mechanical estimates from running metabolic estimates. Device/model power is
  not silently blended; unsupported/indoor modeled power is not fabricated.
- Watch startup retains the baseline required authorization path. Newly optional
  metric authorization is foreground setup, not an extra startup/watchdog gate.
  Pedometer callbacks bind the session object rather than a provisional ID that
  changes during adoption. Protected 32-bit/startup guards remain in place.
- Health lineage carries available exact recording/activity/workout identity
  through writer, native Watch metadata, candidate conversion and import. Neither
  timestamp overlap nor Watch connectivity is proof of recording identity.
- Native Live Activity freshness uses observation-based deadlines (ten seconds
  for relevant live observations), stale-date scheduling, and widget stale
  masking. Exact-instance End does not fall back to ending a newer current
  activity. Missing/disabled Live Activity capability is a safe cleanup no-op.
- Training Run Watch End is durably enqueued before joining recovery. Recovery
  drains arrivals during in-flight sweeps, isolates poison entries, preserves the
  original owner and first End, and acknowledges only after durable completion
  and exact native cleanup.
- All nine outdoor kinds now use the screen-independent completion path. Exact
  store ownership, not sport kind or an ID prefix, distinguishes Training Run
  from Activity/start running. First End captures a stable activity ID, original
  timestamp, route and telemetry before cleanup. B's durable activity commit API
  is awaited before native/GPS cleanup or active-state discard.
- Outdoor snapshot pause intervals are clipped and unioned; route points after
  first End are excluded. Bounded, pause-aware GPS reconstruction now runs
  **always**, not only when later points are removed. Immediate and delayed End
  snapshots with identical pre-End points have identical metrics; neither
  bridges recorded pauses. Active-store writes and cleanup flushes are
  serialized so an old clear cannot overwrite a new start. GPS cleanup/start
  ordering and post-await owner/instance checks protect a replacement session.
- Workout-state subscription precedes status/HR subscriptions and activation so
  the first native observer cannot flush an End before its listener exists.
- Indoor compatibility amendment: Watch End remains journaled and requests the
  existing treadmill confirmation at the original End timestamp. Timing and
  confirmed-speed segments freeze; Watch distance is not auto-saved as a
  confirmed-speed estimate. Shared dispatch returns `awaiting_confirmation`
  without consuming End, cleaning up, or raising an expected-deferral device
  error. Confirmed history is authoritative on later recovery.
- Both global queues consult B's `getRunDiscardResult(instance, lease)` before
  missing-session / indoor deferral decisions for Training Run commands. The
  lookup includes resolved, cleanup-acknowledged tombstones. Late short-run Ends
  therefore perform exact cleanup/acknowledgement without resaving, reopening
  confirmation, or leaving an endless retry marker after the active store clears.

## Completed Source File Changes

This is a path inventory of P3 work, not a claim of exclusive authorship of every
line in the shared working tree. Other agents' unrelated changes are preserved.

### Native Modules And Targets

```text
modules/stride-watch-connectivity/src/index.ts
modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift
modules/stride-live-activity/src/index.ts
modules/stride-live-activity/ios/Core/StrideRunActivityAttributes.swift
modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift
targets/StrideOSWatch/StrideWatchWorkoutManager.swift
targets/StrideOSWatch/StrideOSWatchApp.swift
targets/StrideOSWatch/expo-target.config.js
targets/StrideOSWatch/Info.plist
targets/StrideRunLiveActivity/StrideRunLiveActivity.swift
targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift
```

The Watch config/plist changes provide CoreMotion linkage and the cadence usage
description. Generated/native project changes from the parent's prebuild are not
attributed to this worker merely because they appear in the repository diff.

### Telemetry, Health, Types And Shared Sport Contracts

```text
src/types/activity.ts
src/hooks/useOutdoorTelemetry.ts                         (new)
src/components/watch/RunTelemetryBridge.tsx              (new)
src/lib/healthKit.ts
src/lib/liveActivityContracts.ts
src/lib/runLiveActivity.ts
src/utils/outdoorSports.ts                              (new)
src/utils/outdoorTelemetry.ts                           (new)
src/utils/capturedRunTelemetryMetrics.ts                 (new)
src/utils/liveCyclingPower.ts                            (new)
src/utils/watchRecordingEvidence.ts                     (new)
src/utils/healthKitImport.ts
src/utils/indoorHeartRate.ts
src/utils/metricSources.ts
src/utils/activityTracking.ts                           (shared)
src/utils/displayLabels.ts
```

The parent owns `outdoorPower.ts`, `outdoorAnalysis.ts`, analysis components and
`activitySummary.ts`; `MAX_SPEED_MPS` export in shared activity tracking was
coordinated with the parent. Do not attribute those parent implementations to C.

### Global Completion And Recording Stores

```text
src/lib/runEndRetryQueue.ts                             (new)
src/lib/watchRunCompletion.ts                           (new)
src/lib/outdoorEndJournal.ts                            (new)
src/lib/outdoorCompletion.ts                            (new)
src/utils/outdoorCompletionSnapshot.ts                  (new)
src/components/watch/RunCompletionRecovery.tsx          (new)
src/components/watch/WatchWorkoutBridge.tsx
src/store/activeRunStore.ts                             (shared)
src/store/activeActivityStore.ts
src/lib/gpsTracking.ts                                  (shared)
src/lib/activityGpsTracking.ts
```

### Shared Screen Files: Bounded C Edits Only

```text
app/(tabs)/activity/start.tsx
app/(tabs)/training/index.tsx
```

Activity/start: sport/live telemetry/start-permission integration and durable
`saveAndFinish` adapter. Aquinas owns selector/toggle compatibility and the active
return presentation/styles; the parent owns modal/navigation work. C did not
coedit the latest active JSX/styles replacement.

Training index: fresh live HR/cadence display and compatible native telemetry
payload/polling only. B owns completion bodies; the parent owns navigation/modal
and route-start integration. Root mounts in `app/_layout.tsx` are parent's edits.

### Focused Tests Added Or Updated For P3

```text
scripts/tests/outdoorCompletion.test.ts                  (new)
scripts/tests/runEndRecovery.test.ts                     (new)
scripts/tests/outdoorNativeReliability.test.ts           (new)
scripts/tests/healthKitRecordingMetadata.test.ts          (new)
src/utils/__tests__/outdoorTelemetry.test.ts              (new)
scripts/tests/watchWorkoutSync.test.ts
scripts/tests/liveActivityContracts.test.ts
scripts/tests/liveActivityNativeContract.test.ts
scripts/tests/build39LiveActivityStabilization.test.ts
scripts/tests/build45Phase10LiveActivity.test.ts
scripts/tests/build45Phase5ExperienceMode.test.ts
scripts/tests/build90Features.test.ts
scripts/tests/build91Features.test.ts                    (shared)
src/utils/__tests__/build48IntelligentTracking.test.ts
```

Shared test-file ownership does not imply that every changed assertion is C's.
Native schema assertions were updated for additive real fields while retaining
startup, identity, stale-value and no-fake-data safeguards.

## Actual Verification At This Checkpoint

Latest focused run after Dewey's pause/tombstone amendments:
**91 tests passed, zero failed, zero skipped**:

```sh
./node_modules/.bin/tsx --test --test-reporter=tap \
  scripts/tests/outdoorCompletion.test.ts \
  scripts/tests/runEndRecovery.test.ts \
  scripts/tests/watchWorkoutSync.test.ts \
  scripts/tests/build91Features.test.ts \
  src/utils/__tests__/outdoorTelemetry.test.ts \
  src/utils/__tests__/treadmill.test.ts
```

This includes the real JS completion adapters/journals and actual Zustand store
and GPS adapter tests with mocked native/storage boundaries. B's durable history
API is mocked in the outdoor adapter tests and has its own separately owned
verification; these are not on-device persistence/power-loss tests.

Latest Swift parse: **exit 0** for all seven following files, after the final
indoor compatibility amendment (which changes no Swift):

```sh
xcrun swiftc -frontend -parse \
  modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift \
  modules/stride-live-activity/ios/Core/StrideRunActivityAttributes.swift \
  modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift \
  targets/StrideRunLiveActivity/StrideRunLiveActivity.swift \
  targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift \
  targets/StrideOSWatch/StrideWatchWorkoutManager.swift \
  targets/StrideOSWatch/StrideOSWatchApp.swift
```

Scoped `git diff --check` passed. An earlier focused arm64_32 Watch typecheck
passed, but was not rerun as a final full native build. No new full application
typecheck was started; parent owns the single final typecheck/full-suite gate.
Parent-reported prebuild/build-number work is not worker execution evidence.

## Read Versus Write: Explicit Remaining Health Gap

Reads/imports support the relevant non-swim metrics where supported and consumed,
including running dynamics/speed/power/steps and cycling cadence/power. Optional
permissions are not a guarantee that HealthKit contains samples or that the Watch
can measure every metric during every sport.

Writes remain workout records, existing distance/energy totals and routes where
supported. Original phone/BLE HR, cadence and power series are **not newly
exported as Health quantity samples** by this work. Watch Health samples remain
in its native Health workout. Modeled power is never exported as measured power.
Do not claim complete metric write parity. The implementation deliberately limits
new write scopes to metrics with actual producers; this is a documented limitation,
not a separate user instruction to omit metric export.

## Remaining Owners And Gates

- **B:** defensive unconfirmed-indoor guard in `completeRunCommand`, plus durable
  short-run discard APIs are now present in current source. Narrow source
  readback also confirms `discardRunEnd` calls in the existing Training index
  completion paths. C integrated and tested the tombstone lookup in both global
  queues against mocked B API boundaries; B owns actual durable-store/UI tests.
  Unknown/unresolved End remains retained, never fuzzy-matched or deleted to
  make the queue appear empty.
- **B dependencies:** `runCompletionCommand.ts`, `runCompletionJournal.ts`,
  `runCompletionIdentity.ts`, `activityMigration.ts`, `workoutStore.ts` and
  `activityStore.ts` durable commit/cleanup APIs are separately owned work.
- **Parent:** exact Watch-recording Health-write suppression and importer
  lease/dedupe fixes in `HealthActivityWriter.tsx` / `healthActivityWrite.ts`.
  C did not take ownership of those fixes.
- **Aquinas:** parent reports map-first active Activity component frozen with 15
  tests ready. C did not edit that component or run/claim its independent tests.
- **Dewey:** independent P3 Round 2 all-outdoor completion re-review pending.
  The pause/delivery-timing finding is implemented with immediate/delayed
  equivalence coverage. Dewey separately owns the Live Activity Stop command
  durability / stale-command revisions in `LiveActivityCommandReconciler` and
  `runLiveActivity.ts` consume regions plus tests; C did not coedit those regions.
  Re-review the combined candidate before any Round 3 claim.
- **Parent:** final frozen-diff full tests, typecheck, native build/device checks,
  council records and any commit/EAS action. No EAS, commit, push or release was
  performed by C at this checkpoint.

Worker C is handed off and available for bounded review findings. This document
records the implementation checkpoint; it does not freeze other agents' ongoing
edits or certify their final combined candidate.

## Parent Integration Readback

General Round 2 passed at 95/100 after independent review of 115 focused checks
and the 47-case behavioral suite. Design Round 2 passed at 95/100 after the
Mapbox follow/gesture correction and 18 focused checks. B verified both real
queues consume acknowledged discard tombstones before indoor/missing-session
deferral; 138 focused integration checks passed. The root recovery bridge calls
both run and outdoor recovery on mount, foreground and its five-second interval.
Live Activity Stop now preserves original intent time and awaits durable End
acceptance before acknowledging the native command; failures remain pending.

Parent clean prebuild for 93 and seven-file Swift syntax parse passed. Final
typecheck and Hermes export exited 0 after correcting the missing average-pace
local. Full frozen suite passed 907/907 with no failures/skips. Final independent
Round 3 passed 95/100 after Training Run End snapshot/telemetry/projection fixes,
96 focused checks and the real-store failed-write/retry durability probe.
These checks do not prove physical phone/watch sensor accuracy, background
execution or offline map-tile availability. EAS/native compile and Apple upload
states are recorded separately in the release record.
