# Build 43 Screenshot and Visual QA

Date: 2026-07-22  
Build target: iOS Build 43  
Renderer availability: no local iOS Simulator (`simctl` unavailable) and no Chromium/Playwright renderer available in this environment.

## Method

- Reviewed the supplied physical-device screenshots from the Build 42 stabilization cycle as regression evidence.
- Performed source-backed visual QA against the affected screens and shared contracts.
- Added deterministic tests where rendering was unavailable.
- Deferred final tactile validation to internal TestFlight using `docs/build43-physical-device-checklist.md`.

## Findings and final status

| Area | Defect risk reviewed | Correction | Validation |
|---|---|---|---|
| Calendar action sheet | Calendar could act as a reduced schedule surface without completion actions. | Added context-aware View Details, Start Workout, Mark Completed, Log Manually, completed Activity review/edit/compare, and AI Coach actions. | `scheduledCompletionManualActivity.test.ts`, source review. |
| Manual Activity | Add Activity omitted running and strength completion as first-class quick entries. | Added running, treadmill, run/walk, walking, strength, cycling, skiing, snowboarding, mobility, HIIT/mixed, and other options with human labels. | `scheduledCompletionManualActivity.test.ts`. |
| Live pace/speed | Manual entry needed live pace/speed without malformed values. | Added shared pace/speed calculator with safe invalid handling and unit support. | `scheduledCompletionManualActivity.test.ts`. |
| Planned vs actual | Completed activity could overwrite or obscure prescribed workout data. | Added planned-vs-completed utility and comparison screen; planned data stays separate from actual Activity data. | `scheduledCompletionManualActivity.test.ts`. |
| Cross-screen completion state | Manual completion could fail to update Calendar/Today/Running/Strength consistently. | Activity records now overlay scheduled sessions via the shared selector hook. | `useScheduledSessions` source review and tests. |
| Duplicate completion | Repeated save could create duplicate completed Activities for one scheduled workout. | Activity store now upserts by `scheduledSessionId`. | `scheduledCompletionManualActivity.test.ts`. |
| Strength completion | Strength finish wrote strength history but not unified Activity history. | Training Block strength finish now writes a linked Activity record. | Source review and tests. |
| Weather attribution | Expanded weather/AQI view needed actual provider attribution. | Added Open-Meteo weather and Open-Meteo Air Quality API provider fields and UI attribution. | `scheduledCompletionManualActivity.test.ts`, `weatherLogic.test.ts`. |
| Bottom navigation and prior screenshots | Previously fixed uniform tabs, AQI card, Today action, Activity empty state, beginner dedupe, and Movement Lab marker drag could regress. | No related files were changed except Today weather attribution and Today linked-action handling; existing regression tests remain green. | Full test suite 219/219. |

## Remaining physical-device-only risk

- Calendar Alert action ordering and long lists need iPhone confirmation.
- Keyboard behavior in the expanded manual completion form needs device confirmation.
- Swipe/long-press Activity deletion remains device-gesture-sensitive.
- Live Activity one-tap controls remain native Lock Screen/Dynamic Island validation items.
- Weather/AQI attribution links are displayed as text; tap-through provider links were not added in this patch.
