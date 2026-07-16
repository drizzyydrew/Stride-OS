# Build 37 Physical-Device Checklist

Use a small-screen iPhone and one current larger iPhone. Test light/dark appearance, standard and large Dynamic Type, VoiceOver spot checks, screen lock, and background interruptions.

## Camera and media

- [ ] Open Movement Lab camera; confirm front-facing live preview appears before any countdown.
- [ ] Flip front → rear → front → rear; confirm photo/video controls recover after every ready event.
- [ ] Confirm flip is disabled during countdown and recording.
- [ ] Record video, take photo, retake, use media, cancel, and reopen without stale review media.
- [ ] Confirm five-second countdown and movement-specific automatic stop.
- [ ] Background and foreground during setup, countdown, and recording; confirm safe recovery and no duplicate capture promise.
- [ ] Lock/unlock the phone and simulate an incoming call; confirm no stale controls or accepted discarded media.
- [ ] Import yesterday’s video, an older video, a video with missing creation metadata, and an iCloud-offloaded video.
- [ ] Confirm loading, retry, stable staging, invalid-media, missing-file, and unreadable-file states are specific.

## Movement Lab

- [ ] Deep squat: hip flexion rises with depth and displays `Hip Flexion … Estimated`.
- [ ] Running gait extension frame: display `Hip Extension … Estimated`, never negative hip flexion.
- [ ] Mirror a lateral capture; confirm anatomical left/right remains correct.
- [ ] Confirm lateral overlay is one closest-side shoulder/hip/knee/ankle chain with no far limb.
- [ ] Confirm frontal/posterior overlay is bilateral and contains only supported frontal-plane measurements.
- [ ] Drag the entire scrubber and charts; video pauses, time/angles/cursor update continuously, and the page does not move.
- [ ] Enter Adjust Markers; confirm video and parent navigation are locked and only relevant markers are editable.
- [ ] Verify Cancel restores saved points, Reset restores auto points while staying in edit mode, and Save recalculates and persists.

## AI Coach

- [ ] Ask `What is mobility?`; confirm no 5,000-character error.
- [ ] Open Coach from a Movement Lab analysis; verify view, closest side, confidence, corrections, limitations, and visible findings match the screen.
- [ ] Open Coach from an active Training Block workout, Preset workout, Running plan, and Hydration plan; verify focused context and current question.

## Routes and running

- [ ] Create a route; type and edit the name with the keyboard open. Confirm cursor/text contrast and reachable Save.
- [ ] Leave the name blank and confirm the intentional `Custom Route` result.
- [ ] Open the visible route actions sheet from Next Segment.
- [ ] Reverse the attached route and confirm the saved route geometry is unchanged.
- [ ] Remove From Today’s Run; confirm polyline, markers, next segment, progress, and guidance clear while GPS/free-run continues.
- [ ] Reattach the saved route later.
- [ ] Select a custom run for today, choose Not Today, restart the app, and confirm scheduled run restoration without deleting workout/route/log/plan.
- [ ] Reselect the custom run and confirm no duplicate or silently completed log.

## Hydration and fuel

- [ ] Enter distance to 0.01 mi and duration to one minute using both picker and manual input; leave and return to confirm persistence.
- [ ] Calculate sweat rate with pre/post weight, fluid consumed, duration, and urine output; verify units and formula.
- [ ] Review Sweatiness info and confirm it is clearly subjective and separate from measured sweat rate.
- [ ] Set known carbohydrate tolerance, category, unknown, and progression target; confirm established tolerance is not exceeded silently.
- [ ] Toggle current-location weather, manually edit temperature/humidity, and restore Use Current Location without snap-back while typing.
- [ ] Set hydration and fuel reminder wheels independently across 5–60 minutes.
- [ ] Verify approximate per-cue fluid and carbohydrate amounts and estimated cue counts.
- [ ] Hear hydration-only, fuel-only, and combined voice cues; confirm visual alternatives.
- [ ] Pause/resume around cue time and confirm no duplicate or overlapping speech.
- [ ] Confirm fluid uses oz/hr or L/hr, carbohydrate g/hr, sodium intake mg/hr, and concentration mg/L.

## Strength

- [ ] Open preset detail; inspect purpose, duration, equipment, frequency, Why This Workout, technique, stop/modify, and easier alternatives.
- [ ] Start a Preset Workout; complete exercises with RPE/load, pause, leave, relaunch, and resume at the same exercise/time.
- [ ] Finish and save; confirm completion feedback, volume summary, and strength history source/preset ID.
- [ ] Start/continue a Training Block Workout independently.
- [ ] With one source active, try the other; confirm Continue Current, End and Start Other, and Cancel choices—never silent termination.
- [ ] Confirm the active source alone owns the Strength Live Activity and payload updates on start/change/pause/resume/finish.

## Notifications

- [ ] Confirm Morning Reminder is absent from Today and present under More → Settings → Notifications.
- [ ] Enable daily default, change time, select weekdays, select custom days, disable, and re-enable.
- [ ] Relaunch after each schedule change; confirm persistence and no duplicate notifications.
- [ ] Deny notification permission; confirm clear state and working iOS Settings link.
- [ ] Upgrade a legacy fixed-5:00-AM state and confirm one migrated schedule only.
