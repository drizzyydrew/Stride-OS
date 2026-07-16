# Build 38 Live Activity Layout Specification

Authority: Apple ActivityKit, WidgetKit, SwiftUI, and App Intents. Live Activity
content state stays well below ActivityKit's 4 KB encoded-data limit. Layouts
adapt to the system-provided region rather than assuming one universal widget
width or height.

## Content priority

1. Activity identity and elapsed time.
2. Distance plus the activity-appropriate pace or speed.
3. Current run/walk interval or navigation instruction.
4. Heart rate when available.
5. Pause/resume and intentional completion.
6. Hydration/fuel cue context when space permits.

Running, walking, run/walk, and hiking use pace. Cycling and skiing use speed.
Strength prioritizes the exercise name, sets/reps or hold prescription, load,
elapsed time, and progress.

## Lock Screen

- Horizontal safe padding: 14 pt; vertical safe padding: 10–12 pt.
- Header: one line, 12–14 pt semibold, truncates the activity name before
  removing primary metrics.
- Metrics: one row, maximum four cells. Values use 20–22 pt rounded heavy type,
  one line, `minimumScaleFactor` no lower than 0.62.
- Guidance: one line at 11 pt semibold. Navigation outranks interval context;
  interval context outranks hydration/fuel cue text.
- Primary control: minimum 38 pt visual height with the system-provided Live
  Activity interaction area. Completion is visually separated and destructive.
- Pending state replaces controls with progress plus Pausing, Resuming, or
  Finishing. Repeated taps are ignored while the shared command is pending.
- Dynamic Type: primary values scale down before truncation; prose is limited to
  one line so enlarged type does not hide controls.
- VoiceOver: metrics, guidance, and pending state have explicit descriptive
  labels. Visual cues remain present when voice coaching is disabled.

## Dynamic Island

### Compact leading

- Activity-specific SF Symbol plus elapsed time.
- One line, caption weight; activity color remains distinguishable from paused
  color.

### Compact trailing

- Distance only, one decimal place, one line.
- Never duplicates pace/speed in the constrained trailing region.

### Minimal

- Activity-specific SF Symbol; paused state uses the pause symbol.
- No essential instruction is placed only in minimal presentation.

### Expanded leading

- Elapsed time or current exercise, maximum one line.

### Expanded trailing

- Distance for outdoor activity.
- Strength shows readable progress and load; the load is not compressed into
  an ambiguous secondary glyph.

### Expanded center

- Reserved. No essential state depends on this region because system
  presentation varies by device and concurrent Live Activities.

### Expanded bottom

- One navigation/interval/cue line followed by pace/speed, HR zone, and
  controls.
- Controls show a progress indicator while an App Intent command is pending.
- Text remains one line and truncates at the tail.

## Narrow devices, StandBy, and other system presentations

- All metric groups use flexible widths, line limits, and scale factors.
- Essential values maintain internal padding and never sit directly on the
  activity border.
- StandBy, Apple Watch Smart Stack, Mac menu bar, and CarPlay presentation are
  system-selected derivatives. No action is assumed available in CarPlay.
- Lock Screen, every Dynamic Island presentation, StandBy, and enlarged text
  remain physical-device validation items.

## Control contract

- App Intent writes one command ID to the App Group and immediately publishes
  an optimistic pending state.
- A pending command blocks duplicate and conflicting taps for 15 seconds.
- JavaScript consumes each command ID once, applies the authoritative workout
  transition, clears the command, and publishes the resulting ready state.
- Current ActivityKit IDs persist in the App Group so a restarted app process
  does not update an unrelated stale activity.
- Completion no longer ends the Live Activity inside the widget process before
  the app has saved the workout. The app ends it after the save transition.

## Route guidance contract

- Native MapKit supplies walking or cycling geometry and route steps when
  available.
- The small MapKit bridge is colocated in the existing Stride native activity
  module for Build 38 so it shares the current Expo native-module lifecycle and
  does not introduce another signing target. Routing types and progress logic
  remain isolated in `src/lib/routeGuidance.ts`.
- Routable steps enable turn announcements and off-route handling.
- A saved/manual route without steps remains usable as breadcrumb guidance but
  never claims true turn-by-turn navigation.
- Off-route state requires three consecutive out-of-corridor location samples
  to reduce noisy-GPS alerts.
- Trail suitability is not inferred. A route without provider-supported trail
  steps remains breadcrumb-only.
