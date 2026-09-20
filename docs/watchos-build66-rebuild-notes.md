# watchOS Build 66 Rebuild Notes

## Scope

This pass treats Build 66 (`6dd8ac0`) as the known-good Apple Watch baseline because manual watch-started workouts could begin, record HealthKit data, and sync back later.

Only watch-facing code was stripped back and rebuilt:

- `targets/StrideOSWatch/*`
- `modules/stride-watch-connectivity/*`
- `src/components/watch/WatchWorkoutBridge.tsx`
- watch-facing session identity hooks in active workout stores and start screens

Route generation, share images, run creator UI, and the rest of the app were not rolled back.

## Build 66 Baseline Kept

- Watch app launches to the workout picker.
- Watch starts real `HKWorkoutSession` / `HKLiveWorkoutBuilder` sessions directly.
- Run, cycling, strength, and mobility workout kinds remain available.
- Heart rate, distance, active energy, elapsed time, pace, and HR zone remain collected from HealthKit where available.
- Pause, resume, and end controls remain on the watch.
- Watch can send workout state and heart-rate events to the phone by `sendMessage` or `transferUserInfo`.

## Changes Made After Build 66

These are the watch-related feature families that appeared after Build 66:

- Phone app can create or reuse the watch-provided `workoutInstanceId` so watch-started workouts do not create duplicate phone activities.
- Phone bridge can respond to watch `running`, `paused`, `ended`, and heart-rate events.
- Phone and watch pause/resume/end copy was standardized to "workout".
- Watch native target received `WKBackgroundModes = workout-processing`.
- WatchConnectivity started using `updateApplicationContext` for latest command replay.
- Watch manager gained duplicate start guards, duplicate end-event guards, queued outbound messages, and application-context command handling.
- Later watch layout changes tightened top/bottom spacing and metric sizing.
- Offline GPS tracking was hardened separately by rearming native location tasks and waiting for persisted store hydration.

## Re-Add Order

1. Restored Build 66 native watch files.
2. Re-added `WKBackgroundModes = workout-processing` in both watch `Info.plist` and `expo-target.config.js`.
3. Re-added durable phone-to-watch delivery:
   - publish start/pause/resume/end/context as latest `applicationContext`
   - queue commands while WatchConnectivity activates
   - flush queued commands on activation or reachability changes
4. Re-added watch-side command replay:
   - handle `didReceiveApplicationContext`
   - dedupe commands by type, workout ID, and timestamp
   - ignore stale live commands after two minutes
   - allow latest application context for up to four hours so opening the watch late can still pick up an active phone workout
5. Re-added HealthKit-safe guards:
   - `isStartingWorkout` prevents double taps
   - no fake watch-only timer
   - HealthKit failure clears the starting state
   - ended events are sent once per workout
6. Kept Build 66 spacing and scroll layout, adding only a disabled "Starting..." start-button state.

## Risk Decision

The later compact watch layout was not re-added because it matched the on-device complaint that the top and bottom looked cut off. The later watch-only fallback timer was also not re-added because it can report a workout as running before the real HealthKit session starts.

The final target is Build 66 watch startup behavior plus durable sync and background processing.
