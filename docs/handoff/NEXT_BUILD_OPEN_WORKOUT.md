# Next build — Open / Other workout

Local addition after delivered Build 122. Activity > Track Workout > Open / Other starts a workout with no duration, distance or prescribed-exercise target. Time excludes pauses, Pause/Resume and Finish use the existing retained recording identity, and completion goes to unified history as Other / completed other activity. It does not claim that a linked prescribed run was performed.

No location permission, background GPS task, route attachment, Run/Walk intervals, speed/pace or elevation is used. Cold-session GPS resumption and location ingestion reject Other. Open completion does not stop a GPS task. Real heart-rate observations can come from the existing sensor/Watch path; missing heart rate remains unavailable. No calories, distance or power are invented.

The Watch kind maps to HealthKit Other, with unknown location type and no route/distance collection. Newer Watch capability negotiation is required; an older Watch app cannot silently start a running workout instead. Open uses the existing prepared-start identity protocol. Watch state/End, account fencing, retry journal, durable save and Live navigation reuse existing recording paths. A retained phone session can continue without a reachable Watch.

The live phone screen and native Lock Screen/Dynamic Island retain time, available heart rate and controls, omitting map/distance/pace panels. Existing transparent branding assets are unchanged. Recorded Other workouts do not become an outdoor sport for route analysis or running achievements.

Validation passed: 205 tests in 17 files with no failures/skips, canonical project typecheck, Swift syntax parse and actual extracted Watch-kind typecheck against Apple HealthKit. Evidence is recorded in NEXT_BUILD_OPEN_WORKOUT_VERIFICATION.json. Source/UI fixture checks and an extracted Watch-kind typecheck are separate from a complete signed native archive and physical-device acceptance. The native Watch/Live Activity changes require a subsequent binary; delivered 122 is unchanged. No new build, OTA, TestFlight upload, public App Review, image edit or backend policy change was performed for this addition.

Later device acceptance: update both phone/Watch apps; start Open / Other with location disabled, pause/resume, navigate away and return via Live, close/reopen, then finish and inspect Other history. Verify Watch heart rate and controls when available, and phone-only recording when unavailable. No hard workout or subscription purchase is needed.

Reference: Apple HKWorkoutActivityType.other (https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype/other). Expo version-pinned SDK 56 and 57 index/UI guidance was read before editing. The current native recording architecture requires custom modules rather than Expo Go.
