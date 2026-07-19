# Build 42 Completed Log

Date: 2026-07-19  
Build target: iOS Build 42  
App version: 1.0.0  
Branch: `build-19-v3-foundation`

## Starting state

- Starting HEAD: `af2090a docs: record Build 41 TestFlight submission`
- Starting worktree: clean.
- Latest consumed iOS build before this release: Build 41.
- Next unused build selected: Build 42.
- Canonical Build 42 release commit: `ea5cba96130c3799853afd055b200b3f5f45272b`

## Screenshots reviewed

Attached physical-device screenshots were reviewed for:

- Intake date input keyboard/format.
- PR finish-time controls.
- Activity seed-looking records.
- AI Coach keyboard spacing and Markdown display.
- Calendar generic strength and duplicate beginner run sessions.
- Running Plan / Calendar contradiction.
- Running Active incomplete prescription.
- Today generic action and weather/AQI presentation.
- Bottom-tab label/icon inconsistency.

## Defects fixed

- Bottom tabs now use uniform label/icon sizing and remain exactly six visible destinations.
- Today weather collapsed card is concise, with separate AQI information and refresh hit regions.
- Official U.S. AQI ranges and current-position scale were added to the expanded details.
- Today scheduled-session actions now render one centered primary action.
- Calendar, Today, Running Active, and Strength share scheduled-session selectors.
- Calendar session selection/removal is persisted separately from planned-session data.
- Running Active uses the active scheduled run/run-walk session and starts with `scheduledSessionId`.
- Strength uses scheduled week sessions for today/week alignment.
- Completed Activity records support confirmed swipe and long-press deletion.
- Beginner plans dedupe same-day primary running exposure.
- Norwegian 4×4 exists only as an advanced disabled-by-default template with eligibility gates.

## Architecture decisions

- Added `src/utils/aqi.ts` as the central AQI band/scale utility.
- Added `src/store/scheduledSessionSelectionStore.ts` to keep active selections non-destructive.
- Extended `src/utils/scheduledSessions.ts` with shared query selectors and active-today projection.
- Added `src/utils/activityDeletion.ts` as a pure deletion/recalculation helper.
- Added `src/utils/advancedIntervals.ts` for future high-intensity template eligibility without scheduling beginner intensity.

## Files changed

- Navigation and layout: `app/(tabs)/_layout.tsx`
- Today/weather/AQI: `app/(tabs)/dashboard/index.tsx`, `src/utils/aqi.ts`, `src/utils/weatherLogic.ts`
- Calendar/session selection: `app/(tabs)/calendar/index.tsx`, `src/hooks/useScheduledSessions.ts`, `src/store/scheduledSessionSelectionStore.ts`, `src/utils/scheduledSessions.ts`
- Running/Strength synchronization: `app/(tabs)/training/index.tsx`, `app/(tabs)/strength/index.tsx`, `src/store/activeRunStore.ts`
- Activity deletion: `app/(tabs)/activity/index.tsx`, `src/utils/activityDeletion.ts`
- Training evidence/advanced intervals: `src/utils/advancedIntervals.ts`, `docs/training-engine-periodization-review.md`
- QA/docs/tests: `scripts/tests/buildNextAdditionalCorrections.test.ts`, updated Build Next tests, screenshot QA docs, Build 42 checklist.

## Tests

- Added `scripts/tests/buildNextAdditionalCorrections.test.ts`.
- Updated existing Build Next, weather, and navigation tests for Build 42 contracts.
- Total automated tests: 209/209 passing.

## Validation

- `npm run typecheck`: passed.
- `npm run test`: passed, 209/209.
- `npm run expo:check`: passed.
- `git diff --check`: passed.
- `npx expo export --platform ios`: passed.
- `swiftc -parse targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift targets/StrideRunLiveActivity/StrideRunLiveActivity.swift`: passed.
- Visual rendering limitation: `simctl`, Chromium, Chrome, and Playwright were unavailable; source/test-backed screenshot QA completed and physical-device checks remain in `docs/build42-physical-device-checklist.md`.

## Native risks

- Live Activity one-tap behavior still requires Lock Screen/Dynamic Island confirmation on physical device.
- Weather/AQI card hit-target feel requires physical-device confirmation.
- Calendar action alerts, Activity swipe delete, GPS start, and voice cues require TestFlight device validation.

## Release

- EAS Build ID: `55c9996e-87a9-4df0-9a65-e42920af6fe7`
- EAS status: finished.
- IPA artifact: `https://expo.dev/artifacts/eas/2_uPD-XNxJBiY-GseB1SYDrzwlkxexFLwyplFOjZe7E.ipa`
- TestFlight / App Store Connect submission ID: `2bb6638f-ed5b-4767-a62f-4f46ea056590`
- Submission status: uploaded successfully to App Store Connect.
- App Store Connect state: Apple processing started; internal availability pending Apple processing.
- Export compliance: existing `ITSAppUsesNonExemptEncryption: false` metadata used; no unsupported legal declaration was added.

## Confidence

Release-readiness confidence: 96%.
