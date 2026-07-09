// ─── Capture-Quality Engine ───────────────────────────────────────────────────
//
// Pure heuristics over a stride-pose PoseResult / PoseSequenceResult that flag
// framing, lighting, and camera-view problems BEFORE they degrade a movement
// finding. See docs/movement-tracking-research.md ("Capture-quality engine").
//
// Poor capture quality never blocks the flow — it lowers downstream confidence
// and suggests a manual-review fallback. No I/O; callers handle everything else.

import type { PoseJoint, PoseJointName, PoseResult, PoseSequenceResult } from 'stride-pose';
import { LANDMARK_CONFIDENCE_FLOOR } from './poseAngles';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaptureIssueCode =
  | 'too_far'
  | 'too_close'
  | 'missing_joints'
  | 'low_confidence'
  | 'wrong_view_likely'
  | 'no_person';

export type CaptureIssue = {
  code:    CaptureIssueCode;
  message: string;
};

export type CaptureQualityRating = 'good' | 'fair' | 'poor';

export type CaptureQualityResult = {
  rating: CaptureQualityRating;
  issues: CaptureIssue[];
};

export type ExpectedView = 'side' | 'front' | 'rear';

// ─── Thresholds ───────────────────────────────────────────────────────────────

const REQUIRED_JOINTS: PoseJointName[] = [
  'left_shoulder', 'right_shoulder',
  'left_hip',      'right_hip',
  'left_knee',     'right_knee',
  'left_ankle',    'right_ankle',
];

/** Bounding-box height ratio (fraction of frame height the person spans). */
const TOO_CLOSE_BBOX_RATIO = 0.95;
const TOO_FAR_BBOX_RATIO   = 0.35;

/** Mean per-landmark confidence below this reads as a lighting/contrast problem. */
const LOW_CONFIDENCE_MEAN = 0.45;

/** Hip x-separation ÷ bbox height. Small → side view. Large → front/rear view. */
const SIDE_VIEW_MAX_RATIO   = 0.16;
const FRONT_VIEW_MIN_RATIO  = 0.22;

// ─── Messages ─────────────────────────────────────────────────────────────────

const MSG_TOO_CLOSE        = 'Move farther back so your whole body is visible.';
const MSG_TOO_FAR          = 'Move closer so we can see your joints clearly.';
const MSG_MISSING_JOINTS   = 'Make sure your feet and shoulders are visible.';
const MSG_LOW_CONFIDENCE   =
  'Improve lighting so we can detect your hips, knees, and ankles — detection confidence is often lower ' +
  'in poor lighting or low contrast. Use a contrasting background if possible.';
const MSG_TURN_SIDEWAYS    = 'Turn slightly sideways for this test.';
const MSG_FACE_CAMERA      = 'Face the camera more directly for this test.';
const MSG_NO_PERSON        = "We couldn't detect a person in this frame — check framing and lighting, then try again.";
const MSG_NO_PERSON_CLIP   = "We couldn't detect a person clearly in this clip — check framing and lighting, then try again.";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bboxHeightRatio(joints: PoseJoint[]): number {
  if (joints.length === 0) return 0;
  const ys = joints.map(j => j.y);
  return Math.max(...ys) - Math.min(...ys);
}

function meanConfidence(joints: PoseJoint[]): number {
  if (joints.length === 0) return 0;
  return joints.reduce((sum, j) => sum + j.confidence, 0) / joints.length;
}

function confidentJoints(joints: PoseJoint[]): PoseJoint[] {
  return joints.filter(j => j.confidence >= LANDMARK_CONFIDENCE_FLOOR);
}

/** Heuristic view check: side view has small hip x-separation relative to
 *  torso height; front/rear has a much larger one. Always "likely" — never
 *  presented as a definitive read. */
function likelyDetectedView(joints: PoseJoint[]): 'side' | 'front_or_rear' | 'unknown' {
  const lh = joints.find(j => j.name === 'left_hip'  && j.confidence >= LANDMARK_CONFIDENCE_FLOOR);
  const rh = joints.find(j => j.name === 'right_hip' && j.confidence >= LANDMARK_CONFIDENCE_FLOOR);
  if (!lh || !rh) return 'unknown';

  const height = bboxHeightRatio(joints);
  if (height <= 0) return 'unknown';

  const ratio = Math.abs(lh.x - rh.x) / height;
  if (ratio <= SIDE_VIEW_MAX_RATIO) return 'side';
  if (ratio >= FRONT_VIEW_MIN_RATIO) return 'front_or_rear';
  return 'unknown';
}

function rateFromIssues(issues: CaptureIssue[]): CaptureQualityRating {
  if (issues.length === 0) return 'good';
  const hasSevere = issues.some(i => i.code === 'no_person' || i.code === 'missing_joints' || i.code === 'low_confidence');
  if (hasSevere || issues.length >= 2) return 'poor';
  return 'fair';
}

// ─── assessCaptureQuality ─────────────────────────────────────────────────────

/** Assesses a single still (photo, extracted frame, or one sequence sample). */
export function assessCaptureQuality(pose: PoseResult | null, expectedView: ExpectedView): CaptureQualityResult {
  if (!pose || pose.joints.length === 0) {
    return { rating: 'poor', issues: [{ code: 'no_person', message: MSG_NO_PERSON }] };
  }

  const joints = pose.joints;
  const issues: CaptureIssue[] = [];

  const confident = confidentJoints(joints);
  const missing = REQUIRED_JOINTS.filter(name => !confident.some(j => j.name === name));
  if (missing.length > 0) {
    issues.push({ code: 'missing_joints', message: MSG_MISSING_JOINTS });
  }

  const heightRatio = bboxHeightRatio(confident.length >= 2 ? confident : joints);
  if (heightRatio > TOO_CLOSE_BBOX_RATIO) {
    issues.push({ code: 'too_close', message: MSG_TOO_CLOSE });
  } else if (heightRatio > 0 && heightRatio < TOO_FAR_BBOX_RATIO) {
    issues.push({ code: 'too_far', message: MSG_TOO_FAR });
  }

  if (meanConfidence(joints) < LOW_CONFIDENCE_MEAN) {
    issues.push({ code: 'low_confidence', message: MSG_LOW_CONFIDENCE });
  }

  const detectedView = likelyDetectedView(joints);
  const expectsSide = expectedView === 'side';
  if (detectedView === 'front_or_rear' && expectsSide) {
    issues.push({ code: 'wrong_view_likely', message: MSG_TURN_SIDEWAYS });
  } else if (detectedView === 'side' && !expectsSide) {
    issues.push({ code: 'wrong_view_likely', message: MSG_FACE_CAMERA });
  }

  return { rating: rateFromIssues(issues), issues };
}

// ─── assessSequenceCaptureQuality ─────────────────────────────────────────────

/** Samples frames across a detected sequence and aggregates capture-quality
 *  issues — only issues appearing in a majority of sampled frames are
 *  surfaced, so one bad frame doesn't flag a whole clip. */
export function assessSequenceCaptureQuality(
  seq: PoseSequenceResult,
  expectedView: ExpectedView,
): CaptureQualityResult {
  const framesWithPerson = seq.frames.filter(f => f.joints.length > 0);
  if (framesWithPerson.length === 0) {
    return { rating: 'poor', issues: [{ code: 'no_person', message: MSG_NO_PERSON_CLIP }] };
  }

  const sampleCount = Math.min(8, framesWithPerson.length);
  const step = framesWithPerson.length / sampleCount;
  const perFrame: CaptureQualityResult[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const frame = framesWithPerson[Math.min(framesWithPerson.length - 1, Math.floor(i * step))];
    perFrame.push(assessCaptureQuality(
      { imageWidth: seq.imageWidth, imageHeight: seq.imageHeight, joints: frame.joints },
      expectedView,
    ));
  }

  const counts = new Map<CaptureIssueCode, { count: number; message: string }>();
  for (const result of perFrame) {
    for (const issue of result.issues) {
      const existing = counts.get(issue.code);
      if (existing) existing.count += 1;
      else counts.set(issue.code, { count: 1, message: issue.message });
    }
  }

  const majority = Math.ceil(sampleCount / 2);
  const issues: CaptureIssue[] = [...counts.entries()]
    .filter(([, v]) => v.count >= majority)
    .map(([code, v]) => ({ code, message: v.message }));

  const coverage = framesWithPerson.length / seq.frames.length;
  if (coverage < 0.5 && !issues.some(i => i.code === 'no_person')) {
    issues.push({
      code: 'no_person',
      message: 'A person wasn\'t detected in much of this clip — check framing and lighting, or try a different clip.',
    });
  }

  return { rating: rateFromIssues(issues), issues };
}
