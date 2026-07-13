// ─── Pose Angles ──────────────────────────────────────────────────────────────
//
// Pure geometry over stride-pose landmarks (normalized 0…1, origin top-left).
// Every function is deterministic and side-effect free. Angles are only
// computed when ALL contributing landmarks clear the confidence floor —
// missing or low-confidence joints mean the angle is skipped, never guessed.
//
// NOTE: Apple Vision provides no foot/toe landmarks, so ankle dorsiflexion /
// plantarflexion can NOT be estimated. Callers should surface that limitation.

import type { PoseJoint, PoseJointName, PoseSequenceResult } from 'stride-pose';
import type {
  AnalysisConfidence,
  EstimatedAngle,
  MovementAnalysisKind,
  PoseLandmarkRecord,
} from '../types/movement';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum per-landmark confidence for an angle (or skeleton segment) to count. */
export const LANDMARK_CONFIDENCE_FLOOR = 0.3;

/** Skeleton segments for the overlay renderer. */
export const SKELETON_CONNECTIONS: [PoseJointName, PoseJointName][] = [
  // Arms
  ['left_shoulder',  'left_elbow'],
  ['left_elbow',     'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow',    'right_wrist'],
  // Torso
  ['left_shoulder',  'left_hip'],
  ['right_shoulder', 'right_hip'],
  // Legs
  ['left_hip',   'left_knee'],
  ['left_knee',  'left_ankle'],
  ['right_hip',  'right_knee'],
  ['right_knee', 'right_ankle'],
  // Neck / head
  ['neck', 'left_shoulder'],
  ['neck', 'right_shoulder'],
  ['neck', 'mid_hip'],
  ['neck', 'nose'],
];

// ─── Geometry ─────────────────────────────────────────────────────────────────

type Point = { x: number; y: number };

/**
 * Angle in degrees at vertex `b`, formed by vectors b→a and b→c.
 * Returns 0–180. Degenerate (zero-length) vectors return NaN — callers skip.
 */
export function angleAtJoint(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return NaN;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// ─── Angle extraction ─────────────────────────────────────────────────────────

function findJoint(joints: PoseJoint[], name: PoseJointName): PoseJoint | undefined {
  const j = joints.find(p => p.name === name);
  return j && j.confidence >= LANDMARK_CONFIDENCE_FLOOR ? j : undefined;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type TripleSpec = {
  name:  string;   // human-facing angle name
  joint: string;   // vertex joint label
  a: PoseJointName;
  b: PoseJointName; // vertex
  c: PoseJointName;
  /** Transform the raw vertex angle (e.g. knee flexion reported as 180 − raw). */
  transform?: (raw: number) => number;
  note?: string;
};

function sideSpecs(side: 'left' | 'right'): TripleSpec[] {
  const p = (n: string) => `${side}_${n}` as PoseJointName;
  return [
    {
      name:  'Knee flexion',
      joint: 'knee',
      a: p('hip'), b: p('knee'), c: p('ankle'),
      transform: raw => 180 - raw,
      note: '0° = fully straight knee',
    },
    {
      name:  'Hip angle',
      joint: 'hip',
      a: p('shoulder'), b: p('hip'), c: p('knee'),
    },
    {
      name:  'Elbow angle',
      joint: 'elbow',
      a: p('shoulder'), b: p('elbow'), c: p('wrist'),
    },
    {
      name:  'Shoulder angle',
      joint: 'shoulder',
      a: p('elbow'), b: p('shoulder'), c: p('hip'),
    },
  ];
}

/**
 * Compute estimated joint angles from detected landmarks.
 * An angle is only emitted when all three contributing landmarks are present
 * with confidence ≥ LANDMARK_CONFIDENCE_FLOOR. Angle confidence = min of the
 * three landmark confidences. Ankle angles are never computed (no foot points).
 */
export function computeEstimatedAngles(
  joints: PoseJoint[],
  _kind: MovementAnalysisKind,
): EstimatedAngle[] {
  const angles: EstimatedAngle[] = [];

  for (const side of ['left', 'right'] as const) {
    for (const spec of sideSpecs(side)) {
      const a = findJoint(joints, spec.a);
      const b = findJoint(joints, spec.b);
      const c = findJoint(joints, spec.c);
      if (!a || !b || !c) continue;
      const raw = angleAtJoint(a, b, c);
      if (Number.isNaN(raw)) continue;
      const degrees = spec.transform ? spec.transform(raw) : raw;
      angles.push({
        name:       spec.name,
        joint:      spec.joint,
        side,
        degrees:    round1(degrees),
        confidence: Math.min(a.confidence, b.confidence, c.confidence),
        note:       spec.note,
      });
    }
  }

  // Trunk lean — shoulder-midpoint → hip-midpoint line vs vertical.
  const ls = findJoint(joints, 'left_shoulder');
  const rs = findJoint(joints, 'right_shoulder');
  const lh = findJoint(joints, 'left_hip');
  const rh = findJoint(joints, 'right_hip');
  if (ls && rs && lh && rh) {
    const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const hipMid      = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const dx = shoulderMid.x - hipMid.x;
    const dy = shoulderMid.y - hipMid.y;
    if (dx !== 0 || dy !== 0) {
      // atan2(|dx|, |dy|) = deviation of the hip→shoulder line from vertical.
      const leanFromVertical = (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
      angles.push({
        name:       'Trunk lean',
        joint:      'trunk',
        side:       'center',
        degrees:    round1(leanFromVertical),
        confidence: Math.min(ls.confidence, rs.confidence, lh.confidence, rh.confidence),
        note:       'Deviation of the trunk line from vertical',
      });
    }
  }

  return angles;
}

// ─── Frontal-plane metrics (front / rear view) ────────────────────────────────
//
// Sagittal angles (knee flexion, hip angle) are unreliable from a front/rear
// camera, so a frontal capture is measured on a different set of estimates:
// pelvic obliquity, frontal-plane knee position, and side-to-side trunk lean.
// Same honesty rules — every contributing landmark must clear the confidence
// floor, and a metric is skipped (a gap) rather than guessed. These are 2D
// projections and estimates, never clinical measurements.

/** Canonical series names for the frontal metrics — kept in one place so the
 *  measurement matrix and the sequence builder agree on the strings. */
export const FRONTAL_METRIC_NAMES = {
  pelvicObliquity:  'Pelvic obliquity',
  frontalKnee:      'Frontal knee position',
  trunkLateralLean: 'Trunk lateral lean',
} as const;

/**
 * Compute the frontal-plane estimates from a single frame's landmarks.
 * Emitted only when contributing landmarks clear LANDMARK_CONFIDENCE_FLOOR.
 * All values are estimated 2D projections.
 */
export function computeFrontalMetrics(joints: PoseJoint[]): EstimatedAngle[] {
  const angles: EstimatedAngle[] = [];

  const lh = findJoint(joints, 'left_hip');
  const rh = findJoint(joints, 'right_hip');

  // Pelvic obliquity — tilt of the hip line away from level (horizontal).
  if (lh && rh) {
    const dx = rh.x - lh.x;
    const dy = rh.y - lh.y;
    if (dx !== 0 || dy !== 0) {
      const tiltFromLevel = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      angles.push({
        name:       FRONTAL_METRIC_NAMES.pelvicObliquity,
        joint:      'pelvis',
        side:       'center',
        degrees:    round1(tiltFromLevel),
        confidence: Math.min(lh.confidence, rh.confidence),
        note:       'Estimated tilt of the hip line from level (0° = hips level)',
      });
    }
  }

  // Frontal-plane knee position — signed offset of the knee from the straight
  // hip→ankle line, normalized by limb length (% of limb length). Positive =
  // knee sits toward the body midline (may be associated with a valgus/knee-in
  // position); negative = toward the outside.
  const midHipX = lh && rh ? (lh.x + rh.x) / 2 : undefined;
  for (const side of ['left', 'right'] as const) {
    const hip   = findJoint(joints, `${side}_hip` as PoseJointName);
    const knee  = findJoint(joints, `${side}_knee` as PoseJointName);
    const ankle = findJoint(joints, `${side}_ankle` as PoseJointName);
    if (!hip || !knee || !ankle) continue;

    const dy = ankle.y - hip.y;
    if (dy === 0) continue;                    // no vertical span → can't project
    const limbLen = Math.hypot(ankle.x - hip.x, ankle.y - hip.y);
    if (limbLen === 0) continue;

    // Where the hip→ankle line sits in x at the knee's height, then the knee's
    // horizontal offset from it.
    const t = (knee.y - hip.y) / dy;
    const lineX = hip.x + t * (ankle.x - hip.x);
    const rawOffset = knee.x - lineX;

    // Sign so "+" always means "toward the midline" regardless of side.
    const medialSign = midHipX !== undefined ? Math.sign(midHipX - hip.x) || 1 : 1;
    const normalized = (rawOffset * medialSign) / limbLen * 100;

    angles.push({
      name:       FRONTAL_METRIC_NAMES.frontalKnee,
      joint:      'knee',
      side,
      degrees:    round1(normalized),
      confidence: Math.min(hip.confidence, knee.confidence, ankle.confidence),
      note:       'Estimated knee position vs the hip–ankle line (% of limb length; + = toward midline)',
    });
  }

  // Trunk lateral lean — signed side-to-side lean of the shoulder→hip line from
  // vertical. Positive = shoulders sit to the image-right of the hips.
  const ls = findJoint(joints, 'left_shoulder');
  const rs = findJoint(joints, 'right_shoulder');
  if (ls && rs && lh && rh) {
    const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const hipMid      = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const dx = shoulderMid.x - hipMid.x;
    const dy = shoulderMid.y - hipMid.y;
    if (dx !== 0 || dy !== 0) {
      const signedLean = (Math.atan2(dx, Math.abs(dy)) * 180) / Math.PI;
      angles.push({
        name:       FRONTAL_METRIC_NAMES.trunkLateralLean,
        joint:      'trunk',
        side:       'center',
        degrees:    round1(signedLean),
        confidence: Math.min(ls.confidence, rs.confidence, lh.confidence, rh.confidence),
        note:       'Estimated side-to-side trunk lean from vertical (+ = leaning image-right)',
      });
    }
  }

  return angles;
}

// ─── Closest side to the camera ───────────────────────────────────────────────
//
// On a lateral capture the limb nearest the camera is detected with higher
// landmark confidence; the far limb is partly occluded. We compare mean
// per-side landmark confidence (averaged across frames for a sequence) and
// report the more-confident side. When the two sides are within a small
// margin the result is flagged 'low' so the UI can ask the athlete which side
// faced the camera rather than guessing.

const SIDE_LANDMARKS: Record<'left' | 'right', PoseJointName[]> = {
  left:  ['left_shoulder', 'left_elbow', 'left_wrist', 'left_hip', 'left_knee', 'left_ankle'],
  right: ['right_shoulder', 'right_elbow', 'right_wrist', 'right_hip', 'right_knee', 'right_ankle'],
};

const CLOSEST_SIDE_MARGIN = 0.05;   // mean-confidence gap below this → 'low'

type ConfidenceCarrier = { name: string; confidence: number };

function meanSideConfidence(records: ConfidenceCarrier[], side: 'left' | 'right'): { sum: number; count: number } {
  const names = SIDE_LANDMARKS[side];
  let sum = 0;
  let count = 0;
  for (const r of records) {
    if (names.includes(r.name as PoseJointName)) { sum += r.confidence; count += 1; }
  }
  return { sum, count };
}

/**
 * Decide which side faced the camera from per-side landmark confidence.
 * Accepts either a full pose sequence or a flat landmark list. Returns null
 * when there is no usable data; otherwise the more-confident side with a
 * 'high' / 'low' confidence flag (low when the sides are within a small
 * margin, i.e. the automatic guess isn't trustworthy).
 */
export function determineClosestSide(
  input: PoseSequenceResult | PoseLandmarkRecord[],
): { side: 'left' | 'right'; confidence: 'high' | 'low' } | null {
  const records: ConfidenceCarrier[] = Array.isArray(input)
    ? input
    : input.frames.flatMap(f => f.joints);

  if (records.length === 0) return null;

  const left  = meanSideConfidence(records, 'left');
  const right = meanSideConfidence(records, 'right');
  if (left.count === 0 && right.count === 0) return null;

  const leftMean  = left.count  > 0 ? left.sum  / left.count  : 0;
  const rightMean = right.count > 0 ? right.sum / right.count : 0;

  const side: 'left' | 'right' = leftMean >= rightMean ? 'left' : 'right';
  const gap = Math.abs(leftMean - rightMean);
  const bothSidesSeen = left.count > 0 && right.count > 0;
  const confidence: 'high' | 'low' = bothSidesSeen && gap >= CLOSEST_SIDE_MARGIN ? 'high' : 'low';

  return { side, confidence };
}

// ─── Detection-quality classification ─────────────────────────────────────────

/**
 * Overall confidence classification for a pose result.
 * undefined/empty → manual_review; strong detections rank high/moderate.
 */
export function classifyPoseConfidence(joints: PoseJoint[] | undefined): AnalysisConfidence {
  if (!joints || joints.length === 0) return 'manual_review';
  const mean = joints.reduce((sum, j) => sum + j.confidence, 0) / joints.length;
  if (mean >= 0.75 && joints.length >= 12) return 'high';
  if (mean >= 0.5 && joints.length >= 10) return 'moderate';
  return 'low';
}
