# Build 57 Implementation Notes

Authoritative baseline: Build 56, app version 1.0.0, iOS build number 56, commit `2b0eae9f01e6e9ec0909558e1ab52e3101f20e32`.

Build 57 keeps the Build 56 Live Activity native payload contract intact. The physical TestFlight result for Build 56 showed Live Activities appearing again after the Build 54/55 expanded native ActivityKit content-state payload was reverted. New activity intelligence features should not widen the Swift `ContentState` schema unless the extension, app bridge, tests, and physical-device validation are updated together.

## Official Documentation Conclusions

- Expo SDK 56 targets React Native 0.85, React 19.2.3, iOS 16.4+, and Xcode 26.4+. Build 57 stays on SDK 56 and uses Continuous Native Generation for generated iOS verification.
- Expo CNG guidance keeps native project changes expressed through app config, config plugins, local modules, and generated-target validation instead of long-lived manual edits to generated iOS output.
- Expo Location background tracking requires explicit iOS background configuration and user-facing Always/background permission copy. The current config keeps `UIBackgroundModes` with `location` and `audio`, plus the Expo Location plugin with iOS background location enabled.
- ActivityKit local Live Activities do not require push notifications for locally started, locally updated workout state. Push-to-update should only be added if StrideOS later needs remote update control.
- HealthKit workout import should remain least-privilege: read compatible workout data and related summaries that StrideOS actually imports, dedupe by stable HealthKit metadata, and tolerate denial without breaking the app.
- WorkoutKit is useful as an optional interoperability adapter for sending supported structured workouts to the Apple Watch Workout app. It should not replace the canonical StrideOS ScheduledSession and CompletedActivity models.
- Core Location background workout tracking remains an iOS-permission and lifecycle concern. StrideOS can configure background updates and persist route samples, but physical locked-screen tracking reliability still requires device testing.

Sources reviewed:
- Expo SDK 56 docs: https://docs.expo.dev/versions/v56.0.0/
- Expo CNG docs: https://docs.expo.dev/workflow/continuous-native-generation/
- EAS Build docs: https://docs.expo.dev/build/introduction/
- EAS Submit docs: https://docs.expo.dev/deploy/submit-to-app-stores/
- Expo Location SDK 56 docs: https://docs.expo.dev/versions/v56.0.0/sdk/location/
- Apple ActivityKit docs: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- Apple WidgetKit ActivityConfiguration docs: https://developer.apple.com/documentation/widgetkit/activityconfiguration
- Apple HealthKit workout route docs: https://developer.apple.com/documentation/healthkit/hkworkoutroute
- Apple Core Location background updates docs: https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background
- Apple WorkoutKit docs: https://developer.apple.com/documentation/workoutkit/

## Build 57 Scope Implemented In Source

- Activity Detail now uses a centralized unit-aware summary builder and conditionally surfaces any supported stored metrics without inventing missing values.
- Activity sharing now has privacy-safe default text through the native share sheet. Notes, symptoms, exact route coordinates, shoe photos, and private health detail are excluded by default.
- Achievement architecture now includes deterministic derived models for Healthy Progress, personal records, monthly distance milestones, consistency, challenges, and Stride Levels.
- Achievement Hub is accessible from More and uses original StrideOS chevron/path language instead of third-party badge systems.
- Planned workout detail now has a bottom START WORKOUT action that selects the scheduled session for today and routes into the existing canonical workout workflow.
- Structured workout service now supports segment kinds, time and distance targets, repeat groups, reorder, duplicate, total time/distance estimates, and voice cue timing.

## Live Activity Gate

Build 57 must preserve:
- main bundle `com.mooremovement.strideos`
- extension bundle `com.mooremovement.strideos.liveactivity`
- App Group `group.com.mooremovement.strideos`
- `NSSupportsLiveActivities`
- extension inclusion in generated iOS targets
- Build 56 native `ContentState` compatibility

Do not treat TypeScript tests as proof of physical Lock Screen or Dynamic Island behavior. Final proof still requires TestFlight device testing after the production Build 57 artifact is submitted and processed.
