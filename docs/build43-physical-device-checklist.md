# Build 43 Physical-Device Checklist

Date: 2026-07-22  
Build target: iOS build 43, app version 1.0.0

## Scheduled workout completion

- [ ] From Calendar Day view, tap a scheduled run and confirm the action sheet includes View Details, Start Workout, Mark Completed, Log Manually, selection/removal actions, and Discuss with AI Coach.
- [ ] Mark Completed opens the Activity completion form with the exact scheduledSessionId.
- [ ] Run/Walk completion form preloads title, total time, warm-up, run interval, walk interval, rounds, cooldown, HR, RPE, and pace guidance.
- [ ] Strength completion form preloads the scheduled workout name and prescribed exercise list.
- [ ] Saving a completion creates one linked Activity.
- [ ] Pressing completion again opens or updates the existing linked Activity instead of creating a duplicate.
- [ ] Planned prescription remains visible and unchanged after actual results are saved.
- [ ] Partial or stopped-early completion appears as partial where shown.

## Manual Add Activity

- [ ] Add Activity includes Running, Treadmill, Run/Walk, Walking, Strength Training, Outdoor Cycling, Indoor Cycling, Hiking, Swimming, Cross-Country Skiing, Downhill Skiing, Snowboarding, Mobility, HIIT / Mixed Conditioning, and Other.
- [ ] Running/walking/hiking pace updates live when duration or distance changes.
- [ ] Cycling/skiing/snowboarding speed updates live when duration or distance changes.
- [ ] Invalid or incomplete duration/distance never shows NaN or Infinity.
- [ ] Miles and kilometers can be selected.
- [ ] Outdoor logs can save without a route.
- [ ] Outdoor logs can attach an existing saved route.
- [ ] Treadmill and indoor activities do not require or fabricate GPS.
- [ ] Keyboard remains visible/safe for all manual fields.

## Cross-screen synchronization

- [ ] Calendar marks a completed scheduled run as completed or partially completed immediately.
- [ ] Today primary action changes to the linked completed Activity where applicable.
- [ ] Running Plan/Active no longer contradict Calendar for the same date.
- [ ] Running Active > Workout starts the exact scheduledSessionId when not completed.
- [ ] Strength shows today’s scheduled strength workout when Calendar shows one.
- [ ] Strength completion writes unified Activity history as well as strength history.
- [ ] Activity history shows the actual completed record.
- [ ] Activity detail Edit opens the existing record for correction.
- [ ] Deleting the Activity removes the completion link effect without deleting the planned scheduled session.
- [ ] Load and analytics recalculate after edit/delete.

## Planned vs completed and AI Coach

- [ ] Calendar completed-session actions include View Completed Activity, Edit Activity, Compare Planned vs. Completed, and Discuss with AI Coach.
- [ ] Compare Planned vs. Completed shows planned duration, intervals/targets, actual duration, actual distance, RPE, and completion status.
- [ ] AI Coach answers with exact planned and completed session context when asked about today’s workout or a linked completion.
- [ ] AI Coach still stays under the 5,000-character prompt ceiling.

## Weather and AQI attribution

- [ ] Today collapsed weather remains concise.
- [ ] Information and refresh controls remain separate.
- [ ] Expanded Weather/AQI sheet shows official U.S. AQI bands and current marker.
- [ ] Expanded sheet shows actual weather provider and actual AQI provider.
- [ ] Last-updated time is present when fetched data exists.
- [ ] AQI unavailable state does not invent data.

## Existing regression checks

- [ ] Bottom navigation remains exactly six uniform tabs.
- [ ] Today, Calendar, Running, Strength, AI Coach, and More tab labels/icons remain aligned.
- [ ] Beginner plans do not schedule two primary running sessions on one day.
- [ ] No Run/Walk plus separate primary Easy Run occurs on one beginner day.
- [ ] Activity fresh install has no fake completed history.
- [ ] Movement Lab marker drag can move across the visible image without parent scroll.
- [ ] Live Activities still pause/resume/complete running, outdoor activity, Training Block strength, and preset strength from the Lock Screen.
