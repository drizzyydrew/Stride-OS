# StrideOS Build 2 completion log

Date: 2026-07-26
Branch: `build-19-v3-foundation`
Starting and ending HEAD: `40600b8022f06ae8b72b9e7de232baa585644e0a`
Release action: none

## Release classification

Build 2 is a verified web-preview candidate. It is not classified as a native
release candidate because this build intentionally did not create an EAS build,
submit to TestFlight, increment the iOS build number, or run native-device QA.
EAS Update publication is unavailable because the app has no configured update
URL/runtime version contract.

## Architecture

- `ScheduledSession` remains the only schedule authority. Confirmed adaptations
  are immutable overlays keyed by the canonical calendar week and stable
  scheduled-session ID.
- Adaptations preserve the original prescription, store the adapted
  prescription separately, record reason/time/confirmation, and retain an audit
  history. Preview is required before confirmation.
- Today, Calendar, Running, Strength, Activity, readiness, and AI Coach resolve
  the same adapted scheduled-session projection.
- Activity mutation still writes through the normalized Activity store and the
  shared recalculation pipeline.
- Readiness is a pure, tested calculation module. UI components collect inputs
  and render explanations but do not own scoring rules.
- Preset, Training Block, and custom strength now share the same live per-set
  state and completion serializer.

## Athlete-facing changes

- Today has one dominant workout recommendation, plain-language readiness, and
  progressive disclosure for explanation and advanced data.
- Daily readiness uses sleep hours/minutes, body status, energy, stress, and one
  optional factor. It supports a 28-day personal sleep baseline after seven
  valid entries and caps overlapping subjective penalties.
- Adapt My Week, missed-workout, and Not Feeling 100% flows preview conservative
  changes before applying them.
- Workout details show what, why, feel, what not to do, and success criteria
  using the resolved scheduled prescription.
- Context alternatives cover limited time, travel/location constraints,
  treadmill/hill equivalence, equipment limitations, unsafe weather, and
  lower-impact needs.
- Beginner generators enforce one primary run per day, no consecutive hard
  beginner runs, no Norwegian 4x4 in foundation, conservative long-run
  progression, recovery weeks, and audited week repeats.
- Calendar adaptation validation warns about duplicate IDs, two primary runs,
  consecutive hard sessions, hard lower-body strength/long-run adjacency,
  insufficient recovery, locked days, and plan-boundary moves.
- Calendar Reschedule routes through that same preview validator; it no longer
  writes a new unchecked date override. Unavailable training days are passed as
  locked dates. Historic date overrides are retained but applied only when they
  remain same-week, unlocked, and conflict-free under the current validator.
- Voice coaching exposes Silent, Minimal, Standard, and Coach levels plus
  category toggles without adding a native audio dependency.

## Data and migration behavior

- Readiness schema v4 preserves historic entries and does not invent sleep data.
- Beginner-plan schema v2 defaults historic plans to the distance-completion goal
  while preserving stored schedules.
- Adaptation schema v2 accepts only confirmed serializable records.
- Legacy strength logs remain readable. Rehydrated active strength sessions
  synthesize missing set structures from the historic prescription without
  inventing completed sets, load, or effort.
- New strength completions preserve each exercise and set: reps, weight/unit,
  band level, hold time, RPE, warm-up status, skipped exercises,
  substitutions, and added exercises.
- Indoor heart-rate summaries use timestamp-weighted observed intervals, report
  maximum HR/zones/gaps/source metadata, and suppress a reliable-average claim
  when sample coverage is poor. Polling retains HealthKit's source timestamp, so
  a repeated observation cannot masquerade as fresh coverage.
- Readiness receives normalized recent seven-day load and an explicit
  prior-day-intensity flag from completed Activity records.
- Existing voice behavior is migration-safe: Coach is the default for users who
  have not selected a level, while explicit Standard/Minimal/Silent choices are
  retained.

## Verification

- TypeScript: passed (`npm run typecheck`)
- Tests: passed, 411/411 (`npm test`)
- Expo dependency check: passed (`npm run expo:check`)
- Production web export: passed, 111 static routes
- Whitespace validation: passed (`git diff --check`)
- Browser QA: passed at 320, 375, 390, 430, and desktop widths
- Browser reload and relaunch persistence: readiness and primary route state
  verified in the final Build 44 integration pass; confirmed adaptation and
  per-set strength entry persistence were verified in the Build 2 pass
- Latest browser runtime log: no application error; Expo's documented
  notification-listener limitation remains visible on web

## Known limitations

- Cross-week rescheduling is intentionally not automated. Same-week moves are
  supported and protected; unsafe cross-week changes remain unapplied.
- AI Coach remains explicitly unavailable when optional Supabase configuration
  is absent; no fake credentials or cloud fallback are introduced.
- Indoor HR accuracy depends on real timestamped samples. Missing samples and
  connection gaps are not interpolated.
- Native simulator/device, Live Activity, EAS build, TestFlight, and EAS Update
  publication are intentionally deferred.
