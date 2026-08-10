# Live Activity Build 37 Backbone Breakpoint Plan

Date: 2026-08-09
Branch: build-19-v3-foundation
Current release under test: Build 56
Known-good device baseline: Build 37, commit `0526d81`
First suspected failing boundary: Build 38, commit `e77dced`

## Goal

Use Build 37's Live Activity implementation as the known-good native backbone while keeping the rest of Build 52 intact. Then reintroduce later Live Activity features in small, build-numbered slices until the device failure reappears.

This document is the tracking list for anything that directly owns Live Activities, calls into Live Activities, receives Lock Screen commands, changes ActivityKit signing/packaging, or indirectly changes the identity/lifecycle data that Live Activities depend on.

## Current Device Finding

- Build 37 works on the same phone.
- Builds 38 through 52 do not work.
- Build 52 restored the Build 37 single-active lifecycle, but it still did not restore the feature on device.
- Therefore the failure is likely not only the start-before-end lifecycle change repaired in Build 52.
- The next isolation pass should start at the exact Build 37 Live Activity code surface, not another partial patch.

## Build 37 Backbone To Restore First

These are the files that should be treated as the Build 37 Live Activity foundation for the first isolation build:

- `modules/stride-live-activity/src/index.ts`
  - Simple positional JS bridge.
  - Run payload only has run name, elapsed time, distance, pace, HR, zone, status, paused state.
  - Strength payload only has workout name, elapsed time, current/next exercise, sets completed, total sets, paused state.
  - Starts return null if native module is missing or `isAvailable()` is false.
  - No `workoutInstanceId`, `sessionId`, `sessionSource`, diagnostics payload, route directions, outdoor payload variants, or per-activity metric contract.

- `modules/stride-live-activity/ios/Core/StrideRunActivityAttributes.swift`
  - Attribute: `runName`.
  - Content state: `elapsedSeconds`, `distanceMiles`, `averagePace`, `heartRate`, `zoneLabel`, `zoneStatus`, `status`, `isPaused`.
  - No activity type, metric labels, interval text, navigation instruction, cue text, elevation, control state, session identity, or source identity.

- `modules/stride-live-activity/ios/Core/StrideStrengthActivityAttributes.swift`
  - Attribute: `workoutName`.
  - Content state: `elapsedSeconds`, `currentExercise`, `nextExercise`, `setsCompleted`, `totalSets`, `isPaused`.
  - No prescription, load display, progress label, control state, session identity, or source identity.

- `modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift`
  - Native `start` ends all existing run Live Activities before requesting a new one.
  - Native `startStrength` ends all existing strength Live Activities before requesting a new one.
  - `currentActivity()` uses the saved in-process run ActivityKit id, then falls back to the first active run activity.
  - `currentStrengthActivity()` uses the saved in-process strength ActivityKit id, then falls back to the first active strength activity.
  - No session/source matching.
  - No MapKit route bridge.
  - No diagnostic state API.

- `targets/StrideRunLiveActivity/StrideRunLiveActivity.swift`
  - Build 37 already had run and strength widgets.
  - Build 37 already had AppIntent-powered buttons, so AppIntents alone are not the breakpoint.
  - Layout reads only the simple run and strength content states listed above.

- `targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift`
  - Build 37 writes only command id/action/createdAt to App Group.
  - Intents update the first matching ActivityKit activity directly.
  - Stop/complete can end the activity from the widget process.
  - No session/source command ownership.
  - No pending-control state.

- `targets/StrideRunLiveActivity/expo-target.config.js`
  - Widget target, bundle suffix `.liveactivity`.
  - Frameworks: `ActivityKit`, `AppIntents`, `SwiftUI`, `WidgetKit`.
  - App Group entitlement inherited from app config.
  - Build 37 used deployment target `18.0`.

- `targets/StrideRunLiveActivity/pods.rb`
  - Links `StrideLiveActivityCore` from the local native module.

## Current Build 52 Direct Live Activity Surface

These are the current files that directly define, package, expose, or test Live Activities:

- `app.json`
  - `ios.buildNumber`.
  - App Group `group.com.mooremovement.strideos`.
  - `NSSupportsLiveActivities`.
  - `NSSupportsLiveActivitiesFrequentUpdates`.

- `modules/stride-live-activity/expo-module.config.json`
  - Expo native module registration.

- `modules/stride-live-activity/package.json`
  - Local JS package metadata for `stride-live-activity`.

- `modules/stride-live-activity/src/index.ts`
  - JS bridge exported to the app.
  - Current version includes expanded payload fields, session identity, diagnostics, route directions, command typing, run listeners, and strength listeners.

- `modules/stride-live-activity/ios/Core/StrideRunActivityAttributes.swift`
  - Current ActivityKit run/outdoor attributes and content state.

- `modules/stride-live-activity/ios/Core/StrideStrengthActivityAttributes.swift`
  - Current ActivityKit strength attributes and content state.

- `modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift`
  - Native ActivityKit request/update/end logic.
  - App Group command read/write/clear.
  - Activity id persistence.
  - Diagnostics.
  - MapKit route directions.

- `modules/stride-live-activity/ios/StrideLiveActivity.podspec`
  - Native module pod.

- `modules/stride-live-activity/ios/StrideLiveActivityCore.podspec`
  - Shared ActivityKit attribute pod used by app and widget.

- `targets/StrideRunLiveActivity/Info.plist`
  - Widget extension plist.

- `targets/StrideRunLiveActivity/StrideRunLiveActivity.swift`
  - Run/outdoor and strength ActivityKit widget layouts.
  - Lock Screen and Dynamic Island views.
  - iOS 17 passive display fallback and iOS 18 control guards in current code.

- `targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift`
  - LiveActivityIntent definitions.
  - App Group command writer.
  - Current command state and ActivityKit update/end behavior.

- `targets/StrideRunLiveActivity/expo-target.config.js`
  - Widget target registration, deployment target, frameworks, App Group entitlements, colors.

- `targets/StrideRunLiveActivity/pods.rb`
  - Widget pod dependency on `StrideLiveActivityCore`.

- `scripts/tests/liveActivityNativeContract.test.ts`
  - Native-source contract checks.

- `scripts/tests/build39LiveActivityStabilization.test.ts`
  - Ownership and stabilization checks.

- `scripts/tests/build45Phase10LiveActivity.test.ts`
  - Later payload/Lock Screen contract checks.

## Current Build 52 App Callers

These files call Live Activity start/update/end APIs or process commands:

- `src/lib/runLiveActivity.ts`
  - Converts running/outdoor snapshots into native payloads.
  - Starts/updates/ends run/outdoor Live Activities.
  - Polls App Group commands from Lock Screen controls.

- `src/lib/strengthLiveActivity.ts`
  - Normalizes strength payloads.
  - Starts/updates/ends strength Live Activities.
  - Applies active strength session fallback identity.

- `src/lib/liveActivityContracts.ts`
  - Normalizes outdoor/run/strength payload details.
  - Defines control-state, activity-type, metric selection, and session matching.

- `src/components/liveActivity/LiveActivityCommandReconciler.tsx`
  - Mounted at app root.
  - Waits for active run, outdoor activity, and strength stores to hydrate.
  - Polls pending App Group commands.
  - Routes pause/resume/stop/complete commands to the current app-side active session.

- `app/_layout.tsx`
  - Mounts `LiveActivityCommandReconciler`.

- `app/(tabs)/training/index.tsx`
  - Main running screen start/update/end calls.

- `app/(tabs)/training/run-tracking.tsx`
  - Run tracking start/update/end calls.

- `app/(tabs)/activity/start.tsx`
  - Outdoor activity start/update/end calls.

- `app/(tabs)/activity/indoor-ride.tsx`
  - Indoor ride start/update/end through outdoor Live Activity contract.

- `app/(tabs)/strength/index.tsx`
  - Training Block strength start/update/end calls.

- `app/(tabs)/strength/preset/[id].tsx`
  - Preset strength start calls.

- `app/(tabs)/strength/preset-session.tsx`
  - Preset strength update/end calls.

- `app/(tabs)/strength/custom-session.tsx`
  - Custom strength end calls.

- `app/(tabs)/calendar/index.tsx`
  - Ends strength Live Activity when calendar actions cancel/complete relevant strength work.

- `app/(tabs)/settings/index.tsx`
  - Live Activity diagnostics display.

## Indirect Interactors

These do not necessarily call ActivityKit directly, but they can change whether the right Live Activity starts, updates, or ends:

- `src/store/activeRunStore.ts`
  - Running active state, pause/resume/completion, elapsed time, `workoutInstanceId`.

- `src/store/activeActivityStore.ts`
  - Outdoor active state, activity id, run/walk intervals, navigation instruction, elevation, `workoutInstanceId`.

- `src/store/activeIndoorRideStore.ts`
  - Indoor cycling active state and `workoutInstanceId`.

- `src/store/activeStrengthSessionStore.ts`
  - Active strength source, workout id, exercises, completion state, `workoutInstanceId`.

- `src/lib/activeSessionCoordinator.ts`
  - One-active-session ownership across run/outdoor/strength.

- `src/lib/routing.ts`
  - Route constants used by command reconciliation.

- `src/lib/routeGuidance.ts`
  - Route guidance text that can enter outdoor Live Activity payloads.

- `eas.json`
  - `appVersionSource` and release profile behavior.

- `.easignore`
  - Determines whether generated native output is included or excluded from EAS archives.

- `package.json` and `package-lock.json`
  - Expo SDK/native dependency versions that can affect prebuild and widget target generation.

- Generated native output from `npx expo prebuild --platform ios --no-install --clean`
  - Must be read back before release for target embedding, entitlements, deployment target, bundle id, and `CFBundleVersion`.

## Build 37 To Build 38 Suspect Groups

### Group A: Expanded ActivityKit content-state schema

Build 38 expanded run content state with activity type, metric label/value/unit, current interval, next transition, navigation instruction, cue text, and control state. It expanded strength content state with prescription, load display, progress label, and control state.

Risk: an encoded content-state mismatch, unsupported field path, or widget view assumption can prevent rendering even though request/update calls appear valid.

### Group B: Control state and pending command model

Build 38 introduced pending states such as pause/resume/complete pending. Build 37 controls wrote simple commands and directly updated or ended the first ActivityKit activity.

Risk: pending state or command ownership can leave the widget in a state that the app immediately overwrites, rejects, or never consumes.

### Group C: App Group command identity and ActivityKit id persistence

Build 38 began persisting ActivityKit ids and command metadata more aggressively in the App Group.

Risk: stale persisted ids, stale command ids, or mismatched active activity lookup can make updates target no activity or the wrong activity.

### Group D: Normalized multi-activity payload layer

Build 38 broadened Live Activities from a run/strength-only mental model toward walking, run/walk, cycling, skiing, hiking, route guidance, and richer strength display.

Risk: the app can call the native start path with payload combinations the Build 37 widget did not need to handle.

### Group E: Native MapKit route bridge colocated in Live Activity module

Build 38 added `getRouteDirections` and imported MapKit in `StrideLiveActivityModule.swift`.

Risk: this is not ActivityKit, but it changes the native module's compiled surface. If the native module fails to load, the JS bridge cannot start Live Activities.

### Group F: Strength source ownership and poller behavior

Build 39 documents a preset Live Activity pause failure after Build 38. Later code introduced source-gated Preset/Training Block pollers and session ownership.

Risk: a mounted screen or hydrated store can consume, overwrite, or reject commands for the actually active strength Live Activity.

### Group G: `workoutInstanceId` and exact command targeting

Later builds, especially Build 45 and Build 48, introduced explicit `workoutInstanceId` and exact matching. Build 52 already loosened some native matching, but the JS callers and command reconciler still operate in the newer identity model.

Risk: a native Build 37-style activity can work, but the current app-side identity layer may still decide not to start, update, or end it consistently unless the adapter is deliberately simple.

### Group H: Packaging and target generation

Build 37 and Build 38 both used the same widget target name and App Group, and Build 37's target config already used deployment target `18.0`. Build 51 lowered the target to `17.0`, but device testing shows Build 52 still fails.

Risk: target generation still must be checked, but the original Build 37 to Build 38 breakpoint is more likely code/contract than only deployment target.

## Proposed Isolation Builds

I recommend five potential TestFlight builds after this document, with one suspect group per build. We should stop as soon as the failing behavior reappears.

### Build 53: Build 52 app plus exact Build 37 Live Activity backbone

Status: implemented as the first isolation slice.

Restore Build 37 versions of:

- `modules/stride-live-activity/src/index.ts`
- `modules/stride-live-activity/ios/Core/StrideRunActivityAttributes.swift`
- `modules/stride-live-activity/ios/Core/StrideStrengthActivityAttributes.swift`
- `modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift`
- `modules/stride-live-activity/ios/StrideLiveActivity.podspec`
- `modules/stride-live-activity/ios/StrideLiveActivityCore.podspec`
- `targets/StrideRunLiveActivity/StrideRunLiveActivity.swift`
- `targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift`
- `targets/StrideRunLiveActivity/expo-target.config.js`

Keep current Build 52 app features outside that surface. Add only thin adapters in `src/lib/runLiveActivity.ts` and `src/lib/strengthLiveActivity.ts` if current callers need to down-convert newer snapshots into the simple Build 37 payloads.

Pass condition: Live Activity appears and updates on device for the simplest supported run and strength flows.

If Build 53 fails, the problem is probably outside the Live Activity implementation itself: packaging, target embedding, entitlements, module loading, caller path, permissions/settings, or generated native config.

### Build 54: Reintroduce expanded display payload only

Status: implemented as the second isolation slice.

Add back Build 38's extra content-state display fields, but keep Build 37 lifecycle and simple command ownership.

Pass/fail isolates Group A and most of Group D.

Implementation boundary:
- Restored run display fields: `activityType`, `metricLabel`, `metricValue`, `metricUnit`, `currentInterval`, `nextTransition`, `navigationInstruction`, `cueText`, and passive `controlState`.
- Restored strength display fields: `prescription`, `loadDisplay`, `progressLabel`, and passive `controlState`.
- Kept Build 37 start-before-request lifecycle, first-active fallback, simple App Group command shape, no native session/source matching, no MapKit route bridge, and no persisted ActivityKit id store.

### Build 55: Split Build 54 failure between native payload and widget rendering

Status: failed device QA. Because the simple Build 53 widget was restored and the build still failed, the failure is most likely in the expanded native ActivityKit content-state schema, not in widget rendering.

Keep Build 54's expanded native content-state fields and JS/native argument passing, but restore the Build 53 widget rendering that only reads the original Build 37/53 display fields.

Pass/fail isolates Group A native payload encoding from Group D widget rendering:
- If Build 55 works, the Build 54 failure is in the Build 38 widget UI/control rendering.
- If Build 55 fails, the Build 54 failure is in the expanded ActivityKit content-state/native payload contract itself.

Implementation boundary:
- Kept expanded run content-state fields in Swift attributes/module and TypeScript bridge arguments.
- Kept expanded strength content-state fields in Swift attributes/module and TypeScript bridge arguments.
- Restored `targets/StrideRunLiveActivity/StrideRunLiveActivity.swift` to the Build 53 simple widget rendering.
- Still no pending command ownership, no native session/source matching, no MapKit route bridge, and no persisted ActivityKit id store.

### Build 56: Revert native ActivityKit content-state schema

Status: implemented after Build 55 failed device QA.

Keep current app-side TypeScript payload compatibility fields, but send only the Build 53 native arguments into Swift and restore the Build 53 `ActivityAttributes.ContentState` fields.

Pass/fail confirms the Build 55 diagnosis:
- If Build 56 works, the expanded native content-state schema is confirmed as the culprit.
- If Build 56 fails, the culprit is outside the display payload experiment and we should compare generated/native packaging against Build 53.

Implementation boundary:
- Removed expanded native run content-state fields: `activityType`, `metricLabel`, `metricValue`, `metricUnit`, `currentInterval`, `nextTransition`, `navigationInstruction`, `cueText`, and `controlState`.
- Removed expanded native strength content-state fields: `prescription`, `loadDisplay`, `progressLabel`, and `controlState`.
- Kept TypeScript payload fields accepted as no-op compatibility fields so current app callers do not need to change.
- Kept Build 53 simple widget rendering, simple command store, first-active fallback, no native session/source matching, no MapKit route bridge, and no persisted ActivityKit id store.

### Build 57: Reintroduce pending controls and App Group command ownership

Add pending control state and command consumption behavior while keeping payload/lifecycle otherwise known-good.

Pass/fail isolates Groups B and C.

### Build 58: Reintroduce multi-source/outdoor/route Live Activity support

Add outdoor activity, run/walk, cycling/skiing speed-vs-pace payloads, route guidance text, and MapKit bridge if needed.

Pass/fail isolates Groups D and E.

### Build 59: Reintroduce current identity model

Add `workoutInstanceId`, exact source/session matching, diagnostics, and current command reconciler behavior.

Pass/fail isolates Groups F and G.

## Device QA For Every Isolation Build

Use the same phone and same iOS settings each time:

- Install the build fresh enough to avoid stale App Group state if possible.
- Confirm Settings > StrideOS > Live Activities is allowed.
- Start a basic run from the same entry point each time.
- Lock the phone within 5 seconds of start.
- Confirm whether the Live Activity appears.
- Pause and resume from inside the app.
- If controls are present, pause/resume from the Lock Screen.
- End/discard/complete and confirm the Live Activity dismisses.
- Repeat with the simplest strength flow.
- Record exact result as: appears, updates, controls work, ends, stale state, no appearance, or crash.

## Recommended Check-In Decision

Before making code changes, choose one of these build ladders:

- Conservative: Builds 53 through 57, five total isolation builds.
- Faster: Builds 53 through 55, three total builds, then regroup based on the first failing reintroduction.

My recommendation is the faster ladder first:

1. Build 53: exact Build 37 backbone in Build 52 app. Result: passed device QA.
2. Build 54: add expanded display payload and widget rendering. Result: failed device QA.
3. Build 55: keep expanded native payload, restore simple Build 53 widget rendering. Result: failed device QA.
4. Build 56: revert the expanded native ActivityKit content-state fields while keeping current app-side compatibility inputs.

If Build 56 works, treat the expanded native content-state fields as the confirmed failure source and reintroduce them one at a time in future builds only after the product path needs them. If Build 56 fails, stop spending build numbers on payload slicing and compare generated native packaging/module registration against Build 53.
