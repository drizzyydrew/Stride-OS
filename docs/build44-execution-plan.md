# Build 44 Execution Plan — "Build 1" of the four-build sequence

Scheduled-session/completed-activity architecture, live + manual workout workflows,
treadmill running, indoor cycling. No Apple Watch, no new native deps, no EAS/TestFlight
release during implementation.

Repo: `/Users/drew/Documents/StrideOS_App_clean_build19_v3_foundation`
Branch: `build-19-v3-foundation` · Starting HEAD: `40600b8` (Build 43) · iOS buildNumber stays `43` until release gate.

Baseline (verified before any change): typecheck clean, 225/225 tests pass, web export passes.

## Non-negotiable guardrails

1. **Preserve the uncommitted web-compat work.** ~45 modified files + `src/lib/supabaseAvailability.ts`,
   `src/store/persistStorage.ts`, `src/components/maps/`, `src/utils/__tests__/supabaseAvailability.test.ts`.
   Never revert a store from `createAppJSONStorage()` back to raw AsyncStorage. Never reintroduce an eager
   Supabase client. Map imports go through `src/components/maps`.
2. Do not commit, stash, reset, or discard anything. Leave all work in the working tree.
3. Do not bump `ios.buildNumber`, run EAS, or publish updates.
4. Commands: `PATH=/usr/local/bin:$PATH npm run typecheck` · `PATH=/usr/local/bin:$PATH npm test` ·
   `PATH=/usr/local/bin:$PATH npx expo export --platform web` · web dev: `PATH=/usr/local/bin:$PATH npx expo start --web --clear`
5. Tests are pure Node (`node:test` + `assert/strict`, run by tsx). Test only pure logic in
   `src/utils/__tests__/*.test.ts` or `scripts/tests/*.test.ts` — no React rendering. Put new business
   logic in pure modules so it is testable.
6. Planned values (the prescription) are never overwritten by actuals. `ScheduledSession` = prescription,
   `Activity` = what happened.

## Core contracts

### 1. Canonical scheduled-session IDs — `src/utils/scheduledSessionIds.ts` (new)

Single module exporting the ID builders currently inlined in `src/utils/scheduledSessions.ts`:

```ts
runScheduledSessionId(dateYMD, workoutId, dayIndex)      // week:${date}:run:${workoutId}:${dayIndex}
strengthScheduledSessionId(dateYMD, strengthId)          // week:${date}:strength:${strengthId}
otherScheduledSessionId(dateYMD, type, title)            // week:${date}:${type}:${title}
beginnerScheduledSessionId(planId, sessionId)            // ${planId}:${sessionId}
```

`scheduledSessions.ts` derivation AND every completion writer must import these. No screen or store may
invent its own interpretation of a session ID. Every path that creates a completion for a scheduled
session (manual log, mark completed, GPS run finish, treadmill finish, strength finish, custom workout,
indoor cycling, skip) must stamp `Activity.scheduledSessionId` with the canonical ID.

### 2. Completion classification — extend `src/utils/activityCompletion.ts`

```ts
export type CompletionClassification =
  | 'completed_as_prescribed'
  | 'modified'
  | 'equivalent_substitute'
  | 'partial'
  | 'completed_other_activity'
  | 'stopped_early'
  | 'skipped';
```

- Add optional `completionClassification?: CompletionClassification` to `Activity` (`src/types/activity.ts`).
- Back-compat mapping to `ActivityStatus`: `skipped→'skipped'`; `partial|stopped_early→'partial'`; else `'completed'`.
- `ScheduledSession.completionState` widens to this union. Existing persisted activities without the field
  derive classification from `status` (no data rewrite required).
- Duplicate prevention: `activityStore.addActivity` already upserts on matching `scheduledSessionId` — keep.
  UI rule everywhere: if a linked completion exists, actions become View/Edit/Compare, never a second log.

### 3. Distance source metadata — `src/types/activity.ts`

```ts
export type DistanceSource =
  | 'gps' | 'treadmill_reported' | 'foot_pod' | 'prescribed_estimate'
  | 'confirmed_speed_estimate' | 'equipment_display' | 'manual_entry'
  | 'health_import' | 'trainer_reported' | 'wheel_sensor' | 'virtual' | 'unavailable';
```

Add to `ActivityMetrics`: `distanceSource?: DistanceSource`, `originalEstimatedDistanceMiles?: number`
(preserved when the athlete corrects final distance). Never fabricate GPS coordinates or routes for
indoor sessions. Never derive distance from HR or from power.

### 4. Live workout instance identity

Each of `activeRunStore`, `activeActivityStore`, `activeStrengthSessionStore` (and the new indoor ride
store) gains `workoutInstanceId: string` (`${scheduledSessionId ?? 'adhoc'}:${startedAt}`). Every start
creates a fresh instance and resets transient state. Mount guards key on instance, not on bare
`isActive`. Conflict alerts (`activeSessionOwner.ts` consumers) must offer "End previous session and
start new" instead of dead-ending. Dismissal state, where any exists, is scoped to the instance ID.

### 5. Treadmill math — `src/utils/treadmill.ts` (new, pure)

`segmentDistanceMiles = speedMph * elapsedSeconds / 3600`, segment accumulation on every confirmed speed
change, mph↔km/h conversion helpers (internal canonical unit: miles), guards rejecting NaN/Infinity/
negative/zero-duration inputs. Distance hierarchy: health-import (existing HealthKit permission, iOS
only) → confirmed-speed estimate → manual live entry → completion correction from the treadmill display.
Pace recalculated from final distance + elapsed moving time with divide-by-zero protection.

### 6. Recalculation pipeline — `src/lib/recalculation.ts` (new)

One exported `runRecalculation(reason)` invoked automatically after activity add/update/remove/skip and
by a manual Refresh control (same code path). It recomputes/refreshes the stored aggregates that are not
render-derived (athlete fatigue/load fields, ACWR inputs unified onto the normalized activity store) and
records `{ lastRunAt, status, error }` in a small store so the UI can show updated time / success /
error. No silent spinners.

## Migration design

- `ACTIVITY_STORE_SCHEMA_VERSION` 1 → 2. Migration remaps legacy `scheduledSessionId` values written as
  bare `workoutId` / `sessionId` (from `activityMigration.ts`) to canonical IDs when derivable from the
  record's date/completion key; otherwise leaves them untouched. Idempotent; never deletes activities.
- `activityFromWorkoutRecord` / `activityFromStrengthRecord` fixed to emit canonical IDs going forward
  (the legacy import in `onRehydrateStorage` runs every launch and must stay idempotent).
- Active-session stores: rehydrated sessions without `workoutInstanceId` get one synthesized from
  `startedAt` (or are treated as stale and clearable via the conflict UI).
- All new fields optional → old persisted data loads unchanged. Tests must cover: v1→v2 remap, unknown
  fields preserved, no duplicate creation on repeated migration.

## Phases (sequential — shared files, no parallel edits)

**Phase A — Schedule/completion contract + recalculation (foundation)**
Canonical ID module; wire GPS run finish (`activity/start.tsx`, `run-tracking.tsx`, `training/index.tsx`
run launch already threads `scheduledSessionId` into `activeRunStore` — carry it into the final
Activity); fix `activityMigration.ts` ID emission + store migration v2; classification enum; duplicate-
prevention UI consistency; fix the dual `useScheduledSessions` divergence in `training/index.tsx`
(Running panel vs Calendar); scheduled-workout action set (View Details / Start / Mark Completed / Log
Manually / Reschedule / Skip / View–Edit–Compare Completed) on Calendar, Today, Running, Strength;
recalculation pipeline + manual Refresh; edit/delete integrity (delete unlinks, restores scheduled
state, recalculates). Tests.

**Phase B — Live instance bug + treadmill running**
Instance IDs across active stores; conflict-resolution UX; indoor/outdoor selector on all run starts
(quick/time/distance/workout/race + scheduled); treadmill live screen (no GPS, no map, no location
permission; time/step/targets/HR zone/speed-confirm/manual distance/RPE/pause/resume/skip/end);
completion correction sheet (estimate vs display distance, choose either or enter another; preserve
source + original estimate); `src/utils/treadmill.ts` + tests.

**Phase C — Indoor cycling**
New live indoor ride store + screen (free ride, scheduled workout, log completed ride): elapsed,
intervals, HR, manual/equipment cadence/power/resistance, RPE, pause/resume/skip/finish. Distance only
from equipment display or manual entry; otherwise `unavailable` with the exact copy: "Live distance is
unavailable. Enter the bike or trainer's displayed distance during or after the session." Load from
duration/HR/power/RPE/interval work — never from indoor mileage equivalence. Tests.

**Phase D — Custom strength live + Do My Own Workout + warm-ups**
Per-set structure in `activeStrengthSessionStore` (sets: reps, weight+unit, band level, hold time, RPE,
warm-up flag, completed) with equipment types; add/remove/reorder/substitute/skip/duplicate-set/edit-
prior-set/draft/finish; honest split summaries (`src/utils/strengthSummary.ts` — no universal volume
number). Do My Own Workout entry on eligible scheduled sessions; substitution rules
(`src/utils/substitution.ts`): category+intent match → equivalent_substitute/modified; easy run→hard
intervals never auto-as-prescribed; run→cycling only when explicitly accepted. Workout-specific warm-ups
(strength preset card stops being hardcoded; no added volume for mobility/active recovery). Tests.

**Phase E — Add Activity coverage + web QA + full validation**
Activity type list covers: Running, Run/Walk, Walking, Strength, Outdoor Cycling, Indoor Cycling,
Hiking, Swimming, XC Ski, Downhill Ski, Snowboarding, Mobility, HIIT/Mixed, Active Recovery, Other —
forms adapt per type. Browser QA at 320/375/390/430/desktop across onboarding, Today, Calendar, Running,
Strength, Activity, Add Activity, quick start, indoor/outdoor toggle, treadmill live+completion, indoor
cycling live, custom strength live, scheduled completion, planned-vs-actual, edit/delete, bottom nav,
persistence after refresh. Full typecheck + tests + web export.

## Release gates (final 10% audit)

All gates in the build brief section O, verified independently. Classification will be
**web-preview only** or **full native build + TestFlight** — EAS Update is NOT configured
(no runtimeVersion/updates URL), so "web preview plus EAS Update" is off the table without new config.
