# Movement Tracking Research & Architecture (Build 34)

Status: Build 34 design source of truth for video joint-angle tracking.
Owner: Movement Lab. Companion docs: `movement-readiness-evidence.md`,
`training-definitions.md`.

## What Apple Vision gives us (and what it doesn't)

`VNDetectHumanBodyPoseRequest` (iOS, on-device, no network):

- 2D normalized landmarks for: nose, neck, shoulders, elbows, wrists,
  hips (+ root/mid-hip), knees, ankles. Per-point confidence 0–1.
- **No foot/toe/heel landmarks.** Therefore:
  - No ankle dorsiflexion/plantarflexion angle.
  - No footstrike classification (heel/midfoot/forefoot).
  - No foot progression angle.
- 2D only: angles are projections. A side view is required for sagittal
  angles (knee/hip/trunk) to be meaningful; front/rear views are for
  symmetry and frontal-plane observations only.
- No temporal model: each frame is independent. Gait events (initial
  contact, toe-off) can only be *estimated* from landmark kinematics and
  must always be labeled as estimates.

Honesty rules (carried over from Build 32, still binding):

- Never emit an angle unless every contributing landmark clears
  `LANDMARK_CONFIDENCE_FLOOR` (0.3).
- No person detected is a valid result, not an error.
- Every analysis carries `limitations: string[]` surfaced in the UI.

## Video pipeline (Part A)

```
video URI
  → native StridePose.detectPoseSequence(uri, { fps, maxDurationMs })
      AVAssetReader decode → sample at 10–15 fps → Vision per frame
      → { durationMs, analyzedMs, imageWidth, imageHeight,
          frames: [{ timeMs, joints: PoseJoint[] }] }   // joints [] = no person
  → JS src/utils/poseSequence.ts (pure)
      → angle series per angle name/side (reuses computeEstimatedAngles)
      → moving-average smoothing (window ~5 frames, centered)
      → key moment detection (peaks/valleys on smoothed series)
      → rep detection (squat/lunge: cycles on knee-flexion series)
      → sequence confidence + coverage + limitations
  → persisted MovementAnalysis (mediaType 'video')
      inline: angleSeries (smoothed, downsampled), keyFrames, repSummaries,
              sequenceConfidence, sequenceLimitations
      file:   full frame-by-frame landmarks → FileSystem document dir
              (movement-pose/<analysisId>.json), referenced by poseSequenceUri
```

Why file-backed landmarks: 60 s at 12 fps ≈ 720 frames × ≤15 joints. Kept
inline in the zustand/AsyncStorage store this bloats every rehydrate.
Angle series and key frames are small and stay inline; raw landmarks are
lazy-loaded only when the user scrubs video with the skeleton overlay.

## Metric derivations

Running/walking (side view preferred):

- Knee flexion, hip angle, trunk lean over time (existing triple specs).
- Symmetry estimate: compare left vs right smoothed knee-flexion range and
  peak values across the clip; report as an estimate with confidence.
- Approximate stance/contact moments: local minima of ankle vertical
  position (y max in top-left coords) per side, labeled **"estimated
  contact (approximate)"** — never presented as measured gait events.

Strength (squat/lunge/step-down):

- Rep segmentation: knee-flexion series, threshold crossing around the
  midpoint between baseline and peak, minimum cycle duration to reject
  jitter.
- Per rep: depth (peak knee flexion), bottom-position hip/trunk angles,
  rep duration. Rep-to-rep consistency = spread of peak depth.
- Key frames: setup (start), deepest position (per rep or global), lockout
  (return to baseline).

## Capture-quality engine (Part D)

Pure function over a `PoseResult` or sequence sample
(`src/utils/captureQuality.ts`):

- Full-body visibility: shoulders, hips, knees, ankles present at floor
  confidence.
- Framing: landmark bounding-box height ratio — too close (> ~0.95 of
  frame) or too far (< ~0.35).
- Lighting/contrast proxy: mean landmark confidence (Vision confidence
  drops in poor light/contrast; we cannot measure lux, say "detection
  confidence is low, often caused by lighting/contrast").
- View check (heuristic): side view expected → hip x-separation small
  relative to torso height; front/rear → large. Labeled "likely".

Output: `{ rating: 'good' | 'fair' | 'poor', issues: CaptureIssue[] }`,
each issue mapping to one actionable user message. Poor quality lowers
analysis confidence and offers manual-review fallback — it never blocks.

## Inspiration mapping (not copied branding)

- Ochy: angle-over-time visualization + key-frame report → our Angles tab
  and key frames, but with explicit confidence and estimate labels.
- CoachNow: scrub + annotate loop → our video scrubber with overlay and
  per-frame angle readout.
- Pliability: pre-capture silhouette/setup guidance → our capture guide
  in StrideOS design language.

## What remains for a future build

- MediaPipe (or similar) for foot landmarks → footstrike, ankle angles.
- Live camera analysis (VNDetectHumanBodyPoseRequest on the camera feed).
- 3D pose (vGait-style) for joint moments — out of scope for phone 2D.
