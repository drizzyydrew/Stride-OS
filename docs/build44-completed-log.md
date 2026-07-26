# StrideOS Build 44 final integration log

Date: 2026-07-26
Repository: `/Users/drew/Documents/StrideOS_App_clean_build19_v3_foundation`
Branch: `build-19-v3-foundation`
Starting HEAD: `40600b8022f06ae8b72b9e7de232baa585644e0a`
Current app version: `1.0.0`
Current iOS buildNumber: `44`

## Release status

Build 44 source and web validation gates passed. The build number was changed
from `43` to `44` only after EAS iOS history showed no Build 44/no active iOS
builds and the user provided a TestFlight screenshot showing current and
previous TestFlight builds as `1.0.0 (43)`.

## Current architecture included in the working tree

- Expo Web stabilization and optional Supabase/local-first support.
- Canonical `ScheduledSession` and linked `CompletedActivity` architecture.
- Duplicate scheduled-completion prevention and planned-versus-completed
  preservation.
- Treadmill live logging with GPS suppression, estimated/final distance source
  metadata, and correction handling.
- Indoor cycling live logging with honest unavailable-distance behavior.
- Custom live strength and Do My Own Workout flows.
- Adaptive planning, Adapt My Week, missed-workout, Not Feeling 100%, workout
  alternatives, and same-week calendar protections.
- Beginner safeguards for one primary run per day, no run/walk plus easy run on
  the same beginner day, no consecutive hard beginner running, no Norwegian 4x4
  in foundation phases, conservative progression, repeat-week support, and
  consistency-before-speed behavior.
- Simplified Today experience with one dominant workout recommendation.
- Word-first readiness labels and a consolidated Daily Check-In.
- Preset/training-block/custom strength per-set persistence.
- Indoor heart-rate summaries with time-weighted averages, max HR, zone time
  when coverage allows, gap metadata, and unreliable-average suppression.
- Compact AI Coach context that distinguishes prescription, adaptation,
  completion, readiness, and confirmation state.

## Final readiness UI and calculation fixes

- Sleep duration is collected as hours and minutes.
- The sleep control uses the shared snap-to-interval picker-wheel architecture
  with two side-by-side columns:
  - hours: `0` through `14`
  - minutes: `0` through `59`, one-minute increments
- `0 hr 0 min` is not treated as a completed answer.
- Sleep quality, body, energy, and stress use five word-based choices and no
  visible `1–5` scale.
- Required answers are not preselected unless a saved check-in exists for today.
- Save remains disabled until sleep duration, sleep quality, body, energy, and
  stress are valid.
- Selected states include visible text, accessibility state, and non-color cues.
- The readiness model uses centralized weights:
  - sleep duration: 21%
  - sleep quality: 14%
  - body: 18%
  - energy: 12%
  - stress: 10%
  - recent training/recovery: 25%
- Sleep duration uses an interpolated contribution curve rather than UI-level
  bands.
- Personal sleep baseline uses valid dated entries inside a true 28-calendar-day
  window and requires seven valid entries before personalization.
- Overlapping fatigue, energy, and sleep-quality reductions are capped so
  correlated subjective signals do not over-penalize readiness.
- Readiness storage schema is `4`; migration preserves older entries without
  inventing missing sleep duration or sleep quality.

## Validation evidence

- `PATH=/usr/local/bin:$PATH npm run typecheck` — passed
- `PATH=/usr/local/bin:$PATH npm test` — passed, 411/411
- `PATH=/usr/local/bin:$PATH npm run expo:check` — passed
- `PATH=/usr/local/bin:$PATH npx expo export --platform web` — passed, 111
  static routes
- `git diff --check` — passed
- Browser QA — passed for Today, Daily Check-In, the two-column sleep picker,
  readiness explanation, tab visibility, route smoke checks, reload/new-tab
  persistence, and 320/375/390/430/desktop width checks
- Secret scan — no service-role keys, signing secrets, private keys, or obvious
  credential tokens found in the tracked/untracked source set

## Build 44 availability evidence

- EAS iOS `build:list --limit 50` found no build number `44`.
- EAS iOS `build:list --limit 50` found no active Build 44.
- Latest EAS production iOS build remains Build 43 at
  `40600b8022f06ae8b72b9e7de232baa585644e0a`.
- User-provided TestFlight screenshot shows current build `1.0.0 (43)` and
  Previous Builds `1.0.0 (43)`, with no visible Build 44.
- Local read-only App Store Connect API access was not available; the screenshot
  is the external TestFlight availability evidence used before bumping
  `expo.ios.buildNumber`.

## Release classification

Native TestFlight candidate after build-number bump.

## Exact next safe action

Rerun final gates after the build-number bump, stage the intended source files,
commit once with the requested Build 44 message, push, start one EAS iOS
production build, and submit that exact EAS build to TestFlight.
