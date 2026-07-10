# Build 34.1 — Codex Execution Ticket (middle 80%)

Strategy pass by Fable, 2026-07-09. Repo: this repository, branch
`build-19-v3-foundation`, base commit `80981ba`. Do not commit; leave the
working tree for review.

## Root causes (verified in code)

RC1 — **Absolute file URIs are persisted.** `copyAnalysisMediaToStorage`,
`copyVideoToMovementStorage` (src/lib/movementVideoStorage.ts) and
`savePoseSequence` (src/lib/poseSequenceStorage.ts) return absolute
`file:///…/Application/<UUID>/Documents/…` URIs that are stored on
`MovementAnalysis.mediaUri` / `.poseSequenceUri` and persisted via
AsyncStorage. iOS regenerates the container UUID on every app update
(every TestFlight build), so all saved media and pose files dangle after
an update → "uploaded videos no longer persisting into saved analyses",
skeleton overlay unavailable on reopen.

RC2 — **Manual checklist structurally gates the primary flow.** In
`app/(tabs)/movement/analyze.tsx`: `canSave = Boolean(media) &&
answeredCount >= 1` (a saved analysis REQUIRES a manual checklist
answer); pose detection only runs when the user taps "Detect Pose"; the
automated full-video path is a "BETA" card rendered BELOW the manual
"ANALYZE A FRAME" card. Automated analysis is opt-in; manual is
mandatory — the inverse of the intended design.

RC3 — **Automated video results don't produce findings/recommendations.**
`handleAnalyzeVideo` saves `checklistFindings: []` and
`recommendations: []`; `buildAnalysisRecommendations` only consumes
checklists. Sequence outputs (repSummaries, symmetryEstimates,
angleSeries) never become Finding→Meaning→Recommendation records, so
video analyses look empty in history and contribute little to the AI
Coach handoff (which leans on checklistFindings/recommendations).

RC4 — **No reference-frame (calibration) workflow.** Key frames are
auto-only; the user cannot choose the frame that represents the
analysis, and photos can't be re-framed. Never designed in Build 34.

RC5 — **No editable landmark workflow.** `PoseOverlay` and
`SkeletonOverlay` are display-only. No drag-to-correct, no persistence
of corrections, no preservation of the original automatic landmarks.

RC6 — **Angle display gaps.** Photos show angles only if the user
manually ran Detect Pose before saving. `video-analysis.tsx`'s per-frame
angle readout depends on the file-backed pose sequence (broken by RC1);
it does not fall back to the inline decimated `angleSeries`.

RC7 (secondary) — **Readiness single-leg checklist pre-seeds all-good**
(`readiness-test.tsx` seeds `pelvisLevel/kneeTracksOverFoot/trunkSteady`
to `true`), so an inattentive user gets inflated "good" control scores.

## Architecture decision

1. **Relative-path persistence with legacy re-anchoring.** New module
   `src/lib/mediaPaths.ts`: store paths relative to the document
   directory (`movement-analyses/…`, `movement-pose/…`,
   `movement-videos/…`); resolve to absolute at read time. A pure
   `reanchorDocumentUri(uri)` rewrites any legacy absolute URI that
   contains `/Documents/` onto the CURRENT document directory. All reads
   of `mediaUri` / `sourceVideoUri` / `poseSequenceUri` /
   `referenceFrameUri` go through one resolver. A lazy migration in
   `movementStore` (on rehydrate) converts legacy absolute URIs to
   relative form once. No breaking model change: existing fields keep
   their names; values become relative (resolver handles both forms
   forever).

2. **Automatic-first analysis pipeline** in `analyze.tsx`:
   media selected → detection runs immediately (photo: `detectPose`;
   video: `detectPoseSequence`, no "beta" framing) → reference frame
   auto-selected (video: deepest-position key frame if present, else
   mid-clip; photo: the photo itself) → estimated angles at the
   reference frame + series → auto findings with confidence → save
   enabled with ZERO checklist answers. Manual checklist collapses into
   an optional "Manual review" section (it remains the complete fallback
   when pose is unavailable/no person found). `canSave = media && (auto
   results present || ≥1 checklist answer)`.

3. **Reference frame + editable markers, one editor.** New
   `src/components/movement/LandmarkEditor.tsx` used by both photo and
   video paths: shows the reference-frame still with draggable joint
   handles. Corrections persist as `correctedLandmarks`; the original
   automatic set is preserved untouched in `autoLandmarks`. Effective
   landmarks = corrected ?? auto. User-adjusted joints get
   `confidence: 1` plus a record-level `landmarkSource: 'corrected'`
   and the UI labels angles from them "user-adjusted estimate". Only
   the 15 known Apple Vision joints can be placed; no foot/toe markers,
   so ankle-angle and footstrike claims stay impossible by construction.
   Missing landmarks that the user does not place still produce NO angle.

4. **Auto findings builder.** New pure function
   `buildSequenceFindings(seq, kind)` in `src/utils/movementEngine.ts`
   (or sibling) mapping rep summaries / symmetry / reference-frame angle
   norms (reuse `assessJointAngle`) into the existing
   `{ finding, meaning, recommendation }` shape with confidence and
   evidence-safe language ("may affect", "estimate"). Saved onto
   `recommendations` so history, detail screens, and the AI Coach
   handoff light up without any new consumer changes.

## Data model (src/types/movement.ts — append-only, all optional)

```ts
// on MovementAnalysis
autoLandmarks?: PoseLandmarkRecord[];   // original automatic set (audit trail; never mutated)
correctedLandmarks?: PoseLandmarkRecord[];
landmarkSource?: 'auto' | 'corrected';  // which set produced estimatedAngles
referenceFrameTimeMs?: number;          // video: chosen reference frame time
referenceFrameUri?: string;             // extracted still for the reference frame (relative path)
```

Back-compat rules: existing `landmarks` remains the EFFECTIVE set that
all current consumers read (analysis-detail, coach handoff). On first
correction: copy current `landmarks` → `autoLandmarks` (if not already
set), write corrected set to both `correctedLandmarks` and `landmarks`,
set `landmarkSource: 'corrected'`, recompute `estimatedAngles` via
`computeEstimatedAngles`. Build 32 records (no new fields) render
exactly as today.

## File-by-file plan

1. `src/lib/mediaPaths.ts` (new) — `toRelativeDocumentPath`,
   `resolveDocumentUri`, `reanchorDocumentUri`; unit-testable pure logic
   plus one `documentDirectory` import.
2. `src/lib/movementVideoStorage.ts` — `copyAnalysisMediaToStorage`
   returns a RELATIVE path; keep function signature.
3. `src/lib/poseSequenceStorage.ts` — save returns relative path;
   `loadPoseSequence` resolves relative or legacy absolute via
   `mediaPaths` before reading.
4. `src/store/movementStore.ts` — in persist `merge`: one-shot lazy
   migration mapping legacy absolute `mediaUri`/`sourceVideoUri`/
   `poseSequenceUri` → relative (only for URIs containing
   `/Documents/`); add `updateAnalysis` remains sufficient for
   corrections (no new actions needed).
5. `app/(tabs)/movement/analyze.tsx` — restructure per architecture #2:
   auto-run detection on selection; promote video sequence card to the
   primary action (drop "BETA"); demote frame extraction to an
   "Advanced" row; collapse checklist into optional "Manual review";
   new save gate; reference-frame step for video (scrub over key frames
   + VideoScrubBar, extract chosen frame via expo-video-thumbnails,
   store `referenceFrameTimeMs`/`referenceFrameUri`); entry point into
   LandmarkEditor before save; call `buildSequenceFindings` and persist
   its output on `recommendations`.
6. `src/components/movement/LandmarkEditor.tsx` (new) — PanResponder
   drag handles over the still (reuse SkeletonOverlay letterbox
   mapping); per-joint select → drag; "Reset to automatic"; returns the
   corrected `PoseLandmarkRecord[]`. Keep it one screenful, StrideOS
   design language.
7. `app/(tabs)/movement/video-analysis.tsx` — resolve media/pose URIs
   through `mediaPaths`; per-frame angle readout falls back to inline
   `angleSeries` (nearest decimated point, labeled "from smoothed
   series") when the pose file is unavailable; show reference frame in
   Overview; "Adjust markers" entry on the reference frame opening
   LandmarkEditor; display corrected-vs-auto chip when
   `landmarkSource === 'corrected'`.
8. `app/(tabs)/movement/analysis-detail.tsx` — "Adjust markers" entry
   (photo/still records with landmarks or a detectable image); render
   "user-adjusted estimate" labels; unchanged for Build 32 records
   without landmarks.
9. `src/utils/movementEngine.ts` — add `buildSequenceFindings`; extend
   `buildCoachHandoff` with `landmarkSource` so the coach knows angles
   were user-adjusted.
10. `app/(tabs)/movement/readiness-test.tsx` — seed the single-leg
    checklist values to `undefined`/unanswered; the engine already
    treats absent values as manual_review (RC7).
11. `app/(tabs)/movement/index.tsx` — no structural change; verify
    history thumbnails/entries use the resolver.

## UI flow (target)

Photo/video picked → "Analyzing…" (automatic) → result card: reference
frame + skeleton + angle list (chips: confidence, auto/user-adjusted) →
optional: pick different reference frame (video scrub) → optional:
Adjust markers → optional: Manual review checklist → Save → history
entry opens video-analysis (video) / analysis-detail (still) → reopen
works after force-quit AND after app update.

## Acceptance criteria

1. Save a photo analysis WITHOUT touching the checklist (pose ran) —
   allowed; record shows estimated angles + auto findings.
2. Pose unavailable/no person → checklist path unchanged and required,
   message explains why.
3. Video analysis is the primary action for videos; produces findings
   ("may affect…" language) and recommendations, visible in history.
4. Reference frame selectable on video; persists; shown on reopen.
5. Drag a knee marker → angles recompute; original auto landmarks
   retained (`autoLandmarks`); "user-adjusted estimate" label shown;
   reset-to-automatic works.
6. Landmarks never invented: a joint absent from both auto and
   corrected sets produces no angle anywhere.
7. Simulated container change (rewrite stored URIs to a bogus
   `/Application/OLD-UUID/Documents/...` prefix in a test) → resolver
   re-anchors; video plays and pose file loads.
8. Build 32 still records and Build 34 mobility/readiness/definitions/
   coach flows unchanged (`npm run typecheck`, spot checks).
9. No footstrike/ankle-dorsiflexion claims anywhere new.
10. `npm run typecheck` zero errors; `git diff --check` clean; no new
    npm dependencies; evidence-language rules from
    `docs/movement-readiness-evidence.md` hold for all new strings.

## Read-first list for the implementer

`docs/movement-tracking-research.md`, `docs/movement-readiness-evidence.md`,
`src/types/movement.ts`, `src/utils/poseAngles.ts`,
`src/utils/poseSequence.ts`, `src/utils/movementEngine.ts` (norms +
handoff), `src/lib/movementVideoStorage.ts`, `src/lib/poseSequenceStorage.ts`,
`src/store/movementStore.ts`, `app/(tabs)/movement/analyze.tsx`,
`app/(tabs)/movement/video-analysis.tsx`,
`app/(tabs)/movement/analysis-detail.tsx`,
`src/components/movement/SkeletonOverlay.tsx`,
`src/components/assessment/PoseOverlay.tsx`.
