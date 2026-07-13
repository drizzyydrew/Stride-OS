# Build 36 — Movement Lab Rebuild (Fable architecture ticket)

Status: FIRST 10% complete. This file is the binding contract for the middle-80% agents.
Do not commit, do not run EAS. Expo SDK 56 — verify APIs against https://docs.expo.dev/versions/v56.0.0/ before writing Expo code.

## Verified repository state (do not trust prior reports)

- Movement kinds today: `running_gait | squat | deadlift | lunge_single_leg | general` (`src/types/movement.ts`).
- Views: `side | front | rear | 45_degree | unknown`. Squat capture defaults to `45_degree` (`app/(tabs)/movement/analyze.tsx` KIND_CAMERA_VIEW) — must become lateral; type keeps `45_degree` only as a legacy persisted value.
- `computeEstimatedAngles` (`src/utils/poseAngles.ts`) always computes BOTH sides + elbows/shoulders regardless of movement/view. The Angles tab (`app/(tabs)/movement/video-analysis.tsx`) hardcodes Left/Right knee, hip, shoulder, elbow charts — violates view rules.
- Apple Vision landmarks (stride-pose): nose, neck, shoulders, elbows, wrists, hips, mid_hip, knees, ankles. **No foot/toe/heel landmarks** — no ankle dorsiflexion, no footstrike classification, no heel-height tracking. Never claim these.
- No chart↔video sync exists. `AngleChart` (victory-native) has no playhead, no axes labels, no tap-to-seek. `VideoScrubBar` exists.
- "Discuss with AI Coach" buttons push `/(tabs)/coach` with NO params. Coach screen already supports an `ask` param that prefills the input (`app/(tabs)/coach/index.tsx` ~line 484). System prompt already embeds last-3 analyses via `buildCoachHandoff`.
- AI Coach "Video" tab has a full duplicate upload workflow + a "COMING SOON" card — both must go.
- Apple Music: the ONLY reference in the entire app is a decorative, non-pressable "Connect Music" row in `app/(tabs)/training/index.tsx` (~lines 480–484, styles `musicRow`/`musicText` ~2449–2458). No deps, routes, services, state, or entitlements. Nothing else to remove.
- Dion images: **zero image assets exist** (`assets/images` = app icons only). All 17 Dion images are missing → registry ships with explicit asset keys + structured placeholders; final report lists every required image.
- `CaptureSilhouette.tsx` is a literal generic stick figure — remove it and its usage.
- Readiness flow (`readiness-test.tsx`): 6 steps + pain screen. Single-leg squat is manual-checklist-first (violates spec), gait step label is static, symptom review is Yes/No only.
- No test runner. Scripts: `typecheck`, `expo:check` only. No expo-camera (needed for countdown/auto-record).
- Persistence: `movementStore` zustand+AsyncStorage with relative-path migration in `merge`. Build 32 stills / 34 videos / 35 relative paths must keep rendering.

## Taxonomy & migration (binding)

New `MovementAnalysisKind`: `running_gait | squat | deadlift | single_leg_control | lunge | general`, plus **deprecated** `lunge_single_leg` kept in the union so persisted records typecheck.

Migration (in `movementStore` `merge`, plus a `normalizeAnalysisKind(kind, cameraView?)` helper in measurementMatrix):
- `lunge_single_leg` + cameraView `front` → `single_leg_control`
- `lunge_single_leg` + cameraView `side` → `lunge`
- `lunge_single_leg` + anything else → `single_leg_control`
All other record data preserved verbatim. Old analyses must reopen without crashes.

Categories (add `category` to ANALYSIS_KIND_INFO): running_gait = "Running Performance"; squat, deadlift = "Strength Movement"; single_leg_control, lunge = "Athletic Movement"; general = "General Analysis". Never label anything "Lunge / Single-Leg".

Default capture views: running_gait lateral · squat lateral (frontal optional) · deadlift lateral · single_leg_control frontal (lateral optional) · lunge lateral (frontal optional) · general user-selected. No 45° anywhere in UI/instructions.

## Measurement-permission matrix (binding API — Agent A implements, B/C consume)

New file `src/utils/measurementMatrix.ts`:

```ts
export type CanonicalView = 'lateral' | 'frontal' | 'posterior' | 'unknown';
export function canonicalView(view: MovementViewAngle): CanonicalView;
// side→lateral, front→frontal, rear→posterior, 45_degree|unknown→unknown

export type MeasurementSpec = {
  id: string;                    // e.g. 'knee_flexion', 'hip_angle', 'trunk_lean', 'pelvic_obliquity', 'frontal_knee_position', 'trunk_lateral_lean'
  label: string;
  joint: string;
  bilateral: boolean;            // frontal/posterior bilateral metrics only
  closestSideOnly: boolean;      // lateral sagittal metrics only
};
export function permittedMeasurements(kind: MovementAnalysisKind, view: MovementViewAngle): MeasurementSpec[];
export function filterEstimatedAngles(angles: EstimatedAngle[], kind: MovementAnalysisKind, view: MovementViewAngle, closestSide?: 'left'|'right'): EstimatedAngle[];
export function filterAngleSeries(series: AngleSeries[], kind: MovementAnalysisKind, view: MovementViewAngle, closestSide?: 'left'|'right'): AngleSeries[];
export function determineClosestSide(input: PoseSequenceResult | PoseLandmarkRecord[]): { side: 'left'|'right'; confidence: 'high'|'low' } | null;
export function normalizeAnalysisKind(kind: string, cameraView?: MovementViewAngle): MovementAnalysisKind;
```

Matrix rules:
- **Lateral, lower-body kinds (running_gait, squat, deadlift, lunge, single_leg_control-lateral)**: closest-side knee flexion, closest-side hip angle, trunk inclination. NO elbow/wrist/shoulder metrics. Never both limbs' curves. Unknown view (incl. legacy 45°) → conservative: trunk only + note, or general set for `general` kind.
- **Frontal/posterior**: pelvic obliquity (hip-line vs horizontal), frontal-plane knee position (knee-x offset from hip–ankle line, normalized), trunk lateral lean, shoulder level where relevant, L/R comparison. NO sagittal knee-flexion ROM as a primary metric.
- **general**: only measurements valid for the user-selected view.
- Anything outside the matrix is omitted, never estimated.
- Closest side: from mean landmark confidence per side (+ visibility). Low confidence → UI asks "Which side is closest to the camera?" and persists `closestSide` + `closestSideSource: 'user'` on the record.

Type additions (`src/types/movement.ts`): `closestSide?: 'left'|'right'`, `closestSideSource?: 'auto'|'user'` on `MovementAnalysis`; `closestSide?: 'left'|'right'` on `CoachHandoff`.

Frontal metrics: extend `poseAngles.ts`/`poseSequence.ts` to compute pelvic obliquity, frontal knee position, trunk lateral lean (dimensionless/degree estimates, confidence-gated, gaps stay gaps).

## Synchronized video + ROM workspace (Agent A)

Rebuild the Angles tab of `video-analysis.tsx` into one workspace: video player (play/pause, current/duration, scrubber, key-frame shortcuts) → current estimated values (matrix-filtered) → synced charts. Playhead line on every chart follows playback; chart tap/drag seeks AND pauses video; key-frame tap seeks both; missing-confidence frames stay gaps. Charts: Y-axis degrees, X-axis seconds, current-time marker, min/max ROM, metric-specific scale, compact labels that fit an iPhone SE width. `AngleChart` gains `currentTimeMs`, `onSeekMs(ms)`, axis labels, min/max. Lateral lower-body = closest-side knee flexion, closest-side hip angle, trunk lean only.

## AI Coach handoff (contract — senders A & C, receiver C)

Sender (video-analysis.tsx = A; analysis-detail.tsx, [videoId].tsx = C):
```ts
router.push({ pathname: '/(tabs)/coach', params: {
  ask: `Review this ${title} analysis. Explain the most important findings, what they may mean for my training, and the 2–3 most useful next steps.`,
  analysisId: analysis.id,
}});
```
Receiver (coach/index.tsx = C): accept `analysisId`, keep it in state past the param-clear, and inject a `FOCUSED ANALYSIS` block into the system prompt with the FULL `buildCoachHandoff` payload (type, camera view, closest side, confidence, angles/ranges, key frames, rep summaries, automated findings, landmark source, notes, limitations — athlete goal + training phase already present). The visible input shows ONLY the short editable prompt; the payload never enters the text field.

## Capture workflow (Agent B)

`npx expo install expo-camera`; add NSMicrophoneUsageDescription if missing. New `TimedCaptureCamera` (modal, `CameraView` mode="video"): Dion card → view label → must-be-visible → recommended distance → 5-second countdown → auto-start → record movement-specific duration → auto-stop → return URI → immediate processing → retake option.

Durations (`src/constants/captureConfig.ts`): squat 10s · single_leg_control 10s/side · lunge 10s/side · deadlift 12s · running/walking gait 12s · heel raise 25s cap · general 30s max.

`src/utils/mediaValidation.ts`: `validatePickedVideo(asset) → { code: 'too_long'|'unsupported_type'|'too_large'|'icloud_unavailable'|'unreadable'|'decode_failed'; message } | null`. Supported: .mov/.mp4/.m4v (AVFoundation-decodable). Max 30s. Max 500 MB (expo-file-system `getInfoAsync`). Show the specific error, never a generic one. Surface recommended + max length and supported types BEFORE selection.

## Dion image registry (Agent B)

`src/constants/dionImages.ts` — 17 entries keyed exactly: `running_gait_lateral, squat_lateral, squat_frontal, deadlift_lateral, single_leg_control_frontal, single_leg_control_lateral, lunge_lateral, lunge_frontal, custom_neutral, readiness_squat_lateral, readiness_single_leg_squat_frontal, readiness_split_lunge_lateral, readiness_knee_to_wall_lateral, readiness_heel_raise_lateral, readiness_running_gait_lateral, readiness_walking_gait_lateral, symptom_review`. Each: `{ key, image: number|null, thumbnail: number|null, alt, viewLabel, mustBeVisible: string[], recommendedDistance }`. No approved Dion reference exists in-repo → every `image` is `null`; `DionInstructionCard` renders a structured placeholder (view label, framing box, must-be-visible chips, distance, "Illustration pending — asset key: <key>") — NOT a stick figure. Delete `CaptureSilhouette.tsx`. All screens pull from the registry; no hardcoded image paths.

## Readiness battery (Agent B UI, Agent A engine/types)

Seven steps: 1 Bodyweight Squat (lateral, 3–5 reps) · 2 Single-Leg Squat (frontal, per-side, **automatic assessment first** — pelvic control, frontal knee position, trunk control, depth control from frontal metrics where confidence supports; manual review = confirm / unclear / override-with-reason / note) · 3 Split-Stance Lunge (lateral, "Perform 3–5 controlled repetitions per side.") · 4 Knee-to-Wall (manual cm L/R + asymmetry; never claim automatic dorsiflexion; any angle labeled estimate) · 5 Single-Leg Heel Raise (manual reps L/R retained; data model adds optional future-automation fields `qualityReps`, `declineOnsetRep`, `tempoConsistency` — never fabricated) · 6 gait step titled "Easy Running Gait" when focus=running / "Walking Gait" when focus=walking (lateral, 10–15 s) · 7 Symptom Review ("Did you have pain or symptoms during any test?" → No symptoms / Yes → 0–10 intensity + body location + optional notes).

Types (A): `ReadinessAssessment.symptom?: { intensity: number; location: string; notes?: string }` (keep `painReported`). `assessReadiness` gains optional 5th arg `symptom`. Engine (A): score single-leg-control domain from frontal metrics of the linked analysis when confidence supports it; manual answers act as confirm/override; conservative degradation to manual_review unchanged.

## Language rules (all agents)

Allowed: may be associated with / may influence / may contribute / estimated / requires confirmation / manual review recommended. Forbidden: bad form, causes injury, high injury risk, "high risk for", guaranteed, exact clinical measurement, diagnostic claims. Agent A sweeps `movementEngine.ts` templates (several current violations: "High risk for patellofemoral syndrome", injury-causation phrasing). All angles are estimated 2D projections.

## File ownership (no agent touches another's files)

**Agent A (biomechanics/data/sync):** src/types/movement.ts · src/types/movementReadiness.ts · src/utils/measurementMatrix.ts (new) · src/utils/poseAngles.ts · src/utils/poseSequence.ts · src/utils/movementEngine.ts · src/utils/readinessEngine.ts · src/store/movementStore.ts · src/components/movement/AngleChart.tsx · src/components/movement/VideoScrubBar.tsx · app/(tabs)/movement/video-analysis.tsx · src/utils/__tests__/measurementMatrix.test.ts, poseAngles.test.ts, movementStoreCompat.test.ts (new)

**Agent B (UX/capture/Dion/readiness):** src/constants/dionImages.ts (new) · src/constants/captureConfig.ts (new) · src/utils/mediaValidation.ts (new) · src/components/movement/DionInstructionCard.tsx (new) · src/components/movement/TimedCaptureCamera.tsx (new) · src/components/movement/CaptureGuidanceCard.tsx · delete src/components/movement/CaptureSilhouette.tsx · app/(tabs)/movement/index.tsx · app/(tabs)/movement/analyze.tsx · app/(tabs)/movement/readiness.tsx · app/(tabs)/movement/readiness-test.tsx · app/(tabs)/movement/readiness-report.tsx · package.json/package-lock.json (expo-camera + tsx devDep + `"test": "tsx --test src/utils/__tests__/*.test.ts scripts/tests/*.test.ts"`) · app.json (permissions only) · src/utils/__tests__/mediaValidation.test.ts (new)

**Agent C (coach/cleanup/regression):** app/(tabs)/coach/index.tsx · app/(tabs)/training/index.tsx (remove music row) · app/(tabs)/movement/analysis-detail.tsx · app/(tabs)/movement/[videoId].tsx · scripts/tests/sweeps.test.ts (new: forbidden-language, 45°, Apple Music, stick-figure, dead-route sweeps as file-content assertions) · scripts/tests/coachHandoff.test.ts (new)

Shared read-only: everything else. If an agent believes it must edit a file it doesn't own — stop and report instead.

## Acceptance criteria

The 25 criteria from the Build 36 brief apply verbatim. Validation: `npm run typecheck`, `npx expo install --check`, `git diff --check`, `npm run test`.
