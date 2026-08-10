# watchOS Follow-up Plan

Build 57 should not ship a full watchOS companion app. It should preserve architecture for a later watchOS phase.

## Strategy

- Keep StrideOS as the canonical source for TrainingBlock, Phase, Week, ScheduledSession, workout structure, and CompletedActivity identity.
- Use a stable `workoutInstanceId` for every active session so phone-started, watch-started, HealthKit-imported, and Live Activity state can reconcile to one completed record.
- Treat WorkoutKit as an optional adapter for compatible structured running or cycling workouts, not as the source of truth.
- Use WatchConnectivity later for workout-state mirroring, selected workout sync, pause/resume/end commands, and offline result transfer.
- Treat HealthKit workout ownership explicitly. If Apple Watch records the workout, import and reconcile by HealthKit UUID, source bundle, time window, activity type, duration, and distance.
- Do not assume real-time Apple Watch heart-rate streaming to the phone. Prefer a future watch app for live HR capture, BLE HR straps for phone workouts, and HealthKit summaries for post-workout import where real-time access is not available.

## Future Work

- Phone-started workout mirroring to watch.
- Watch-started workout reconciliation back to ScheduledSession.
- Offline watch session queue with conflict resolution.
- WorkoutKit export status per ScheduledSession.
- Live Activity updates that reflect watch-owned pause/resume/end state after reconciliation.
- HealthKit route import for workouts that expose accessible HKWorkoutRoute samples and user authorization.

## Non-goals For Build 57

- No full watchOS app.
- No fake live Apple Watch HR streaming.
- No second workout data model.
- No duplicate CompletedActivity records for the same real-world workout.
