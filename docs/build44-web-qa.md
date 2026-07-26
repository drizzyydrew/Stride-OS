# Build 44 web QA log

Date: 2026-07-26
Repo: `/Users/drew/Documents/StrideOS_App_clean_build19_v3_foundation`
Branch: `build-19-v3-foundation`

## Automated gates

- `PATH=/usr/local/bin:$PATH npm run typecheck` — passed
- `PATH=/usr/local/bin:$PATH npm test` — passed, 411/411
- `PATH=/usr/local/bin:$PATH npm run expo:check` — passed
- `PATH=/usr/local/bin:$PATH npx expo export --platform web` — passed, 111
  static routes
- `git diff --check` — passed

## Browser QA

Environment:

- `PATH=/usr/local/bin:$PATH npx expo start --web --clear`
- URL: `http://localhost:8081`
- Browser: Codex in-app browser

Observed pass:

- Today default state renders one dominant workout recommendation card.
- Readiness is word-first and does not show a prominent numeric score.
- Daily Check-In renders sleep duration, sleep quality, body, energy, stress,
  and optional factor sections.
- Sleep duration opens a two-column wheel using the shared picker-wheel
  architecture:
  - `HOURS`: 0 through 14
  - `MINUTES`: 0 through 59, one-minute increments
- Sleep quality choices are word-based: Very poor, Poor, Fair, Good, Excellent.
- Body choices are word-based: Very fatigued, Heavy or sore, A little stiff,
  Good, Fresh.
- Energy choices are word-based: Very low, Low, Normal, Good, High.
- Stress choices are word-based: Very high, High, Moderate, Low, Very low.
- Save Check-In stays disabled until required answers are valid.
- Readiness explanation displays plain-language details for sleep, sleep
  quality, body, energy, stress, recent training, and recommendation.
- Bottom tabs render all six intended destinations: Today, Calendar, Running,
  Strength, AI Coach, More.
- Width sweep passed at 320, 375, 390, 430, and desktop width: all six tabs
  visible, no horizontal overflow observed, no runtime error text.
- Route smoke checks passed for Today, Calendar, Running, Strength, Activity,
  AI Coach, More, Adapt My Week, Indoor Ride, and Custom Strength.
- Reload/new-tab persistence preserved the Today/readiness route state without
  runtime errors.

Expected web-only warning:

- Expo notifications logs that push-token listener behavior is not fully
  supported on web. This is expected and guarded; it is not an app crash.

## Native-only limitations

The web QA pass does not prove native device behavior for GPS, Live Activity,
HealthKit polling, App Groups, or App Store/TestFlight processing. Build 44
therefore remains a native TestFlight candidate that requires the normal EAS
iOS build and TestFlight upload after the build-number availability gate passes.
