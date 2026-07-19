# Build 41 — Unified Training Schedule and Coaching Stabilization

- Date: 2026-07-19
- Build target: Build 41, created as a follow-up stabilization build after Build 40 was already consumed by EAS
- Starting state: Build 40 release commit `169c2a9` on `build-19-v3-foundation`

## Completed checklist

- Preserved the Build 40 stabilization implementation and moved the release artifact target to Build 41 after EAS history contained multiple Build 40 records.
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

- Build 40 was treated as consumed for EAS discipline after EAS history contained Build 40 records.
- Build 41 was the next unused iOS build number when this follow-up commit was created.
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

- Release-code confidence: 95% after automated gates, Swift parse, EAS production build, and screenshot-driven source QA.
- Distribution confidence: submitted successfully to App Store Connect; Apple processing remains the TestFlight handoff.

## Release artifacts

- Build 40 EAS IDs:
  - `bb67fc28-26d0-49d0-a9ff-fbdbed44056a` — FINISHED, submitted successfully as `cab2b1d2-904d-469b-b416-1dbfd6c4f856`
  - `42d99245-5860-4828-970d-7e50f8ecc82d` — CANCELED, no IPA
  - `2a48ca0b-b224-4825-a3a9-0bbf9086f216` — CANCELED, no IPA
- Commit: `afb40eccdad3a0a35af3489b4f3707ab775cd528`
- EAS Build 41 ID: `6fef51df-81e6-495a-93b8-6574bc908c7c`
- EAS Build 41 status: FINISHED
- App version / iOS build number: `1.0.0` / `41`
- IPA artifact: `https://expo.dev/artifacts/eas/A-wosVHLArCDOCK2YgC4hIln8ZEOfnrwTZRUEXZFppg.ipa`
- TestFlight submission ID: `439b68b3-b38e-47d8-bd10-7bac69181e39`
- TestFlight submission status: submitted successfully by EAS Submit.
- App Store Connect processing state for Build 41: binary uploaded and accepted by App Store Connect; Apple processing pending/underway.
- Remaining blocker: none for upload/submission. Physical-device validation remains the internal TestFlight checklist.
