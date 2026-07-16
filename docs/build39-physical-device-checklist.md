# Build 39 Physical-Device TestFlight Checklist

## Bottom navigation

- Exactly six tabs: Today, Calendar, Running, Strength, AI Coach, More.
- No arrows, blank labels, mystery routes, overlap, or concatenated labels.
- Verify the narrowest supported iPhone and enlarged text.
- Open and leave Running, Strength, More, Activity, Profile, and detail screens;
  confirm tab state stays stable.

## Activity

- Open the Activity root and change every filter.
- Open a current activity, migrated legacy run, strength activity, and
  cross-training activity.
- Cold-launch and immediately open a legacy activity while stores hydrate.
- Open a missing or invalid deep link and verify the designed recovery actions.
- Confirm Back to Activity and Return to Today.

## Hydration

- Confirm “Known sweat sodium concentration” wraps only at word boundaries.
- Confirm the explanation receives full card width.
- Confirm minus, value with mg/L, and plus stack below the copy on a narrow
  screen and at large Dynamic Type.
- Scroll to Reset Planner Inputs; confirm no excessive dead space or tab-bar
  coverage.

## Training Preferences

- Verify shared-header spacing, two-line title behavior, and 44-point back target.
- Open the Frequency wheel; test Cancel and Confirm for 1x, 2x, 3x, and 4x per
  week.
- Relaunch and confirm persistence and future programming output.
- Verify VoiceOver announcements and sheet safe-area spacing.

## Preset Training Plans

- Verify eyebrow, back navigation, serif title, safe-area headspace, and narrow
  screen wrapping.

## Strength Preset

- Verify Warm-Up spacing and separation before Exercise-by-Exercise Flow.
- Confirm equipment uses readable labels such as Squat rack and Bodyweight.
- Confirm Load, RPE, Complete Exercise, and final controls remain above the tab
  bar and keyboard.
- Leave and return; confirm resume/cancel state.

## Live Activity

- Preset: one-tap pause, pending state, paused state, resume, and complete.
- Training Block: repeat the same flow and confirm Preset state is not mutated.
- Running regression: pause, resume, complete, background, and relaunch.
- Rapidly repeat taps and confirm duplicate/conflicting transitions are ignored.
- Confirm stale ActivityKit ID recovery after app termination/relaunch.
- Confirm outdoor payloads for walking, run/walk, hiking, cycling, downhill
  skiing, cross-country skiing, and snowboarding.
- Confirm applicable pace versus speed, heart rate, elevation/descent, interval,
  and navigation content without irrelevant metrics.
- Confirm Strength current exercise, sets x reps, load, progress, elapsed time,
  and next exercise.
- Inspect Lock Screen, compact/minimal/expanded Dynamic Island, narrow devices,
  and StandBy where available.

## More

- Confirm no Running or Strength duplicate.
- Open Activity, Movement Lab, Analytics, Adaptive Performance, Profile, and
  Settings.

## Bike Fit

- Confirm the image fills the intended card width at its natural 4:3 ratio.
- Confirm no black letterboxing or narrow portrait column.
- Confirm Dion, full bicycle, head, hands, hips, knees, ankles, feet, crank,
  pedals, and wheels remain visible in direct lateral view.
- Confirm camera guidance and Must Be Visible chips appear beneath the image.
- Open capture/import and verify controls.

## Inherited stabilization

- Camera front/rear switching, countdown, capture, review, mirroring, and cancel.
- Older/iCloud media import, scrubber ownership, locked marker editing.
- Side-chain filtering, hip flexion/extension, saved analysis, and Coach handoff.
- Route naming, route detach/reattach, directions, and free-run fallback.
- Hydration/fuel voice intervals and pause/resume deduplication.
- Morning reminder scheduling and permission recovery.
