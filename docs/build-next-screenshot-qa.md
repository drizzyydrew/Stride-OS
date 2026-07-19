# Build Next Screenshot QA

Date: 2026-07-19  
Method: attached physical-device screenshots reviewed directly; implementation verified by source inspection and deterministic regression tests. No iOS Simulator screenshot evidence is claimed in this pass.

## Screenshot-driven findings and status

- Bottom tabs: exactly six visible destinations remain. Tab labels and icons now share one uniform font size, font weight, line height, baseline contract, and icon scale.
- Today weather: collapsed card is concise; AQI value/category are shown without the full legend; information and refresh controls are separate 44-point-class hit regions.
- AQI education: expanded sheet shows official U.S. AQI ranges, current value/position, non-color labels, VoiceOver labels, and conservative training guidance.
- Today plan actions: scheduled-session cards use one centered primary action and no adjacent duplicate “Strength”/generic Activity button.
- Calendar schedule authority: Calendar renders the authoritative scheduled-session store; Today, Running Active, Strength, AI Coach, voice coaching, and Live Activity contracts resolve the same scheduledSessionId.
- Calendar selection/unselection: Calendar cards expose non-destructive active selection/removal behavior through persisted selection state.
- Running Active: Workout mode uses today’s active scheduled run/run-walk session and displays warm-up, run/walk intervals, rounds, cooldown, HR/RPE, pace guidance, purpose, and scheduledSessionId.
- Strength: scheduled strength sessions are read through the shared schedule hook and remain aligned with Today and Calendar.
- Activity: completed records support confirmed swipe and long-press deletion with load recalculation and preservation of unrelated schedule/route/workout data.
- Beginner periodization: duplicate primary beginner run exposures are deduped; Norwegian 4×4 remains advanced-only and automatic scheduling is disabled.
- Periodization evidence: `docs/training-engine-periodization-review.md` documents translated engine rules and evidence limitations.

## Validation evidence

- `npm run typecheck`: passed.
- `npm run test`: 209/209 passed.
- `npm run expo:check`: passed.
- `git diff --check`: passed.
- `npx expo export --platform ios`: passed.
- `swiftc -parse targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift targets/StrideRunLiveActivity/StrideRunLiveActivity.swift`: passed.
- Visual rendering availability: `xcrun simctl` unavailable; `chromium-cli`, `chromium`, `google-chrome`, and `playwright` unavailable.

## Remaining physical-device-only checks

- Exact narrow-device bottom-tab visual spacing.
- Weather card hit-target feel and expanded AQI sheet scroll behavior.
- Calendar action alerts and active selection across app restarts.
- Activity swipe gesture feel and confirmation flow.
- Running GPS start, voice prompts, and Live Activity synchronization.
- Strength Live Activity control behavior on Lock Screen/Dynamic Island.
