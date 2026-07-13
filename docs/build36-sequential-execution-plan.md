# Build 36 — Sequential Execution Plan (Fable 5, principal architect)

Branch: `build-19-v3-foundation` · Date: 2026-07-12
Execution order: **Sonnet 5 first → Codex 5.6 High second.** Codex is also the final integrator and validator.
Hard rules for both models: do not commit, do not run EAS, do not discard/reset/clean any existing uncommitted work, do not modify any PNG or anything under `assets/movement-lab/` (read-only reference system), read AGENTS.md (Expo SDK 56 — verify APIs against https://docs.expo.dev/versions/v56.0.0/; read `assets/movement-lab/dion/DION_CANONICAL_REFERENCE.md` before touching Dion imagery).

---

## 1. Current-state audit (verified 2026-07-12)

**Dion asset system (new, complete, read-only):**
- 32 approved PNGs (864×1821 portrait) across 13 assessment folders under `assets/movement-lab/assets/`, each folder with a README contract.
- Central manifest `assets/movement-lab/assets/movement_image_manifest.json` (32 entries, all `status: approved`, per-asset view/position/requiredVisibleJoints/allowed+omitted measurements).
- Canonical identity: `assets/movement-lab/dion/DION_CANONICAL_REFERENCE.md` + 3 reference PNGs + `dion_asset_manifest.json`.
- Specification system: `assets/movement-lab/specifications/` (camera_rules, measurement_rules, branding_rules, design system, movement_asset_manifest). The in-app measurement matrix must agree with `measurement_rules.md`.

**Partial Build 36 application work already in the working tree (uncommitted — PRESERVE AND FINISH, do not redo):**
- Data/engine layer (done): `src/types/movement.ts` (kinds split: `single_leg_control` + `lunge`, deprecated `lunge_single_leg` retained; `closestSide`/`closestSideSource`), `src/types/movementReadiness.ts` (`symptom` field), `src/utils/measurementMatrix.ts` (NEW — movement×view permission matrix, closest-side detection, `normalizeAnalysisKind`), `src/utils/poseAngles.ts` (frontal-plane metrics: pelvic obliquity, frontal knee position, trunk lateral lean), `src/utils/poseSequence.ts`, `src/utils/movementEngine.ts` (six-kind ANALYSIS_KIND_INFO with categories, evidence-language cleanup, CoachHandoff.closestSide), `src/utils/readinessEngine.ts` (symptom arg, auto single-leg scoring), `src/store/movementStore.ts` (legacy-kind migration in persist merge).
- Capture/UX layer (partial): `src/constants/dionImages.ts` (NEW — 17-key registry, **all image slots null; must be rewired to the 32 real assets**), `src/constants/captureConfig.ts`, `src/utils/mediaValidation.ts`, `src/components/movement/DionInstructionCard.tsx` (placeholder-only rendering today), `src/components/movement/TimedCaptureCamera.tsx` (5s countdown + auto start/stop), `CaptureGuidanceCard.tsx` rewritten, `CaptureSilhouette.tsx` deleted (stick figure removed), `app/(tabs)/movement/index.tsx` (six-analysis taxonomy home), `app/(tabs)/movement/analyze.tsx` (timed capture + validation wiring, mid-flight), `package.json` (+expo-camera).
- Coach/cleanup layer (mostly done): `app/(tabs)/coach/index.tsx` (Video-tab upload workflow and "COMING SOON" card removed; `analysisId` focused-analysis system-prompt block; `ask` prefill), `app/(tabs)/movement/analysis-detail.tsx` (coach sender params), `app/(tabs)/training/index.tsx` (Apple Music "Connect Music" row + styles removed — Apple Music footprint is now zero).
- Tests: only `src/utils/__tests__/mediaValidation.test.ts`. No test runner wired (`tsx` devDep + `test` script missing).

**Known defects in the partial work (5 typecheck errors):**
1. `app/(tabs)/movement/analyze.tsx:191` — KIND_CAMERA_VIEW record missing `lunge_single_leg` index (normalize kind before indexing).
2. `app/(tabs)/movement/readiness-test.tsx:398` — CaptureGuidanceCard props changed; readiness-test not yet migrated.
3. `src/components/movement/AngleChart.tsx:175` — impossible comparison (mid-rewrite artifact).
4–5. `src/utils/__tests__/mediaValidation.test.ts` — node types not configured.

**Not started:** video/chart synchronized workspace (`video-analysis.tsx` untouched), readiness 7-step rebuild (`readiness-test.tsx`, `readiness.tsx`, `readiness-report.tsx` untouched), `[videoId].tsx` coach sender, real Dion asset wiring, ACWR definition, analytics Consistency clipping, remove-from-today, custom-workout name input fix, fueling/hydration rework, exercise-library expansion (mobility bank has 10 workouts; no preset strength bank exists), sweep/regression tests, dependency/test-runner setup, app.json camera/mic permissions for expo-camera.

## 2. Existing completed work (keep as-is unless a listed defect requires a fix)

Measurement matrix + frontal metrics + taxonomy migration + evidence-language cleanup + coach focused-handoff + Apple Music removal + stick-figure removal + timed-capture component + media validation + capture config + six-analysis home. `git diff --check` is clean.

## 3. Remaining Build 36 scope → owner map

| Scope | Item | Owner |
|---|---|---|
| A | Movement Lab IA polish (readiness top, six analyses, saved analyses/video workspace below, no redundant entry layers) | Sonnet |
| B | Dion production images: manifest-driven registry rewire, real `require()` assets, aspect-ratio-safe rendering, load fallback | Sonnet |
| C | Recording workflow hardening: state machine, auto start/stop, wiring into standalone + readiness flows, 30s import cap, specific media errors, supported-type guidance | Codex (visual copy pre-exists) |
| D | View-specific measurement enforcement in remaining screens (video-analysis, analyze, readiness-test), closest-side UI, "Estimated" labels | Codex |
| E | Readiness automation: 7-step flow rebuild, auto single-leg checklist first + confirm/unclear/override, honest knee-to-wall & heel-raise handling | Codex (flow) / Sonnet (intro + report presentation) |
| F | Video↔chart synchronization workspace | Codex |
| G | AI Coach: `[videoId].tsx` sender, prompt-limit truncation, readiness handoff compaction, no empty prompt/navigation | Codex |
| H | ACWR plain-language definition + Analytics Consistency label clipping fix | Sonnet |
| I | Remove-custom-run-from-today ("Not Today") behavior; custom-workout name input visibility | Codex (behavior) / Sonnet (name-input UX in run-creator) |
| J | Fueling/hydration: interval config, "/hr" units, mg/L vs mg/hr separation, plan-primary layout, 0.01mi + 1min editing, weather manual/current-location, info affordances, reset/recalculate | Sonnet (screen) / Codex (engine + reminder plumbing) |
| K | 50 mobility workouts, 50 preset strength workouts (≥15 traditional gym), category organization, adaptive plan stays primary | Sonnet (content + cards) / Codex (types sanity, store integration, validation tests) |
| L | Apple Music: already removed — Codex verifies zero references in final sweep; expo deps audit | Codex |
| M | Regression protection + tests + final validation | Codex |

## 4. Sonnet 5 file ownership (pass 1 — exact list)

Sonnet edits ONLY these files. If a change seems to require another file, document it in the handoff instead of editing.

1. `src/constants/dionImages.ts` — **rewire to real assets.** Replace the null-placeholder registry with a manifest-driven structure:
   ```ts
   export type DionAssessmentId = /* the 13 assessmentIds from movement_image_manifest.json */;
   export type DionPhaseImage = { assetId: string; image: number; position: string; alt: string };
   export type DionAssessmentImages = {
     assessmentId: DionAssessmentId;
     viewLabel: 'Direct lateral' | 'Direct frontal' | 'Direct posterior' | 'Close lateral framing' | 'User-selected view';
     mustBeVisible: string[];          // from manifest requiredVisibleJoints, humanized
     recommendedDistance: string;
     primary: DionPhaseImage;          // the instructional hero (start/setup phase)
     phases: DionPhaseImage[];         // all approved phases for this assessment
   };
   export const DION_ASSESSMENT_IMAGES: Record<DionAssessmentId, DionAssessmentImages>;
   export function dionImagesForKind(kind: MovementAnalysisKind, view?: MovementViewAngle): DionAssessmentImages;
   export function dionImagesForReadinessStep(stepKey: 'squat_side'|'single_leg_squat'|'split_stance_lunge'|'knee_to_wall'|'heel_raise'|'gait_side_view', focus: 'running'|'walking'): DionAssessmentImages;
   ```
   Static `require('../../assets/movement-lab/assets/<folder>/<file>.png')` for every one of the 32 assets (React Native static bundling — no dynamic paths). Alt text from the manifest/READMEs. Keys map: standalone_* → kinds; readiness_* → steps; gait step picks easy_running vs walking by focus. Keep a `symptom_review` entry with `image` omitted/null-safe (no asset exists — it is the only assessment without one; the card copy carries it). Do NOT modify PNGs or manifests.
2. `src/components/movement/DionInstructionCard.tsx` — render real images: `resizeMode="contain"` inside a fixed aspect-ratio (864:1821) container so no required joint is cropped; `onError` fallback to the existing structured placeholder; accessibilityLabel = alt; compact thumbnail variant for list cards; optional phase strip (start/bottom etc.) when more than one phase exists.
3. `src/components/movement/CaptureGuidanceCard.tsx` — accept `DionAssessmentImages`, keep instructions + must-be-visible presentation. **Contract for Codex:** final props are `{ dion: DionAssessmentImages; instructions: string[]; mustBeVisible?: string[] }` (mustBeVisible defaults from `dion`). Codex will migrate `readiness-test.tsx` to this.
4. `app/(tabs)/movement/index.tsx` — IA polish only: readiness entry at top; six standalone analyses with category labels and Dion thumbnails from the new registry; saved analyses; legacy video workspace demoted at bottom; remove any leftover redundant entry layers. No logic changes.
5. `app/(tabs)/movement/readiness.tsx` — intro screen: Dion imagery via registry, seven-step overview, focus selection copy.
6. `app/(tabs)/movement/readiness-report.tsx` — presentation: render `symptom` (intensity/location/notes) with consult-a-clinician copy when present; old assessments without `symptom` must render; keep "Ask AI Coach" button semantics (short `ask` param only).
7. `src/constants/trainingDefinitions.ts` — add plain-language ACWR definition: acute workload, chronic workload, ratio interpretation zones, limitations, explicitly not a direct injury predictor ("may be associated with" language only). Follow the existing definition-entry shape in that file.
8. `app/(tabs)/analytics/index.tsx` — fix the Consistency chart Y-axis label clipping (layout/label sizing); add an info affordance surfacing the ACWR definition next to the training-load section. Presentation only — do not change calculations.
9. `app/(tabs)/training/run-creator.tsx` — fix custom-workout name input so text is visible while typing (color/contrast/height defect). UX-only.
10. `app/(tabs)/training/hydration.tsx` — visual/UX rework: Hydration Plan becomes the primary visual; sweat-test/personalization inputs move above downstream recommendations; distance editing in 0.01-mile steps and duration in 1-minute steps; manual location/weather entry + "use current location" restore; retain prior inputs on return (persist via existing store patterns already used by the screen — if none exists, keep component state and document the gap for Codex); info affordances (tap-for-explanation) for sweat rate, saltiness, cramping, fluid comfort, GI tolerance; reset + recalculate controls; fueling-reminder interval selector reading `FUELING_REMINDER_INTERVALS` from `src/constants/hydrationConfig.ts`; every per-hour unit rendered as `/hr`; never render a concentration (mg/L) as an hourly amount.
11. `src/constants/hydrationConfig.ts` — NEW: `export const FUELING_REMINDER_INTERVALS = [15, 20, 30, 40] as const;` (minutes), default 20; the info-affordance copy strings; unit-label constants (`'/hr'`). Codex wires reminders/engine to this file.
12. `src/constants/mobilityBank.ts` — expand `MOBILITY_WORKOUTS` from 10 to **50 total**; add supporting `MOBILITY_EXERCISES` as needed. NEVER change or remove existing workout/exercise ids (readiness recommendations reference them). Cover the existing category taxonomy; evidence-safe copy.
13. `src/constants/strengthBank.ts` — NEW: 50 preset strength workouts as self-contained data (do not import stores):
    ```ts
    export type StrengthEquipment = 'barbell'|'squat_rack'|'bench'|'dumbbell'|'kettlebell'|'band'|'bodyweight';
    export type StrengthPresetCategory = 'recommended'|'full_body'|'upper_body'|'lower_body'|'runner_strength'|'gym_barbell'|'dumbbell'|'kettlebell'|'bodyweight'|'pre_run'|'post_run_recovery'|'problem_area';
    export type PresetStrengthExercise = { name: string; sets: number; reps: string; equipment: StrengthEquipment[]; notes?: string };
    export type PresetStrengthWorkout = { id: string; title: string; description: string; durationMin: number; equipment: StrengthEquipment[]; categories: StrengthPresetCategory[]; exercises: PresetStrengthExercise[] };
    export const STRENGTH_PRESET_WORKOUTS: PresetStrengthWorkout[];      // exactly 50
    export const STRENGTH_PRESET_CATEGORY_LABELS: Record<StrengthPresetCategory, string>;
    ```
    ≥15 workouts must be gym/barbell-based using combinations of barbell, squat rack, deadlift patterns, and bench; the rest dumbbell/kettlebell/band/bodyweight. Ids stable `sw_<slug>`.
14. `app/(tabs)/strength/index.tsx` — **shared file, Sonnet first** (see §6): add the preset-library presentation (category sections mirroring the mobility library pattern, cards, "recommended for you" section) while keeping the adaptive training plan as the separate primary option at the top. Read-only consumption of `STRENGTH_PRESET_WORKOUTS`; do not modify strengthStore or engines.

## 5. Codex 5.6 file ownership (pass 2 — exact list)

1. `app/(tabs)/movement/video-analysis.tsx` — build the synchronized workspace (largest item): video above charts; shared playhead; scrubber/chart drag seeks video; playback drives chart playheads; current values + min/max + key-frame values all "Estimated"; matrix-filtered series (`filterAngleSeries`); closest-side chooser persisted when `determineClosestSide` is low/null; inline saved angle-series fallback when the raw pose file is unavailable; coach sender params (`ask` + `analysisId`).
2. `src/components/movement/AngleChart.tsx` — finish the mid-flight rewrite (fix the line-175 defect): playhead marker (`currentTimeMs`), `onSeekMs`, Y-axis degrees, X-axis seconds, min/max annotation, labels sized for small iPhones.
3. `src/components/movement/VideoScrubBar.tsx` — key-frame markers/seek integration as needed.
4. `app/(tabs)/movement/analyze.tsx` — fix TS error (normalize kind before KIND_CAMERA_VIEW index); wire TimedCaptureCamera + mediaValidation end-to-end; pre-selection guidance (recommended/max length, supported types); matrix-filtered display/save; closest-side prompt; migrate to the new `dionImagesForKind` registry API and final CaptureGuidanceCard props.
5. `app/(tabs)/movement/readiness-test.tsx` — rebuild to the 7-step Build 36 battery: (1) Bodyweight Squat lateral video; (2) Single-Leg Squat frontal — automatic assessment FIRST (kind `single_leg_control`), then confirm / unclear / override-with-reason / note (no pre-analysis manual questions); (3) Split-Stance Lunge lateral (kind `lunge`, "Perform 3–5 controlled repetitions per side."); (4) Knee-to-Wall manual L/R cm + asymmetry (no automatic dorsiflexion claims; optional video attachment allowed, angles labeled estimates); (5) Single-Leg Heel Raise manual L/R reps (data model carries optional quality-rep fields, never fabricated — heel-height automation is NOT currently supportable: no heel/toe landmarks); (6) gait step titled dynamically "Easy Running Gait"/"Walking Gait", 10–15s; (7) Symptom Review (No symptoms / Yes → 0–10 intensity, body location, optional notes → `assessReadiness` symptom arg). Timed capture + validation on every video step; Dion cards via `dionImagesForReadinessStep`.
6. `src/components/movement/TimedCaptureCamera.tsx` + `src/constants/captureConfig.ts` — harden the recording state machine (permission denial, backgrounding, cancel during countdown, auto-stop reliability, retake).
7. `src/utils/mediaValidation.ts` — verify error mapping (too_long/unsupported_type/too_large/icloud_unavailable/unreadable/decode_failed) against real picker metadata.
8. `src/utils/measurementMatrix.ts`, `poseAngles.ts`, `poseSequence.ts`, `movementEngine.ts`, `readinessEngine.ts`, `src/store/movementStore.ts` — reconcile against `assets/movement-lab/specifications/measurement_rules.md` (it is the authority); fix anything the sync workspace or readiness rebuild surfaces.
9. `app/(tabs)/movement/[videoId].tsx` — coach sender (`ask` only, no fabricated analysisId); legacy-record rendering audit.
10. `app/(tabs)/coach/index.tsx` — verify focused-analysis block + readiness handoff stay under prompt limits; intelligent truncation preserving most-important findings; no empty prompt/navigation states.
11. `src/utils/hydrationEngine.ts` — every per-hour output "/hr" (fix `oz/h`, `carbs/h`, `sodium/h` at ~lines 341–343); keep mg/L (concentration) strictly separate from mg/hr (hourly intake); expose recalculation entry points the screen needs; consume `FUELING_REMINDER_INTERVALS`/default from `src/constants/hydrationConfig.ts`.
12. Fueling reminder plumbing — persist chosen interval and schedule reminders at it (locate the existing reminder mechanism: `src/lib/notifications.ts` / settings store; add the minimal store field with a rehydrate default of 20).
13. `src/store/customWorkoutStore.ts` + `app/(tabs)/training/index.tsx` — "Not Today": remove a selected custom run from today without deleting the saved route/workout; restore the scheduled/default run; wording "Not Today" or "Remove from Today".
14. Strength preset integration — wire `STRENGTH_PRESET_WORKOUTS` into launch/logging using existing strength session/history types (adaptive plan remains primary); validation test asserting 50 presets, ≥15 gym/barbell, unique ids, non-empty exercises.
15. `app.json` — expo-camera plugin entry with camera + microphone permission strings (currently missing; required for TimedCaptureCamera).
16. `package.json` — devDeps `tsx` + `@types/node`; script `"test": "tsx --test src/utils/__tests__/*.test.ts scripts/tests/*.test.ts"`; dependency audit (expo-camera stays; remove nothing shared).
17. `scripts/tests/` — NEW sweep + regression tests: forbidden-language, no 45° UI text, Apple Music zero-reference, no stick-figure component, Dion registry ↔ manifest integrity (all 32 relativePaths required and present on disk), measurement-matrix permissions, closest-side, legacy-kind migration, coach-handoff size bound, strength/mobility bank counts.
18. `src/types/*` — only as integration requires; never remove deprecated members that persisted data relies on.
19. Fix remaining typecheck errors including the test node-types configuration (prefer `@types/node` devDep; adjust tsconfig `types`/`include` minimally if needed).

## 6. Shared files — sequential ownership order

| File | First editor | Second editor | Rule |
|---|---|---|---|
| `app/(tabs)/strength/index.tsx` | Sonnet (preset library presentation) | Codex (store/launch integration + fixes) | Codex may edit during final integration; must preserve Sonnet's layout intent |
| `src/constants/strengthBank.ts` | Sonnet (creates, 50 presets) | Codex (type/data corrections only) | Codex may not rewrite content wholesale |
| `src/constants/dionImages.ts` | Sonnet (rewires to real assets) | Codex (only if an API gap blocks analyze/readiness wiring) | API is pinned in §4.1; Codex documents any change |
| `src/components/movement/CaptureGuidanceCard.tsx` / `DionInstructionCard.tsx` | Sonnet | Codex (integration fixes only) | Props contract pinned in §4.3 |
| `app/(tabs)/training/hydration.tsx` | Sonnet (full UX rework) | Codex (engine wiring, reminder plumbing, correctness fixes) | Codex must not restructure the layout |
| `app/(tabs)/movement/readiness-report.tsx` | Sonnet | Codex (data-wiring fixes only) | — |
| `package.json` | — | Codex only | Sonnet must not touch (expo-camera already added) |

Everything else in §4 is Sonnet-only; everything in §5 is Codex-only. No file may be edited by both models without the order above. After Sonnet's pass, typecheck MAY be temporarily broken in Codex-owned callers; Codex must end with typecheck clean.

## 7. Files neither model may change

- `assets/movement-lab/**` — all PNGs, manifests, specifications, READMEs (read-only contract; do not regenerate, resize, or edit images this pass)
- `modules/stride-pose/**`, `modules/stride-live-activity/**` (native), `ios/**`, `targets/**`, `eas.json`, `supabase/**`
- `docs_ai_os/**`, `StrideOS_Fable5_Build_Authority_Pack/**`, `AGENTS.md`, `CLAUDE.md`
- Any file not listed in §4/§5/§6 unless a defect is documented in the handoff and the fix is deferred to Codex final integration
- Never run `git reset/checkout/clean` against existing uncommitted work

## 8. Data-model changes

Already landed (keep): `MovementAnalysisKind` +`single_leg_control`/`lunge` (deprecated `lunge_single_leg` retained in union); `MovementAnalysis.closestSide/closestSideSource`; `CoachHandoff.closestSide`; `ReadinessAssessment.symptom?: { intensity: number; location: string; notes?: string }` alongside `painReported`.

New this pass: fueling-reminder interval (persisted, default 20 min); heel-raise optional structured fields on the readiness test result's `manualValues` (e.g. `qualityReps`, `declineOnsetRep` — optional, only user-entered); custom-workout "not today" flag/override (store-level, non-destructive to the saved workout); preset strength workout data (static constants, not persisted); no schema changes to persisted strength history beyond linking a preset id if the existing record shape allows an optional field.

## 9. Migration requirements

- All new persisted fields optional with rehydrate defaults (pattern: `movementStore` `merge`).
- Legacy `lunge_single_leg` records: already migrated by camera view on rehydrate — Codex regression-tests this.
- Build 32 stills / Build 34 videos / Build 35 relative media paths (`resolveDocumentUri`) must render unchanged; corrected/auto landmarks, reference frames, pose-sequence files, saved findings, readiness history all preserved.
- Old readiness assessments without `symptom` render without crashes.
- No renames/removals of mobility workout ids or any persisted enum value.

## 10. Acceptance criteria

Movement Lab: readiness at top; six separate analyses (Single-Leg Control ≠ Lunge, never "Lunge / Single-Leg"); saved analyses + video workspace below; every assessment/step shows the correct approved Dion image (right movement, phase, view) from the central registry with no cropped required joints and a safe load fallback; no stick figures; no duplicated image paths.
Capture: visible 5-s countdown → auto-start → movement-specific duration → auto-stop; import cap 30 s; supported-type guidance shown before selection; specific errors for unsupported/oversized/unreadable/too-long/iCloud/decode-failed; retake works; no live pose overlay during recording.
Measurements: lateral = closest limb only (both-limb curves never shown from lateral); frontal/posterior = bilateral metrics only; no sagittal knee flexion as primary from frontal; no frontal pelvic control from lateral; no elbow/wrist metrics on lower-body assessments; no 45° views anywhere in UI; every automatic angle labeled "Estimated"; no ankle-angle or footstrike claims; manual review + marker correction retained.
Sync: video above charts; scrub/chart-drag/key-frame seek all bidirectional; current values update with playhead; gaps stay gaps; inline series fallback when the pose file is missing.
Readiness: 7 steps per §5.5; single-leg auto-assessed first with confirm/unclear/override/note; knee-to-wall manual cm with asymmetry; heel raise honest; gait label dynamic; symptom review captured and reported.
AI Coach: "Discuss with AI Coach" opens a short editable prefilled prompt (<300 chars) with full structured context passed internally under the prompt limit with intelligent truncation; never empty navigation.
Analytics/definitions: ACWR definition present, plain-language, not an injury predictor; Consistency label not clipped.
Running workflow: "Not Today" removes custom run from today without deleting it and restores the default; custom-workout name visible while typing.
Fueling/hydration: interval options 15/20/30/40; "/hr" everywhere; mg/L never shown as hourly; plan primary; 0.01-mi and 1-min editing; manual + current-location weather with restore; inputs retained; info affordances; reset/recalculate.
Libraries: 50 mobility workouts; 50 strength presets (≥15 gym/barbell incl. barbell/squat rack/deadlift/bench combinations); categories per spec; adaptive plan remains the separate primary option.
Cleanup: zero Apple Music references; no dead code/imports from removals.
Regression: adaptive training, strength, mobility, readiness history, AI Coach, route builder, training definitions, saved analyses, media-path migration, marker editor, angle-series persistence all intact.

## 11. Validation commands (Codex, end of pass 2)

```
npm run typecheck
npx expo install --check
git diff --check
npm run test
grep -ri "apple ?music\|musickit\|Connect Music" app src app.json package.json   # expect nothing
grep -rn "45°\|Front 45" app src                                                 # expect nothing
grep -rn "Lunge / Single-Leg" app src                                            # expect nothing
```
Sonnet runs `npm run typecheck` + `git diff --check` at handoff and reports (not necessarily clean in Codex-owned callers — list the deltas).

## 12. Device-only QA (after both passes; not automatable)

Camera countdown/auto-stop on hardware; mic/camera permission prompts; real video import >30 s rejection + iCloud-offloaded asset error; pose detection on-device (stride-pose is iOS-only); chart↔video sync feel and scrub latency; Dion image legibility on small devices in light/dark; Live Activity untouched; fueling reminder firing at chosen interval; TestFlight build via EAS (explicitly NOT run in this pass).

## 13. Handoff format (both models)

Return: (1) files changed with 1-line summaries; (2) contracts provided/consumed (registry API, CaptureGuidanceCard props, hydrationConfig, strengthBank shape) and any deviation; (3) validation output (§11 subset run); (4) known temporary breakages left for the next pass (file:line); (5) scope items intentionally not done and why; (6) nothing committed, nothing reset, assets untouched — confirm explicitly.
