# StrideOS Build 50 Release Evidence

## Scope

- App version: 1.0.0
- iOS build number: 50
- Main bundle ID: com.mooremovement.strideos
- Live Activity extension bundle ID: com.mooremovement.strideos.liveactivity
- App Group: group.com.mooremovement.strideos

Build 50 is a follow-up to Build 49 focused on locked-workout reliability, voice coaching, background activity GPS, HealthKit write honesty, and the Build 49 QA findings.

## Implemented

- Registered the outdoor activity background-location task at app launch so iOS can resolve the handler after a cold background relaunch.
- Enabled background workout audio with `UIBackgroundModes` containing `audio` and `location`.
- Released the ducked audio session after voice cues so music/podcast volume can return.
- Added configurable distance voice updates: 0.5 mi / 1 mi for imperial users and 0.5 km / 1 km for metric users.
- Distance updates announce the distance boundary, split pace, average pace, and elapsed moving time.
- Added background run/walk cue handling from the activity GPS path.
- Corrected background activity GPS timing to use each location sample timestamp.
- Stopped writing fabricated Active Energy calories to HealthKit from training load.
- Removed Active Energy from HealthKit write permissions while retaining read access where authorized.
- Made strength Live Activity ending more tolerant when the session source has already been cleared.
- Aligned distance conversion constants across unit helpers.
- Added audit documentation for the Build 49 QA findings and Build 50 fixes.

## Validation

- `npm test`: 513 passed, 0 failed.
- Focused voice/HealthKit/background activity tests: passed.
- `npm run expo:check`: dependencies are up to date.
- `git diff --check`: passed.
- Edited source parse check via esbuild: passed with only existing `require()` warnings from static assets.
- Clean CNG iOS prebuild: passed.
- Generated main-app `Info.plist` background modes: `location`, `fetch`, `audio`.
- Generated main-app entitlements: HealthKit, App Groups, Sign in with Apple, APNs environment.
- Generated Live Activity extension entitlements: App Groups only.
- Generated Xcode project embeds `StrideRunLiveActivity.appex` as an app extension.

## Validation Caveats

- `npm run typecheck` stalled in this environment and timed out without TypeScript diagnostics.
- `npx expo export --platform web` stalled in this environment and was terminated without output.
- Physical-device QA is still required for:
  - locked-screen voice cue playback
  - music ducking and restoration
  - distance update timing at 0.5 mi / 1 mi
  - run/walk transition announcements while locked
  - background GPS after screen lock, app backgrounding, and cold relaunch
  - Live Activity creation, update, pause/resume, completion, and dismissal recovery
  - HealthKit permissions and Apple Health write/import behavior

## Apple Capability Notes

Recommended Apple Developer portal cleanup before or during Build 50 provisioning:

- Main app should keep only capabilities the code uses, including HealthKit, App Groups, Background Modes for location and workout audio, and Bluetooth only if locked-screen BLE continuity is intentionally enabled.
- Live Activity extension should remain minimal: WidgetKit extension configuration and the shared App Group entitlement.
- Live Activity extension should not enable HealthKit, HealthKit Estimate Recalibration, Location Push Service Extension, Background GPU Access, Background Inference, commerce, WeatherKit, or unrelated services unless native extension code directly uses them.
