# Build 41 — Unified Training Schedule and Coaching Stabilization

- Date: 2026-07-19
- Build target: Build 41, selected after Build 40 was canceled in EAS with no artifact
- Starting state: Build 40 release commit `169c2a9` on `build-19-v3-foundation`

## Completed checklist

- Preserved the Build 40 stabilization implementation and moved the release artifact target to Build 41 because EAS history now contains canceled Build 40.
- Unified Today, Calendar, Running, Strength, and AI Coach around the scheduled-session adapter.
- Added executable run/walk prescription materialization and duplicate primary endurance-session prevention.
- Preserved the rule that current local day is not Missed before the day ends.
- Added AQI display/fallback and conservative information sheet.
- Confirmed Activity store defaults to empty production history and uses a designed empty state.
- Added AI Coach markdown/emoji sanitization, exact scheduled-session context, and keyboard-scroll behavior.
- Confirmed MM-DD-YYYY date pickers and PR time picker controls.
- Normalized Settings race dates, Profile calibration PR dates, and manual workout log dates to MM-DD-YYYY user-facing entry/display while preserving ISO storage.
- Added HR voice coaching states for above target, below target, and back in zone.
- Confirmed Movement Lab marker editor allows full-image drag range with edge clamping and gesture ownership.

## Files changed

See `git show --stat --oneline` for the audited Build 40 and Build 41 release commits.

## Executive decisions

- Build 40 was treated as consumed for EAS discipline after cancellation, even though it produced no IPA.
- Build 41 is the next unused iOS build number.
- The existing `ScheduledSession` adapter remains the authoritative cross-screen projection instead of adding another persisted schedule store.
- Activity seed-data correction is an empty-source guarantee; screenshot records are treated as previous device-local records rather than production defaults.
- No Dion production assets or manifests were modified in this pass.

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

- Build 40 EAS ID: `2a48ca0b-b224-4825-a3a9-0bbf9086f216` — canceled, no IPA, no TestFlight submission.
- Commit: pending Build 41 follow-up commit.
- EAS Build 41 ID: pending.
- TestFlight submission ID: pending.

