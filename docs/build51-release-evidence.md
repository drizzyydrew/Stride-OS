# StrideOS Build 51 Release Evidence

## Scope

- App version: 1.0.0
- iOS build number: 51
- Main bundle ID: com.mooremovement.strideos
- Live Activity extension bundle ID: com.mooremovement.strideos.liveactivity
- App Group: group.com.mooremovement.strideos

Build 51 is a Live Activity hotfix after Build 50 device testing showed the Lock Screen activity still did not appear.

## Implemented

- Lowered the Live Activity extension target from iOS 18.0 to iOS 17.0.
- Kept interactive Lock Screen controls behind iOS 18 availability checks.
- Added passive iOS 17 fallback UI for run and strength Live Activities so the activity can display without iOS 18-only AppIntent controls.
- Aligned the native ActivityKit availability gate with the shipped extension target: display requires iOS 17+.
- Changed JS Live Activity start calls to invoke native start when the module exists instead of silently skipping when `isAvailable()` is false.
- Added clearer diagnostics for unsupported iOS versions and native ActivityKit request failures.
- Updated Settings copy to distinguish Live Activity display support from iOS 18 Lock Screen controls.
- Aligned Expo SDK 56 patch dependencies reported by `expo install --check`.

## Validation

- `npm test`: 514 passed, 0 failed.
- Focused Live Activity tests: 25 passed, 0 failed.
- `npm run expo:check`: dependencies are up to date.
- `git diff --check`: passed.
- Clean CNG iOS prebuild: passed.
- Generated Xcode project embeds `StrideRunLiveActivity.appex`.
- Generated Live Activity extension target deployment target: iOS 17.0.
- Generated Live Activity extension entitlements: App Groups only.
- Generated main app `Info.plist` includes `NSSupportsLiveActivities` and `UIBackgroundModes` with `location`, `fetch`, and `audio`.

## Validation Caveats

- Local `npm run typecheck` remained unverified because `tsc --noEmit --pretty false` stalled with near-zero CPU and no diagnostics.
- Local native compile with `xcodebuild` could not run because this machine's active developer directory is Command Line Tools, not full Xcode.
- EAS production build is the native Swift compile/signing gate.
- Physical-device QA remains required for actual Lock Screen/Dynamic Island display, iOS Live Activities app setting, pause/resume controls on iOS 18+, and locked-workout updates.

## Device QA Checklist

- Install Build 51 from TestFlight.
- Confirm iPhone iOS version.
- Confirm Settings > Apps > StrideOS > Live Activities is enabled.
- Start an outdoor run while StrideOS is foregrounded.
- Lock the phone and verify the Live Activity appears.
- Verify time, distance, pace, heart rate, interval guidance, and pause state update.
- On iOS 18+, test Pause, Resume, and Stop controls from the Lock Screen.
- On iOS 17, verify display works and controls are absent/passive.
- Finish or discard the workout and confirm the matching Live Activity ends.
- Reopen StrideOS > More/Settings > Live Activities diagnostics and record last start/update/end/error values if anything fails.
