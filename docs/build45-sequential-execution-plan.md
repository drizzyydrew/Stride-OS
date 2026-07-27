# Build 45 Sequential Execution Plan

First-10% architecture and phased implementation plan for the middle-80% (Codex).
Authored by Fable 5 on 2026-07-26 after a full repository, release, and subsystem audit.

## 0. Verified starting state (do not re-derive; re-verify before Phase 1)

- Repo `/Users/drew/Documents/StrideOS_App_clean_build19_v3_foundation`, branch `build-19-v3-foundation`
- HEAD `5a44753` ("StrideOS Build 44 — indoor workouts, adaptive planning, and readiness clarity"), in sync with `origin`
- Working tree clean; app version 1.0.0; `ios.buildNumber` **44**
- Build 44: committed ✔ pushed ✔ EAS-built ✔ (build `2af6e8ca-0cfe-41fc-ab15-e354aebe0976`, appBuildVersion 44, FINISHED 2026-07-26, from exactly `5a44753`). TestFlight submission **unverified** — latest confirmed TestFlight build is 1.0.0 (43). Verify in App Store Connect before release actions.
- Next unused iOS build number: **45** → this document's number is correct.
- Validation baseline: typecheck clean, **411/411 tests**, web export 111 routes.
- EAS Update is NOT configured (no runtimeVersion / updates URL). Release path is full native build only.
- `ios/` and `android/` are gitignored (CNG/prebuild). Native changes go through package deps, config plugins, `app.json` plugins/infoPlist, and `modules/*` Expo modules — never hand-edited pods.

## 0a. Codex ground rules (apply to every phase)

- Follow phases IN ORDER. Do not start a phase before the prior phase's completion gate passes.
- Never modify: `ios.buildNumber`, `expo.version`, `eas.json`, `.git` state (no commit/push/stash/reset), Supabase schema, `modules/stride-pose`.
- `app.json` may be edited ONLY to add plugin entries/infoPlist keys required by Phases 9–11, exactly as specified there.
- Preserve: canonical scheduled-session architecture (`src/utils/scheduledSessionIds.ts` formats are on-disk identity — never change formats), planned-vs-completed separation, duplicate-completion prevention, web/Supabase-optional behavior (`createAppJSONStorage()`, nullable `getSupabaseClient()`, maps facade, healthKit dynamic-require pattern), readiness v4 word-first UI rules (no numeric 1–5 scales), Monday/Sunday week conventions as found in code.
- No Apple Watch / watchOS / WatchConnectivity. No Race Day Command Center. No leaderboards/social feed/percentile claims. No separate clinical symptom system.
- All new business logic goes in pure modules under `src/utils/**` (node-testable: `node:test` + `assert/strict` via tsx). UI files stay thin.
- Commands: `PATH=/usr/local/bin:$PATH npm run typecheck` · `npm test` · `npx expo export --platform web` · dev `npx expo start --web --clear`.
- After every phase: typecheck + full tests + web export green; report phase results before continuing.
- Hot files with high collision risk — only ONE phase may edit each at a time (the plan sequences this): `app/(tabs)/dashboard/index.tsx`, `app/(tabs)/training/index.tsx`, `src/hooks/useScheduledSessions.ts`, `src/utils/adaptationWorkflow.ts`, `src/store/settingsStore.ts`, `app/(tabs)/_layout.tsx`, `modules/stride-live-activity/**`, `targets/StrideRunLiveActivity/**`.

## 0b. Architecture decisions (binding)

1. **Extend, don't rewrite.** The canonical ScheduledSession/Activity architecture, adaptation overlay system (`adaptationWorkflow.ts` + `adaptationStore` v2), readiness v4, strength engine phase config, and recalculation pipeline all remain the spine. The dormant `src/utils/training/adaptWeek.ts` severity/trigger model and the unwired `isEligibleForNorwegian4x4` (`src/utils/advancedIntervals.ts`) are REUSED as foundations, not duplicated.
2. **Stress profile is computed, not persisted.** New pure classifier `src/utils/sessionStress.ts` attaches `stress: SessionStressProfile` to `ScheduledSession` at derivation time. It replaces the regex `isHard()` heuristics inside `adaptationWorkflow.ts` as the single hard/medium/easy/recovery authority.
3. **One deload model.** New `src/utils/training/deloadModel.ts` becomes the single cadence/volume authority; the four independent `% 4` implementations (periodization.ts:116, progression.ts:18, macroPlanner.ts:105, periodizationEngine.ts:26) delegate to it.
4. **One decision engine.** New `src/utils/training/trainingDecisionEngine.ts` produces the weekly `progress | maintain | regress | deload | repeat | rebuild` decision from completion history, planned-vs-completed, RPE, HR/pace response, partial/stopped-early sessions, readiness v4 (wired in for the first time), consistency, interruptions, phase, goal, event date, available days. Strength's existing `computeProgressionDecision` pattern and adaptWeek's trigger detection are the reference implementations to generalize.
5. **Cross-week moves are a ledger, not an identity change.** `scheduledSessionId` remains the stable origin identity (deterministic per plan week). A persisted move ledger (extended `scheduledSessionSelectionStore`) maps originId → target date across weeks; `useScheduledSessions` projects two-sided (moved-out hidden, moved-in injected with original prescription). ID formats never change.
6. **Share cards use Skia snapshot + RN Share** — `@shopify/react-native-skia` (installed, unused) `makeImageFromView` → file via `expo-file-system` → `Share.share`. Zero new dependencies for sharing.
7. **New native surface is limited to**: `expo-audio` (Phase 9, audio session for voice), Live Activity contract/layout work in existing module/target (Phase 10), and `react-native-ble-plx` + its config plugin (Phase 11). Nothing else native.
8. **Gear mileage is derived, never a stored counter** — aggregated from Activities so edits/deletes stay correct.
9. **Experience mode is a presentation-layer concern**: `experienceMode: 'simple'|'balanced'|'data_rich'` in settingsStore + a `useExperienceMode()` hook + a tiny `<ModeVisible min="...">` gate component. Engines and stores are mode-agnostic.
10. **AI Coach additions enter the prompt budget as priority ≥ 8, non-required, compact-capable sections** (`coachPromptBudget.ts` envelope: 4500 target / 5000 hard).

---

## PHASE 1 — Regression net + stress-profile model + unified deload model

**Objective:** Put tests under the engines Build 45 will modify (currently uncovered), then introduce the session stress classifier and the single deload authority.

Dependencies: none.

Likely files: NEW `scripts/tests/{periodizationBaseline,workoutEngineBaseline,strengthEngineBaseline,macroPlannerBaseline}.test.ts`; NEW `src/utils/sessionStress.ts` + tests; NEW `src/utils/training/deloadModel.ts` + tests; EDIT `src/utils/{periodization,progression}.ts`, `src/utils/plan/macroPlanner.ts`, `src/utils/periodizationEngine.ts` (delegate to deloadModel), `src/utils/scheduledSessions.ts` (attach `stress`), `src/utils/adaptationWorkflow.ts` (isHard/isLong/isHardLowerStrength delegate to sessionStress), `src/utils/trainingEngine.ts` (thread inputs if needed).

Data contracts:
```ts
type StressClassification = 'recovery' | 'easy' | 'medium' | 'hard';
type SessionStressProfile = {
  classification: StressClassification;
  axes: { cardio: 0|1|2|3; lowerMuscular: 0|1|2|3; upperMuscular: 0|1|2|3;
          impact: 0|1|2|3; neuromuscular: 0|1|2|3; duration: 0|1|2|3 };
  recoveryDemandHours: 12 | 24 | 36 | 48;
};
// ScheduledSession gains optional `stress?: SessionStressProfile` (computed, not persisted)
type DeloadDecisionInput = { weekInBlock: number; blockLength: 3|4; /* + engine signals */ };
// deloadModel: cadence default 3 build + 1 deload; alternative 4+1; volume factor default 0.70 (range 0.65–0.75)
```

Rules the classifier must encode: interval/tempo/threshold/vo2/hills/4x4/race-specific runs = hard (high cardio, high impact); long runs = medium-to-hard by duration axis; heavy lower strength = hard (lowerMuscular 3, cardio low); upper strength = hard on upperMuscular but LOW lower/impact (this is what makes upper+intervals an acceptable pair); mobility/active recovery = recovery; easy runs = easy and must STAY easy (accessory volume does not upgrade them).

Migrations: none (computed field).

Tests: baseline snapshots of current phase/mileage/template outputs (write BEFORE refactoring, assert unchanged AFTER deloadModel delegation); classifier matrix (each session archetype → expected class + axes); deload cadence 3+1 and 4+1; 65–75% volume band with 70% default; adaptationWorkflow conflict codes unchanged for existing cases (existing 10 adaptationWorkflow tests must keep passing).

Completion gates: 411 baseline tests still pass + new tests; deload behavior byte-identical for default cadence (snapshot-proven); typecheck; web export.

Must not modify: `useScheduledSessions.ts` projection logic, dashboard, tab layout.

Risks: deloadModel delegation silently shifting week phases — mitigated by the baseline snapshots written first.

## PHASE 2 — Training decision engine + quality progression + Norwegian 4×4 + periodized strength

**Objective:** Weekly progress/maintain/regress/deload/repeat/rebuild decisions from real athlete data; quality-exposure tracking with the newer-runner ladder; wire the dormant N4×4 gate; extend strength periodization; conflict rules for back-to-back hard days.

Dependencies: Phase 1 (stress profile, deloadModel).

Likely files: NEW `src/utils/training/trainingDecisionEngine.ts`, `src/utils/training/qualityExposure.ts` + tests; EDIT `src/utils/advancedIntervals.ts` (wire eligibility), `src/utils/workoutEngine.ts` (quality selection consults qualityExposure + decision; `RichWorkout` gains optional `protocol?: 'norwegian_4x4'` rather than widening `RichWorkoutType`), `src/utils/trainingEngine.ts` (consume decision), `src/utils/beginnerPlans.ts` (repeat/rebuild integration), `src/utils/strengthEngine.ts` (extend `PHASE_CONFIG` toward foundation/general/hypertrophy/max/power/peak/recovery mapping; volume reduces as race specificity rises; no high-volume hypertrophy before key long runs — enforced via validator), `src/utils/adaptationWorkflow.ts` (validator upgrades: axis-overlap conflict detection using `stress.axes`; allowed pattern: hard upper + running quality; consolidation pattern: heavy lower + quality same day permitted when followed by true easy/recovery day), `src/lib/recalculation.ts` (persist weekly decision snapshot — designated extension point at line ~32).

Decision inputs (all already available): activity store (completion classifications incl. partial/stopped_early), planned-vs-completed comparison, RPE, HR/pace from metrics, readiness v4 label + score (`readinessScore.ts`), `calculateActivityLoadTrend` per-axis ACWR, adherence/consistency windows, phase/goal/event date from macroPlan, available days from availability store.

Hard rules to encode (tests for each): never progress solely on calendar-week elapse; never raise volume+intensity+frequency+strength load simultaneously without a strong documented reason (engine emits `rationale`); quality exposure target = one appropriate exposure per 7–10 days once eligible, NOT every type every 10 days; Week 1 never introduces new formal quality; ladder easy→strides→gentle fartlek→hills→tempo/threshold→intervals→4×4; experienced athletes may re-enter higher on documented history; 4×4 requires base + proven sustained-intensity tolerance + HR/RPE control + stable recovery + suitable phase/goal + no adjacent hard lower-body day + never in beginner foundation + never by elapsed time alone; unacceptable adjacency list from the product rules (heavy lower→hills, lower hypertrophy→intervals, 4×4→tempo, intervals→heavy lower, plyo→sprint, race-long-run→lower power) each produce a validator conflict via axis overlap.

Migrations: `recalculationStore` gains optional decision snapshot fields (additive, safe merge).

Tests: decision matrix table-driven (≥ 20 scenarios incl. interruptions→rebuild, failed deload→repeat); quality ladder progression/regression; 4×4 eligibility positive + all negative gates; adjacency matrix acceptable/unacceptable pairs; strength phase mapping per plan type; deload week strength = reduced sets (existing behavior preserved).

Completion gates: full suite green; a written `rationale` string accompanies every non-`maintain` decision.

Must not modify: dashboard UI, tab layout, share/report code (doesn't exist yet).

Risks: over-aggressive regression triggers — keep thresholds conservative and covered by the scenario table; engine consumed read-only this phase (plan generation unchanged unless decision ≠ maintain).

## PHASE 3 — Prescription types (RepScheme) + continuous-eligibility gate

**Objective:** Timed/distance/tempo/hold prescriptions end-to-end; audit banks; explicit 5K-continuous gate for run-continuously half/marathon plans.

Dependencies: none structural (parallel-safe after Phase 1, but run sequentially).

Likely files: EDIT `src/types/strength.ts` (NEW `RepScheme` discriminated union: `reps | duration | distance | reps_hold | reps_tempo`; `PlannedExercise.repScheme?`; `CompletedSet.distanceMeters?`), `src/utils/strengthEngine.ts` (SESSION_TEMPLATES gain per-exercise scheme overrides — side plank/copenhagen/carries/calf-hold etc. audited), `src/constants/strengthBank.ts` (parse/annotate preset strings into schemes), NEW `src/utils/prescriptionFormat.ts` (`formatPrescription(scheme)` single renderer); EDIT render sites `app/(tabs)/activity/manual.tsx:380`, `app/(tabs)/strength/[sessionIndex].tsx:488`, `app/(tabs)/coach/index.tsx:535`, `app/(tabs)/strength/index.tsx:433`, `src/utils/strengthSession.ts` (`synthesizeSetEntries` consumes schemes; `ActiveSetEntry` already has holdSeconds/distanceMeters), summary path (`strengthSummary.ts` keeps reps/hold/distance/external-load separate — extend with distance total); EDIT `app/(tabs)/activity/plans.tsx` (+ `src/utils/beginnerPlans.ts` readiness input): explicit question "What is the farthest you can currently run without stopping?" with distance choices; require ≥ 5K continuous for `run_continuously` + half/marathon; otherwise encouraging recommendations (Couch to 5K, run/walk half or marathon plan, foundation block) — selection remains available, rejection copy is never used.

Migrations: all additive optional fields; no store version bumps; existing free-text preset `reps` strings remain the fallback when no scheme present.

Tests: scheme formatting (plank 3×30s never "reps"; farmer carry distance; tempo squat; calf raise + hold); bank audit test asserting every isometric/carry in `SESSION_TEMPLATES`/`strengthBank` has a non-`reps` scheme; synthesizeSetEntries from each scheme kind; summary separation incl. new distance total; eligibility gate matrix (< 5K → alternatives offered, ≥ 5K → allowed; complete_distance goal unaffected).

Completion gates: full suite; a grep-style test proving no "reps" rendering path remains for duration/distance schemes.

Must not modify: adaptationWorkflow, useScheduledSessions, dashboard.

## PHASE 4 — Safe cross-week scheduling

**Objective:** Cross-week moves with full protections, without changing session identity.

Dependencies: Phases 1–2 (stress axes + deload model + validator upgrades).

Likely files: EDIT `src/store/scheduledSessionSelectionStore.ts` (v2: `moveLedger: Record<originId, { targetDate: YMD; movedAt: number; reason?: string }>` superseding same-week `dateOverrides`; migration maps existing overrides into ledger), `src/hooks/useScheduledSessions.ts` (two-sided projection: for week W hide moved-out, inject moved-in with ORIGINAL prescription + originalDate; consult adjacent weeks' plans via existing week-plan derivation), `src/utils/adaptationWorkflow.ts` (validator: protect deload weeks and taper weeks from receiving added hard load or losing their reduction — uses deloadModel + macroPlan phase; long-run spacing rule; strength-running interaction via axes; duplicate prevention across weeks), `src/utils/training/trainingDecisionEngine.ts` (future-progression recalculation flag when a key session moves), calendar UI (`app/(tabs)/calendar/index.tsx` Reschedule flow now offers cross-week targets THROUGH the preview validator only).

Data contracts: ledger entries keyed by canonical originId (identity independent of date ✔); `ScheduledSession.date` vs `originalDate` continue to carry display vs origin; completion linking (by originId) unaffected.

Migrations: selection store version 1→2 with lossless override→ledger mapping; adaptation history untouched.

Tests: move within week (regression — existing 6 buildNextScheduleIntegration tests keep passing), move across week boundary in/out projection, no duplicate rendering of a moved session in either week, planned history + adaptation history preserved, deload/taper protection conflicts, long-run spacing conflict, hard-day adjacency across the boundary of two weeks, completion of a moved session links correctly and Calendar/Today/Running/Strength agree.

Completion gates: full suite; browser QA of a cross-week move round-trip (move, verify both weeks, complete, verify link, move back).

Must not modify: `scheduledSessionIds.ts` formats (hard rule), dashboard, tab layout.

Risks: HIGHEST-complexity data phase. If two-sided projection proves unsafe within the phase budget, STOP after in-week + one-week-adjacent moves and report — do not ship a partial multi-week ledger silently.

## PHASE 5 — Experience modes + Today cleanup + bottom-nav uniformity

**Objective:** Simple/Balanced/Data-rich app-wide; Today card per product spec; uniform tabs.

Dependencies: none hard; sequenced here so UI reflects Phases 1–4 outputs.

Likely files: EDIT `src/store/settingsStore.ts` (`experienceMode`, default `'balanced'`, additive merge), `app/(tabs)/settings/index.tsx` (APPEARANCE section control); NEW `src/hooks/useExperienceMode.ts` + `src/components/ui/ModeVisible.tsx`; EDIT `app/(tabs)/dashboard/index.tsx` — dominant card keeps name/duration/effort/purpose/Start/View Details; add **More Options** disclosure containing groups: *Adjust today* (Do My Own Workout, Not Feeling 100%, Not Today, Workout Alternatives), *Adjust the plan* (Adapt My Week, Reschedule), *Get help* (Ask AI Coach); REMOVE the literal `'No plan changes today.'` (lines ~361-363) — change banner renders ONLY when `adaptationReason` exists; de-duplicate repeated duration text; EDIT `app/(tabs)/_layout.tsx` + `src/constants/layout.ts` (uniformity audit of TAB_* constants; verify identical box/label/baseline/spacing/padding/touch targets across all six; AI Coach label legible at 320px — adjust `minimumFontScale`/label if needed); apply mode gating across: dashboard (Simple hides forecast/advanced readiness detail), training/index (Data-rich shows zones/load detail), strength, activity detail, analytics entry points, readiness card (Simple = label + one-line guidance only).

Mode matrix (binding): Simple = workout/duration/effort/Start, plain-language readiness, basic schedule, simple progress summary. Balanced = current default with progressive disclosure. Data-rich = adds load detail, pace/HR analysis, planned-vs-completed, detailed readiness, charts, strength volume, block info. Mode affects the entire app — every screen edited must consult the hook, and hidden ≠ deleted (data still computed where cheap, simply not rendered).

Migrations: settings additive.

Tests: mode gating helper logic; settings merge default; a contract test that dashboard action groups match the spec list; nav constants uniformity test (single source of truth exported and asserted).

Completion gates: full suite; browser QA at 320/375/390/430/desktop of Today in all three modes + tab bar; no "No plan changes today" string anywhere (grep test).

Must not modify: engines from Phases 1–4, useScheduledSessions.

## PHASE 6 — Dynamic Training Outlook

**Objective:** Replace the hardcoded Performance Forecast card with a live Training Outlook.

Dependencies: Phases 1–2 (decision engine, deload model, load trends).

Likely files: NEW `src/utils/trainingOutlook.ts` + tests; EDIT `app/(tabs)/dashboard/index.tsx` (card, lines ~428-447 placeholder removed), `src/lib/recalculation.ts` (recompute outlook snapshot on the existing pipeline — triggers: activity create/edit/delete, adaptation confirm, missed sessions, readiness change, deload/phase transitions, event-date change; store snapshot in recalculationStore), optionally `app/(tabs)/performance/index.tsx` link-through.

Contracts: `OutlookStatus = building_foundation | on_track | progressing_cautiously | maintaining | recovery_needed | plan_adjustment_needed | ready_for_current_goal | insufficient_history`; `LoadState = recovering | stable | building | ramping_quickly | deloading | returning | insufficient_data`. Inputs: macroPlan phase/week, decision engine output, `calculateActivityLoadTrend`, readiness v4, historyWeeks + confidence from forecastEngine, event date. **No unsupported race-ready dates**: date-bearing claims only when forecast confidence ≥ explicit threshold AND historyWeeks sufficient; otherwise qualitative status only.

Tests: status/load-state derivation matrix incl. both insufficient states; update-trigger coverage via recalculation reason codes; no-date-claim guard.

Completion gates: full suite; browser QA showing real derived values; placeholder constants gone (grep test).

Must not modify: forecastEngine internals beyond exposing inputs; coach budget (Phase 12 wires outlook into coach).

## PHASE 7 — Searchable history + shoes & equipment + achievements

**Objective:** Search/filter across Activity history; gear tracking; restrained achievements.

Dependencies: none hard (after Phase 5 for mode gating patterns).

Likely files: NEW `src/store/gearStore.ts` (persisted, `createAppJSONStorage()`), `src/utils/gear.ts` (derived mileage from activities; most-used shoe), `src/utils/activitySearch.ts` (pure predicate builder), `src/utils/achievements.ts` + `src/store/achievementStore.ts`; EDIT `src/types/activity.ts` (`shoeId?: string`, `gearIds?: string[]` — additive), `app/(tabs)/activity/index.tsx` (FlatList virtualization replaces ScrollView map; search input + filter sheet), activity save/edit flows (shoe picker w/ default shoe), NEW gear screens under More (`app/(tabs)/more` grid entry → gear list/detail/add), achievement surfacing (quiet card on Today or More — restrained).

Contracts: `Shoe { id, brand, model, addedAt, active, typicalUse, surface, notes, reminderThresholdMiles? }` (mileage always derived); `EquipmentItem { id, kind: 'hr_strap'|'bike'|'trainer'|'treadmill'|'foot_pod'|'cadence_sensor'|'power_meter'|'other', name, notes, blePeripheralId? }` (the `blePeripheralId` field is the Phase 11 linkage — add now, unused). Search filters: type, date range, distance, duration, shoe, route, workout type, treadmill, indoor/outdoor, strength, mobility, cross-training, training block, RPE, completion status, modified/substitute/partial/stopped-early. Achievements: exactly the healthy set (Long Run Builder, Easy Means Easy, Strong Strides, Recovery Master, Consistency, Smart Adjustment, Back in Rhythm, Balanced Training) — no rankings/streak-shaming/rest punishment; achievement copy never claims a shoe is "unsafe" on mileage (reminder copy: "consider checking wear").

Migrations: new stores (fresh); Activity fields additive; no version bumps.

Tests: mileage derivation across add/edit/delete (delete removes miles); most-used shoe; search predicate matrix (each filter + combinations); achievement award/no-award cases incl. anti-patterns (no award loss for resting); virtualized list logic extracted where testable.

Completion gates: full suite; browser QA: search + filters at 320px, gear CRUD, mileage updates after activity edit/delete.

Must not modify: engines, adaptationWorkflow.

## PHASE 8 — The Stride Report + sharing

**Objective:** Weekly/Monthly/Yearly reports; three share cards; privacy-safe defaults.

Dependencies: Phase 7 (most-used shoe/route feed the report).

Likely files: NEW `src/utils/strideReport.ts` (pure aggregation) + tests, `app/(tabs)/more/stride-report.tsx` (or activity-adjacent route; register in More grid), `src/components/report/` (report views + `ShareCardCleanSummary.tsx`, `ShareCardDataFocus.tsx`, `ShareCardAchievementFocus.tsx`), `src/lib/shareCard.ts` (Skia `makeImageFromView` snapshot → `expo-file-system` cache file → RN `Share.share`; formats 9:16, 4:5, 1:1 via fixed-size offscreen containers).

Report math (binding): Distance — total, average per qualifying run, longest run + title/date. Elevation — total, average across activities WITH valid elevation only, highest-elevation activity + title/date; treadmill and missing-elevation activities are EXCLUDED from elevation averages (never counted as zero). Highlights (data-permitting, don't overload): training time, runs, active days, strength, cross-training, mobility, adherence, most-used shoe, most-used route, comparable pace change, comparable HR-efficiency change, healthy consistency. Weekly may include a short upcoming-plan focus; Monthly/Yearly strictly retrospective. Privacy defaults: never auto-include route maps, exact locations, symptoms, readiness detail, private notes, health information.

Migrations: none.

Tests: aggregation math incl. the elevation-exclusion rule (treadmill run present → excluded from average, absent from highest), qualifying-run rules, empty/sparse-data handling per period, retrospective-only guard for monthly/yearly, privacy-default contract test (share payload builder excludes banned fields).

Completion gates: full suite; browser QA of all three report periods and three card designs (web fallback for Skia snapshot may be an honest "sharing available on device" state — do not fake it); native snapshot path type-checked and unit-covered, flagged for device QA.

Must not modify: engines; dashboard beyond a report entry link.

## PHASE 9 — Voice-coaching overhaul

**Objective:** Reliable, observable voice delivery with levels, categories, and a test function.

Dependencies: none hard.

New dependency: `expo-audio` (via `npx expo install expo-audio`) for AVAudioSession configuration (duck-others, play-in-silent-mode, interruption handling). JS-managed, config-plugin safe.

Likely files: NEW `src/lib/voiceCoach.ts` (event bus + priority queue + per-category cooldown + delivery pipeline: setting-check → trigger → prompt → audio-session ensure → speak → confirm/fail), NEW `src/store/voiceLogStore.ts` (ring buffer of `{ cueId, category, text, state: 'played'|'queued'|'suppressed'|'cooldown'|'failed'|'unavailable', at }`, small persisted cap); EDIT `src/lib/voiceCue.ts` (becomes thin shim over voiceCoach for compatibility), all emit sites to pass correct categories (`training/index.tsx` speakCue wrapper gains category param — fixes the everything-is-'motivation' defect; interval/pace/heartRate/fueling/hydration/navigation properly tagged), `src/utils/voiceCoaching.ts` (category relevance per activity type — only show/emit relevant categories for current activity), `app/(tabs)/settings/index.tsx` (**Test Voice Coaching** button playing a sample through the full pipeline and surfacing the delivery state; category list filtered to relevant), `src/utils/voiceCoachingEngine.ts` (fold the parallel/legacy HR engine into one path or delete after migrating consumers — consolidation, not duplication).

Contracts: levels stay `silent | minimal | standard | coach` (existing store field, migration-safe defaults preserved); categories extend existing 8 with `navigation` (additive union + settings merge).

Migrations: settings additive (navigation pref default true); voiceLogStore new.

Tests: queue priority/cooldown/suppression logic; category gating per level (existing voiceCoaching tests extended); relevance-per-activity matrix; delivery-state transitions incl. failure and unavailable (web); shim compatibility.

Completion gates: full suite; browser QA (web = honest `unavailable` state, settings render, test button reports unavailable); **real-device audio validation is REQUIRED before release and is deferred to the final audit — flag it in the phase report**.

Must not modify: Live Activity module (Phase 10), BLE (Phase 11).

## PHASE 10 — Live Activity & Lock Screen improvements

**Objective:** Instance-correct lifecycle; per-activity layouts; sizing audit.

Dependencies: Phase 9 complete (avoid simultaneous edits near run screens).

Likely files: EDIT `modules/stride-live-activity/src/index.ts` + `ios/Module/StrideLiveActivityModule.swift` + `ios/Core/*.swift` (thread `workoutInstanceId` into Attributes/sessionId for run, outdoor, strength paths; REFACTOR start/update bridge from 22 positional args to a single dictionary payload — Swift `[String: Any]` with defensive decoding — this ends the lockstep fragility), `src/lib/{runLiveActivity,strengthLiveActivity,liveActivityContracts}.ts` (instanceId in snapshot + command session matching), `src/components/liveActivity/LiveActivityCommandReconciler.tsx` (sessionId = workoutInstanceId), `targets/StrideRunLiveActivity/StrideRunLiveActivity.swift` (layout variants: extend the parameterized run view with per-type metric configs for outdoor run, treadmill — no pace-from-GPS, show estimate label —, run/walk — interval state prominent —, intervals — step/next —, walking, indoor cycling, outdoor cycling, mobility/active recovery/cross-training — minimal timer layouts; strength + custom strength on the strength widget; each shows only pertinent metrics), sizing audit (keep the documented one-header/one-metric-row/one-action-row + `minimumScaleFactor` discipline; verify no clipping at smallest lock-screen widths).

Lifecycle rules (binding): every workout start creates a NEW activity keyed by `workoutInstanceId`; ending/clearing one never blocks the next (the existing end-before-start pattern already guarantees this — add a regression test on the TS contract and keep it); stale commands from a previous instance are rejected by instance match.

Migrations: none (contract is process-local).

Tests: contract normalization with instanceId; command session matching accept/reject by instance; dictionary-payload encode/decode round-trip on the TS side; layout metric-config selection per activity type (pure TS config → testable).

Completion gates: typecheck (Swift changes at minimum must parse — run `swiftc -parse` on edited Swift files as prior builds did); full JS suite; web export; **device QA required (Dynamic Island, lock screen, both widgets) — deferred to final audit, flag in report**.

Must not modify: BLE, engines.

Risks: positional→dictionary bridge refactor breaks silently on device — mitigate by keeping Swift decode defensive with defaults and by device QA before release; if the refactor jeopardizes the schedule, thread instanceId through the existing positional contract instead and log the refactor as deferred.

## PHASE 11 — Native Bluetooth equipment support

**Objective:** FTMS treadmill/trainer, BLE HR, foot pod (RSC), cycling speed/cadence (CSC), power meter — with arbitration, honesty, and manual fallback.

Dependencies: Phases 7 (equipment registry), 10 (LA stable). LAST feature phase — highest native risk.

New dependency: `react-native-ble-plx` + its Expo config plugin in `app.json` plugins (adds `NSBluetoothAlwaysUsageDescription`; add `bluetooth-central` background mode ONLY if in-workout background streaming requires it — start foreground-only if adequate).

Likely files: NEW `src/lib/ble/manager.ts` (dynamic-require + Platform guard per healthKit.ts pattern; lifecycle: scan/connect/reconnect-with-backoff/disconnect), `src/lib/ble/profiles/{ftms.ts,heartRate.ts,rsc.ts,csc.ts,power.ts}` (PURE byte parsers: FTMS Treadmill Data 0x2ACD & Indoor Bike Data 0x2AD2, HR 0x2A37, RSC 0x2A53, CSC 0x2A5B w/ wheel-rev delta + rollover, Cycling Power 0x2A63), `src/lib/ble/arbiter.ts` (per-metric preferred source; priority e.g. distance: ftms/foot-pod/wheel > confirmed-speed estimate > manual; HR: BLE strap > HealthKit poll; staleness detection — no packet beyond per-profile window → stale → next source or honest gap; dropout events; ALL emitted values carry source metadata mapping to existing `DistanceSource` values `trainer_reported | wheel_sensor | foot_pod | treadmill_reported`), NEW pairing UI (settings or gear detail: discovery list, pair, name, link to `EquipmentItem.blePeripheralId`, preferred-source selection), EDIT treadmill live flow (`training/index.tsx` treadmill panel consumes arbited speed/distance — FTMS-reported replaces confirmed-speed estimate WITH source label change; manual correction flow retained), indoor ride (`activity/indoor-ride.tsx` consumes trainer/power/cadence; equipment-distance entry retained as fallback), completion writers stamp the arbited `distanceSource`.

Honesty invariants (tests enforce): NEVER cycling distance from HR; NEVER distance from power alone; estimates NEVER labeled as measured (source metadata drives labels); when all sources drop, UI shows the gap honestly and offers manual fallback.

Migrations: gearStore `blePeripheralId` already present (Phase 7); integrationsStore untouched.

Tests (all pure, binary fixtures): each profile parser against captured/synthesized packets incl. flag permutations and malformed frames; CSC rollover; arbitration priority/staleness/dropout/fallback matrix; source-metadata stamping per path; honesty invariants.

Completion gates: full suite; web export (web = feature honestly unavailable); typecheck; **prebuild config verified (`npx expo prebuild --platform ios --no-install` dry-check must succeed with the plugin); real-device pairing + streaming QA REQUIRED before release — deferred to final audit, flagged**.

Must not modify: buildNumber, eas.json; no other native deps.

## PHASE 12 — Integration, AI Coach context, full QA sweep

**Objective:** Wire new signals into AI Coach within budget; final cross-system consistency; complete web QA.

Dependencies: all prior phases.

Likely files: EDIT `app/(tabs)/coach/index.tsx` (new sections: training outlook, weekly decision + rationale, gear notes, recent achievements — ALL as priority ≥ 8, non-required, with `compact` variants per coachPromptBudget rules), `src/utils/coachPromptBudget.ts` untouched unless a test proves envelope violation; consistency pass: Today/Calendar/Running/Strength/Activity/Coach/voice/Live Activity all resolve identical sessions after cross-week moves + decisions (extend `scheduledSessionArchitecture.test.ts`); docs `docs/build45-web-qa.md` (per-screen × width matrix incl. all new screens: gear, report, share previews, outlook, modes × Today, search, pairing UI web-fallback).

Tests: coach budget stays ≤ envelope with all new sections present (existing coachPromptBudget tests extended); end-to-end consistency suite.

Completion gates (= Codex handback gates): typecheck clean; FULL test suite green; `npx expo export --platform web` green; `npm run expo:check` green; `git diff --check` clean; browser QA doc complete at 320/375/390/430/desktop; working tree contains ONLY intended changes (no commits made); phase-by-phase report delivered.

---

## Native-risk register (for the final audit)

| Area | Risk | Device validation required |
|---|---|---|
| expo-audio session (P9) | ducking/silent-switch behavior device-only | Voice audible during run w/ music; interruption recovery; Test button |
| Live Activity contract/layouts (P10) | positional→dictionary bridge; widget sizing | Both widgets, Dynamic Island states, per-type layouts, no clipping |
| react-native-ble-plx + plugin (P11) | prebuild integrity; background modes; pairing UX | Scan/pair/stream each profile; dropout/reconnect; arbitration switch |
| Prebuild (CNG) | plugins must survive `expo prebuild` | Dry prebuild in P11 gate + real EAS build at release |

## Release sequence (final 10% — Fable only, after audit passes)

1. Verify Build 44 TestFlight state in App Store Connect (was it submitted? processing?).
2. Full independent audit per `docs/build45-final-audit-checklist.md`.
3. Device QA items from the native-risk register.
4. Bump `ios.buildNumber` → 45 ONLY after EAS/TestFlight show 45 unused.
5. Commit ("StrideOS Build 45 — …"), push, `eas build --platform ios --profile production`, then `eas submit --platform ios --id <exact-build-id>` with explicit user authorization at each release action.
