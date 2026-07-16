# Build 39 Live Activity Layout and Control Specification

Authority: Apple ActivityKit, WidgetKit, SwiftUI, and App Intents. Layouts use
system-provided regions and do not assume one universal fixed widget size.

## Shared ownership contract

- Exactly one current session owns a Live Activity.
- Native attributes, JavaScript payloads, and App Group commands carry the same
  session ID and source.
- Sources distinguish running, outdoor activity, Training Block strength, and
  Preset strength.
- A poller handles only an exact session ID/source match. Missing, stale, or
  foreign identity cannot mutate another session.
- The App Intent publishes pause, resume, or complete pending state immediately.
- A pending transition suppresses duplicate/conflicting taps for 15 seconds.
- JavaScript applies the authoritative state transition, clears the command, and
  publishes ready state.
- A stale stored ActivityKit ID is cleared and recovered only when exactly one
  matching activity exists.

## Outdoor activity content

Running, walking, run/walk, hiking, cycling, downhill skiing,
cross-country skiing, and snowboarding share the control contract while exposing
only applicable metrics.

- Running/walking/run-walk/hiking: elapsed time, distance, pace, heart rate,
  interval/guidance when applicable.
- Cycling: elapsed time, distance, speed, heart rate, elevation, guidance.
- Skiing/snowboarding: elapsed time, distance, speed, heart rate, elevation or
  descent when available.
- Navigation outranks interval text; interval text outranks optional cue text.

## Strength content priority

1. Current exercise.
2. Sets x reps or hold prescription.
3. Load or resistance.
4. Exercise progress.
5. Elapsed time.
6. Next exercise.
7. Pause/resume and completion.

The workout title truncates before the current exercise prescription.

## Lock Screen

- Safe internal padding: 14 points horizontal and 10–12 points vertical.
- Current exercise: one line, semibold or bold.
- Prescription and load: first-class values, one line each.
- Next exercise: one concise line below the primary prescription.
- Pause/resume and completion are visually separated.
- Pending state replaces active controls with progress and a transition label.
- VoiceOver announces activity, primary metrics, guidance, and pending state.

## Dynamic Island

### Compact leading

- Activity icon plus elapsed time, or current exercise for Strength.
- One line; paused state remains visually distinct.

### Compact trailing

- Outdoor: distance.
- Strength: readable exercise progress.
- No duplicated pace/speed.

### Minimal

- Activity-specific icon; paused state uses the pause symbol.
- No essential instruction exists only in this presentation.

### Expanded leading

- Outdoor elapsed time or Strength current exercise.
- One line with tail truncation.

### Expanded trailing

- Outdoor distance.
- Strength progress and load.

### Expanded center

- Reserved; no required state depends on this optional region.

### Expanded bottom

- Outdoor guidance plus pace/speed and controls.
- Strength prescription and load above pause/resume and done controls.
- Pending transitions replace controls with progress and status.

## Narrow devices and accessibility

- Flexible widths, one-line priorities, tail truncation, and bounded scale
  factors protect essential content.
- Dynamic Type cannot remove the primary prescription or pending state.
- Controls use the system Live Activity interaction surface and clear labels.
- Lock Screen, Dynamic Island variants, StandBy, repeated taps, backgrounding,
  and app relaunch remain physical-device checks.
