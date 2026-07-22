# Build 43 Completed Log

Date: 2026-07-22  
Build target: iOS Build 43  
App version: 1.0.0  
Branch: `build-19-v3-foundation`

## Starting state

- Starting HEAD: `1f76782 docs: record Build 42 TestFlight submission`
- Starting worktree: clean.
- Latest consumed iOS build before this release: Build 42.
- Next unused build selected: Build 43.
- Latest released iOS build before this release: Build 42 (`55c9996e-87a9-4df0-9a65-e42920af6fe7`).

## Defects fixed

- Calendar scheduled-session actions now expose completion, manual logging, linked Activity review/edit, planned-vs-completed comparison, and AI Coach handoff.
- Manual Activity logging now includes Running, Treadmill, Run/Walk, Walking, Strength Training, outdoor/indoor cycling, hiking, swimming, skiing, snowboarding, mobility, HIIT/mixed, and other.
- Scheduled run/run-walk and strength sessions prefill completion forms from the prescribed scheduledSessionId.
- Completed Activity records link back to scheduled sessions through `scheduledSessionId`.
- Repeated completion saves are idempotent and update the linked Activity instead of creating duplicates.
- Planned prescriptions remain separate from actual completed data.
- Running Active and Strength screens now expose linked completion actions.
- Strength Training Block completion writes unified Activity history in addition to established strength history.
- Today opens linked completed Activity records when the primary session has already been completed.
- AI Coach receives compact planned-vs-completed context for linked sessions.
- Weather/AQI expanded details now show the actual configured providers and update time.
- Optional saved-route attachment is available for outdoor manual logs without requiring GPS or fabricating indoor route data.

## Architecture decisions

- Added `src/utils/activityCompletion.ts` as the shared scheduled-session completion, planned-vs-actual, and live pace/speed utility layer.
- Extended scheduled-session projection with `partial`, `completedActivityId`, and completion state metadata.
- Kept Activity as the durable local-first completion record and derived scheduled-session status from Activity records through `useScheduledSessions`.
- Preserved legacy strength/run history systems while writing unified Activity records for new linked completions.
- Kept route ownership non-destructive: manual logs attach saved route IDs and route coordinates without deleting shared saved routes.

## Files changed

- Activity completion and manual logging: `app/(tabs)/activity/manual.tsx`, `app/(tabs)/activity/[activityId].tsx`, `app/(tabs)/activity/compare.tsx`, `app/(tabs)/activity/_layout.tsx`, `src/utils/activityCompletion.ts`, `src/store/activityStore.ts`
- Calendar schedule hub: `app/(tabs)/calendar/index.tsx`, `src/utils/calendarEngine.ts`, `src/utils/scheduledSessions.ts`, `src/hooks/useScheduledSessions.ts`
- Today, Running, Strength, AI Coach: `app/(tabs)/dashboard/index.tsx`, `app/(tabs)/training/index.tsx`, `app/(tabs)/strength/index.tsx`, `app/(tabs)/coach/index.tsx`
- Weather attribution: `src/lib/weather.ts`, `src/utils/weatherLogic.ts`
- Tests/docs/release config: `scripts/tests/scheduledCompletionManualActivity.test.ts`, `docs/build43-physical-device-checklist.md`, `docs/build43-screenshot-qa.md`, `docs/build43-completed-log.md`, `app.json`

## Tests

- Added `scripts/tests/scheduledCompletionManualActivity.test.ts`.
- New coverage includes scheduled run/walk prefill, scheduled strength prefill, linked completion overlay, planned-vs-completed comparison, live pace/speed calculations, manual Activity options, Calendar completion actions, Activity-store duplicate prevention, cross-screen completion paths, and Open-Meteo attribution.
- Total automated tests before release commit: 219/219 passing.

## Validation

- `npm run typecheck`: passed.
- `npm run test`: passed, 219/219.
- `npm run expo:check`: passed.
- `git diff --check`: passed.
- `npx expo export --platform ios`: passed.
- `swiftc -parse targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift targets/StrideRunLiveActivity/StrideRunLiveActivity.swift`: passed.
- Visual rendering limitation: local `simctl`, Chromium, Google Chrome, and Playwright were unavailable; source/test-backed screenshot QA is documented in `docs/build43-screenshot-qa.md`.

## Native and device-only risks

- Manual completion keyboard behavior, Calendar Alert action ordering, Activity swipe/long-press deletion, route attachment feel, and Live Activity Lock Screen controls require internal TestFlight device validation.
- Weather/AQI provider attribution is shown as text; tap-through provider links were not added in this pass.

## Release

- Release commit: recorded in final release report after commit.
- EAS Build ID: recorded in final release report after Build 43 finishes.
- IPA artifact: recorded in final release report after Build 43 finishes.
- TestFlight / App Store Connect submission ID: recorded in final release report after submission.
- App Store Connect state: recorded in final release report after submission.
- Export compliance: existing `ITSAppUsesNonExemptEncryption: false` metadata remains in `app.json`; no unsupported legal declaration was added.

## Confidence

Pre-build release-readiness confidence: 96%.
