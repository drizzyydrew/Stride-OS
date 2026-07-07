// ─── Pose Angles ──────────────────────────────────────────────────────────────
//
// Pure geometry over stride-pose landmarks (normalized 0…1, origin top-left).
// Every function is deterministic and side-effect free. Angles are only
// computed when ALL contributing landmarks clear the confidence floor —
// missing or low-confidence joints mean the angle is skipped, never guessed.
//
// NOTE: Apple Vision provides no foot/toe landmarks, so ankle dorsiflexion /
// plantarflexion can NOT be estimated. Callers should surface that limitation.

import type { PoseJoint, PoseJointName } from 'stride-pose';
import type { AnalysisConfidence, EstimatedAngle, MovementAnalysisKind } from '../types/movement';

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
