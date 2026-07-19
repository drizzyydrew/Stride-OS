# Build 42 Physical-Device Checklist

Date: 2026-07-19  
Build target: iOS build 42, app version 1.0.0

## Bottom navigation

- [ ] Exactly six tabs: Today, Calendar, Running, Strength, AI Coach, More.
- [ ] All six labels use the same size, weight, line height, and baseline.
- [ ] All six icons use the same visual scale and alignment.
- [ ] AI Coach remains readable as two words.
- [ ] No overlap, truncation, concatenation, blank tabs, or arrow-only tabs on the narrowest supported iPhone.
- [ ] Selected and unselected states are visually clear.

## Today weather and AQI

- [ ] Collapsed card shows temperature, condition, humidity, AQI value/category, location, and updated time.
- [ ] Collapsed card does not show the full AQI legend.
- [ ] Information and refresh controls have distinct locations and hit areas.
- [ ] Tapping the card or info action opens the AQI/weather education sheet.
- [ ] Refresh does not open the education sheet.
- [ ] AQI scale shows 0-50, 51-100, 101-150, 151-200, 201-300, and 301-500 categories.
- [ ] Current AQI marker matches the displayed provider value.
- [ ] AQI unavailable state is honest when provider data is missing.
- [ ] VoiceOver reads category/range labels without relying only on color.

## Today plan actions

- [ ] Each planned session card has one centered primary action.
- [ ] No redundant adjacent `Strength`, `View Activity`, or duplicate controls.
- [ ] Primary action opens the exact scheduledSessionId.
- [ ] Strength cards open the exact scheduled strength workout.
- [ ] Run/run-walk cards open the exact scheduled running workout.

## Calendar as schedule hub

- [ ] Calendar Month, Week, and Day render the same scheduled-session store.
- [ ] Tapping a scheduled session opens actions.
- [ ] Select for Today updates Today, Running Active, and Strength active selection.
- [ ] Perform Today for a future session requires confirmation.
- [ ] Remove from Today detaches active selection without deleting the planned session.
- [ ] Reschedule/skip/detail/AI Coach actions remain context-appropriate.
- [ ] Current-day sessions are not marked Missed before local day end.

## Running synchronization

- [ ] If Calendar shows today’s Run/Walk, Running Plan shows the same session.
- [ ] Running Active > Workout shows exact title, duration, warm-up, run interval, walk interval, rounds, cooldown, pace, HR, RPE, and purpose.
- [ ] Start Run uses the scheduledSessionId, not a generic run.
- [ ] Completion updates Calendar, Today, Activity, AI Coach context, and Live Activity state.

## Strength synchronization

- [ ] If Calendar shows today’s strength workout, Strength shows the same named workout.
- [ ] Strength screen does not say no session is scheduled when Calendar/Today show one.
- [ ] Detail shows duration, exercise count, purpose, sets, reps, load/RPE guidance, and alternatives.
- [ ] Start/resume/complete updates Calendar, Today, Activity, and Live Activity.

## Activity deletion

- [ ] Swipe left on a completed Activity reveals Delete.
- [ ] Long press opens activity actions including Delete.
- [ ] Delete requires confirmation with Cancel and Delete Activity.
- [ ] Cancel preserves the activity.
- [ ] Confirm removes only that completed Activity record.
- [ ] Load and analytics recalculate.
- [ ] Linked route trace is preserved unless it belongs exclusively to that deleted activity.
- [ ] Underlying scheduled-session history remains intact.

## Beginner periodization

- [ ] Couch-to-5K early weeks never show two primary running sessions on the same day.
- [ ] Run/Walk Intervals do not coexist with a separate primary Easy Aerobic Run on that day.
- [ ] Strength same-day sessions are clearly supporting when present.
- [ ] No Norwegian 4×4, threshold, VO2, or hard consecutive running appears in beginner foundation.
- [ ] Recovery and missed-session adaptations do not cram missed workouts into the week.

## AI Coach and voice context

- [ ] AI Coach receives exact active goal, date, session ID, run/walk ratio, HR/RPE, pace, strength workout, and adaptation notes.
- [ ] AI Coach does not show raw Markdown or emojis.
- [ ] Interval, HR, pace, hydration, fuel, and navigation cue toggles remain distinct.
- [ ] Simultaneous cues combine without overlapping speech.

## Movement Lab

- [ ] Marker editing allows meaningful repositioning across the full visible image area.
- [ ] Marker drag does not scroll the page or swipe parent navigation.
- [ ] Save, Cancel, and Reset to Detected behave correctly.
- [ ] Portrait and landscape coordinate persistence remain accurate.

## Live Activities

- [ ] Running, walking, hiking, cycling, skiing, snowboarding, Training Block strength, and Preset strength use one-tap pause/resume/complete behavior.
- [ ] Strength Live Activity keeps sets/reps/load readable.
- [ ] Dynamic Island compact/expanded/minimal and Lock Screen do not clip essential content.
