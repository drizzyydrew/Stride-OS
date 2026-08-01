# StrideOS Build 48 Release Evidence

## Scope

- App version: `1.0.0`
- iOS build number: `48`
- Main bundle ID: `com.mooremovement.strideos`
- Live Activity extension bundle ID: `com.mooremovement.strideos.liveactivity`
- App Group: `group.com.mooremovement.strideos`

## Architecture

- Live Activities are keyed to canonical `workoutInstanceId` across running, outdoor activity, indoor cycling, and strength flows.
- Native ActivityKit updates and end calls now target matching run or strength activities by session identity instead of ending unrelated activities.
- Live Activity diagnostics expose iOS authorization, App Group identity, active counts, and last start/update/end/error state.
- Outdoor GPS uses Expo Location/TaskManager background tasks only while an active outdoor workout is running.
- Auto-pause and activity-detection logic are pure conservative state machines using GPS, displacement, accuracy, motion, cadence, and power evidence.
- Treadmill phone placement is persisted as a default and captured per workout, with stationary-phone metrics marked unavailable unless a connected source exists.
- Health/Fitness Sync imports HealthKit workouts as canonical `Activity` records with UUID/source dedupe, route availability, source metadata, local date, and schedule reconciliation.
- WorkoutKit support is represented by safe eligibility/export architecture for honest running and cycling prescriptions; unsupported prescriptions are rejected with an explanation.
- The Stride Report includes a dedicated `Shoe Report` share-card variant and unit-aware climbing highlights.

## Migrations

- Activity store schema version is `3`.
- New Activity fields are additive: `healthKit`, `workoutKit`, and per-metric telemetry source metadata.
- Existing Build 47 activities, scheduled-session links, treadmill data, indoor cycling data, strength data, readiness data, shoes, reports, voice preferences, BLE settings, and plans remain readable.
- Migration remains idempotent and continues legacy scheduled-session ID remapping on every hydration.

## Validation

- `git diff --check`: pass.
- `PATH=/usr/local/bin:$PATH npm run typecheck`: pass.
- `PATH=/usr/local/bin:$PATH npm test`: pass, `502/502`.
- Focused Build 48 tests: pass, `7/7` in `src/utils/__tests__/build48IntelligentTracking.test.ts`.
- `PATH=/usr/local/bin:$PATH npx expo export --platform web`: pass, `119` static routes.
- `PATH=/usr/local/bin:$PATH npm run expo:check`: pass after SDK 56 patch alignment.
- `PATH=/usr/local/bin:$PATH npx expo prebuild --platform ios --no-install --clean`: pass.
- Generated main app Info.plist: version `1.0.0`, build `48`, `NSSupportsLiveActivities=true`, `NSSupportsLiveActivitiesFrequentUpdates=true`, `UIBackgroundModes=[fetch, location]`.
- Generated main app entitlements: HealthKit, App Groups `group.com.mooremovement.strideos`, Apple Sign In, and push environment.
- Generated Live Activity extension: WidgetKit extension point, bundle ID `com.mooremovement.strideos.liveactivity`, build `48`, App Group entitlement only.
- `PATH=/usr/local/bin:$PATH npm audit --omit=dev`: reports Expo/tooling-chain advisories; no broad audit fix was applied because that would force unscoped release dependency changes.
- Secret scan: no credential material found; matches were source placeholders, env names, and code terms.

## Native Limitations

- Physical-device validation is still required for Lock Screen, Dynamic Island, background GPS under lock, HealthKit permissions/import, WorkoutKit scheduling, local notifications, phone motion, and BLE source behavior.
- Local simulator/native compile validation was unavailable because `xcodebuild` and `simctl` were not installed or not in PATH in this environment.
- Browser screenshot QA was unavailable because Playwright/browser automation was not installed or exposed. Static export and source-level visual/layout contracts passed.
- Passive activity detection is opt-in and suggestion-only. It does not promise detection after force-quit and does not keep high-accuracy GPS running all day.
- WorkoutKit scheduling is not a watchOS app substitute and only supports workouts that can be represented honestly.

## Physical-Device Checklist

- Start, pause, resume, complete, cancel, and discard each eligible Live Activity type.
- Confirm dismissed prior activities do not suppress future activities.
- Verify Lock Screen and Dynamic Island layouts for running, cycling, indoor cycling, treadmill, and strength.
- Lock screen and switch apps during outdoor running and cycling; confirm GPS continues and stops after completion/discard.
- Deny location, motion, and Health permissions and verify degraded states.
- Validate auto-pause/resume on running and cycling with good GPS, poor GPS, brief stops, and manual pause.
- Validate treadmill placement modes: on body, resting on treadmill, connected sensor.
- Import recent Apple Workout/Health workouts, run Sync Selected and Sync All twice, and confirm no duplicates.
- Export an eligible running/cycling scheduled workout to Apple Workout/Apple Watch if WorkoutKit is available on device.
- Inspect Settings diagnostics and source labels in Simple, Balanced, and Data-Rich modes.
