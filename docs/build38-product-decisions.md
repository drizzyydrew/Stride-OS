# Build 38 Product Decisions

Date: 2026-07-16  
Release target: StrideOS 1.0.0 (iOS Build 38)

## Domain and architecture

- `Activity` is the canonical completed-work contract. Running, walking,
  cycling, swimming, hiking, skiing, conditioning, strength, mobility, and
  manual work retain only applicable metrics.
- Running projections remain isolated: walking and cross-training never enter
  running pace, PR, VDOT, race-prediction, or mileage calculations.
- Load uses session RPE (`duration minutes × RPE`) first, supported HR-zone load
  second, and conservative activity-specific estimates only as fallback.
  Whole-body, running, walking, cross-training, strength, impact, and non-impact
  dimensions remain queryable independently. ACWR is described only as a
  workload trend.
- Existing run, strength, and mobility records are projected into stable,
  idempotent Activity records. Raw legacy data remains intact.

## Training behavior

- Cross-training is opt-in. Preferences cover activity, purpose, frequency,
  preferred days, typical duration, environment/equipment, replacement versus
  supplementation, experience, seasonality, and restrictions.
- Lower-impact aerobic work may replace or supplement easy work. HIIT and
  mixed-modal conditioning count as intensity and are not stacked casually
  beside intervals or heavy strength.
- Primary endurance mode is Running, Walking, Run/Walk, or General Endurance.
  Changing it affects future programming only.
- Couch to 5K, 10K, Half Marathon, and Marathon are adaptive Preset Goal Plans.
  Minimum duration reflects current capacity, recent consistency, symptoms,
  availability, and goal distance. Earlier targets require an explicit,
  non-fear-based acknowledgment.
- Beginner plans prioritize aerobic development, durability before intensity,
  recovery weeks, strength support, run/walk acceptance, readiness adaptation,
  and fueling progression for longer goals. They do not promise completion or
  injury prevention.

## Tracking, voice, and directions

- Outdoor running, walking, cycling, hiking, and skiing share an
  activity-specific GPS state machine with pause/resume, stable point filtering,
  elevation, HR-ready fields, save, and discard.
- Run/walk transitions, sustained high-effort feedback, hydration, fuel, and
  turn instructions use one collision-aware speech queue. Paused elapsed time
  does not advance cue schedules or create duplicate speech.
- MapKit walking and cycling directions are obtained through the native module
  when a route is routable. Manually drawn or unsupported routes retain honest
  breadcrumb following. Off-route status requires sustained evidence rather
  than one noisy sample.
- Provider keys are not embedded in the client. MapKit availability and regional
  cycling coverage are treated as runtime capabilities.

## Live Activity

- One normalized payload selects applicable pace/speed, HR, interval,
  navigation, elevation, and strength content by activity.
- Lock Screen and each Dynamic Island region have explicit content priorities,
  line limits, truncation rules, safe padding, and narrow-device fallbacks in
  `docs/build38-live-activity-layout-spec.md`.
- Native control intents persist the ActivityKit ID, expose a pending state, and
  suppress rapid duplicate/conflicting commands. Strength gives sets, reps, and
  load first-class visual priority.

## Bike Fit

- Bike Fit follows Running Gait in Movement Lab and requires a direct lateral
  15-second capture with the whole rider, bicycle, crank, pedals, and contact
  points visible.
- Analysis uses the closest visible rider chain and representative top/bottom
  pedal phases. Supported outputs are estimated two-dimensional knee, hip,
  trunk, elbow, shoulder, and confidence-limited ankle observations.
- Saddle fore-aft, cleat position, force, pressure, joint loading, exact bike
  geometry, aerodynamic optimization, diagnosis, and injury prediction are not
  claimed.
- Two canonical Dion production instruction images are wired without modifying
  the approved Movement Lab manifest.

## Accessibility and migration

- Controls target at least 44 points, meaningful values have screen-reader
  labels, destructive actions remain separated, and visual alternatives remain
  available for every spoken cue.
- Stores use versioned, idempotent migrations with safe defaults for partial
  Build 36/37 data. Goals can end without deleting activity, readiness,
  analytics, routes, analyses, or history.

## Authorities

- Expo implementation follows the versioned SDK 56 documentation for
  [Location](https://docs.expo.dev/versions/v56.0.0/sdk/location/),
  [TaskManager](https://docs.expo.dev/versions/v56.0.0/sdk/task-manager/), and
  [Speech](https://docs.expo.dev/versions/v56.0.0/sdk/speech/).
- Native presentation and routing follow Apple’s
  [Live Activities guidance](https://developer.apple.com/design/human-interface-guidelines/live-activities)
  and [MKDirections](https://developer.apple.com/documentation/mapkit/mkdirections).
- Beginner progression language follows the conservative activity-progression
  principles in the
  [Physical Activity Guidelines for Americans](https://health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines/current-guidelines).

## Device-only risks

GPS/background execution, spoken cues under screen lock, MapKit regional
coverage, ActivityKit intent timing, Dynamic Island variants, iCloud media,
camera switching, VoiceOver, and real-world Bike Fit landmark confidence still
require the Build 38 physical-device checklist.
