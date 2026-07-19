# Build 40 — Unified Training Schedule and Coaching Stabilization

- Date: 2026-07-19
- Build target: iOS Build 40
- Starting state: clean Build 39 release commit `4d45616` on `build-19-v3-foundation`

## Completed checklist

- Unified Today, Calendar, Running, and AI Coach around the scheduled-session adapter.
- Added executable run/walk prescription materialization.
- Prevented same-day duplicate primary beginner endurance sessions.
- Preserved rule that current local day is not Missed before the day ends.
- Added AQI display/fallback and conservative information sheet.
- Confirmed Activity store defaults to empty production history.
- Added AI Coach markdown/emoji sanitization and keyboard-scroll behavior.
- Confirmed MM-DD-YYYY date pickers and PR time picker controls.
- Normalized Settings race dates, Profile calibration PR dates, and manual workout log dates to MM-DD-YYYY user-facing entry/display while preserving ISO storage.
- Added HR voice coaching states for above target, below target, and back in zone.
- Confirmed Movement Lab marker editor allows full-image drag range with edge clamping and gesture ownership.

## Files changed

See `git diff --stat` for the final audited file list.

## Executive decisions

- Used the existing `ScheduledSession` adapter as the authoritative cross-screen projection instead of adding another persisted store.
- Kept Activity seed-data correction as an empty-source guarantee because screenshot records appear to be device-local records, not production seed records.
- Did not generate or replace Dion Bike Fit assets in this pass.

## Verification

- `npm run typecheck`: passing
- `npm run test`: 198/198 passing
- `npm run expo:check`: passing
- `git diff --check`: passing
- `npx expo export --platform ios`: passing
- `swiftc -parse` for affected ActivityKit/App Intent Swift sources: passing
- Native Xcode project compilation: unavailable locally because `xcodebuild` is pointed at Command Line Tools rather than full Xcode; native coverage is via deterministic ActivityKit/App Intent contract tests and the remote EAS production build.

## Limitations

- iOS keyboard animation, GPS tracking, Live Activity controls, AQI permission behavior, and voice timing require TestFlight device validation.

## Confidence score

- Pre-release local confidence: 95% after automated gates and EAS state check; physical-device validation remains assigned to TestFlight.

## Release artifacts

- Commit: pending
- EAS build ID: pending
- TestFlight submission ID: pending
