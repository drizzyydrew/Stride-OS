// ─── Measurement-Permission Matrix ─────────────────────────────────────────────
//
// The single source of truth for WHICH estimated measurements are valid for a
// given movement × camera view. Build 36 binding contract (see
// docs/build36-fable-ticket.md → "Measurement-permission matrix"). Agents B and
// C consume these exact export signatures.
//
// Core rules:
//   • Lateral lower-body kinds → closest-side knee flexion, closest-side hip
//     angle, trunk inclination. NEVER elbow/wrist/shoulder. NEVER both limbs.
//   • Frontal / posterior → pelvic obliquity, frontal-plane knee position,
//     trunk lateral lean, L/R comparison. NO sagittal knee-flexion ROM as a
//     primary metric.
//   • Anything outside the matrix is omitted, never estimated.
//
// Everything here is pure and deterministic — no React, no Expo, no I/O — so it
// is safe to unit-test in isolation.

import type {
  AngleSeries,
  EstimatedAngle,
  MovementAnalysisKind,
  MovementViewAngle,
  PoseLandmarkRecord,
} from '../types/movement';
import type { PoseSequenceResult } from 'stride-pose';
import { FRONTAL_METRIC_NAMES, determineClosestSide as determineClosestSideImpl } from './poseAngles';

// Re-export so the binding API surface lives on measurementMatrix, while the
// geometry implementation stays with the rest of the pose math.
export const determineClosestSide = determineClosestSideImpl;

// ─── Canonical view ─────────────────────────────────────────────────────────

export type CanonicalView = 'lateral' | 'frontal' | 'posterior' | 'unknown';

/** side→lateral, front→frontal, rear→posterior, 45_degree|unknown→unknown. */
export function canonicalView(view: MovementViewAngle): CanonicalView {
  switch (view) {
    case 'side':  return 'lateral';
    case 'front': return 'frontal';
    case 'rear':  return 'posterior';
    default:      return 'unknown';   // 45_degree (legacy) + unknown
  }
}

// ─── Measurement spec ─────────────────────────────────────────────────────────

export type MeasurementSpec = {
  id:              string;   // 'knee_flexion' | 'hip_angle' | 'trunk_lean' | 'pelvic_obliquity' | 'frontal_knee_position' | 'trunk_lateral_lean'
  label:           string;
  joint:           string;
  bilateral:       boolean;  // frontal/posterior L/R-comparison metrics only
  closestSideOnly: boolean;  // lateral sagittal metrics only
};

/** Maps a MeasurementSpec.id to the series/angle `name` string that
 *  poseAngles / poseSequence actually emit, so the filters can gate by id. */
const MEASUREMENT_ANGLE_NAME: Record<string, string> = {
  knee_flexion:          'Knee flexion',
  hip_angle:             'Hip angle',
  trunk_lean:            'Trunk lean',
  pelvic_obliquity:      FRONTAL_METRIC_NAMES.pelvicObliquity,
  frontal_knee_position: FRONTAL_METRIC_NAMES.frontalKnee,
  trunk_lateral_lean:    FRONTAL_METRIC_NAMES.trunkLateralLean,
};

// ── Spec definitions ──────────────────────────────────────────────────────────

const KNEE_FLEXION_SPEC: MeasurementSpec = {
  id: 'knee_flexion', label: 'Knee flexion', joint: 'knee', bilateral: false, closestSideOnly: true,
};
const HIP_ANGLE_SPEC: MeasurementSpec = {
  id: 'hip_angle', label: 'Hip angle', joint: 'hip', bilateral: false, closestSideOnly: true,
};
const TRUNK_LEAN_SPEC: MeasurementSpec = {
  id: 'trunk_lean', label: 'Trunk inclination', joint: 'trunk', bilateral: false, closestSideOnly: false,
};
const PELVIC_OBLIQUITY_SPEC: MeasurementSpec = {
  id: 'pelvic_obliquity', label: 'Pelvic obliquity', joint: 'pelvis', bilateral: false, closestSideOnly: false,
};
const FRONTAL_KNEE_SPEC: MeasurementSpec = {
  id: 'frontal_knee_position', label: 'Frontal-plane knee position', joint: 'knee', bilateral: true, closestSideOnly: false,
};
const TRUNK_LATERAL_LEAN_SPEC: MeasurementSpec = {
  id: 'trunk_lateral_lean', label: 'Trunk lateral lean', joint: 'trunk', bilateral: false, closestSideOnly: false,
};

/** Closest-side sagittal set — the only metrics valid for a lateral lower-body clip. */
const LATERAL_LOWER_BODY: MeasurementSpec[] = [KNEE_FLEXION_SPEC, HIP_ANGLE_SPEC, TRUNK_LEAN_SPEC];

/** Frontal / posterior set — bilateral, frontal-plane control metrics. */
const FRONTAL_SET: MeasurementSpec[] = [PELVIC_OBLIQUITY_SPEC, FRONTAL_KNEE_SPEC, TRUNK_LATERAL_LEAN_SPEC];

/** Conservative fallback when the view is unknown (including legacy angled views). */
const UNKNOWN_FALLBACK: MeasurementSpec[] = [TRUNK_LEAN_SPEC];

// ─── Kind classification ──────────────────────────────────────────────────────

/** Lower-body kinds whose lateral capture uses the sagittal closest-side set.
 *  (single_leg_control defaults to frontal but is optionally lateral.) */
const LOWER_BODY_KINDS: MovementAnalysisKind[] = [
  'running_gait', 'squat', 'deadlift', 'lunge', 'single_leg_control',
];

function isLowerBody(kind: MovementAnalysisKind): boolean {
  return LOWER_BODY_KINDS.includes(kind);
}

// ─── permittedMeasurements ────────────────────────────────────────────────────

export function permittedMeasurements(
  kind: MovementAnalysisKind,
  view: MovementViewAngle,
): MeasurementSpec[] {
  const cv = canonicalView(view);

  if (kind === 'general') {
    // Only measurements valid for the user-selected view.
    if (cv === 'lateral') return LATERAL_LOWER_BODY;
    if (cv === 'frontal' || cv === 'posterior') return FRONTAL_SET;
    return UNKNOWN_FALLBACK;
  }

  if (isLowerBody(kind)) {
    if (cv === 'lateral') return LATERAL_LOWER_BODY;
    if (cv === 'frontal' || cv === 'posterior') return FRONTAL_SET;
    return UNKNOWN_FALLBACK;   // unknown / legacy angled view -> conservative
  }

  // No other kinds today; be conservative.
  return UNKNOWN_FALLBACK;
}

/** The set of series/angle names permitted for this kind × view. */
function permittedAngleNames(kind: MovementAnalysisKind, view: MovementViewAngle): Set<string> {
  return new Set(permittedMeasurements(kind, view).map(spec => MEASUREMENT_ANGLE_NAME[spec.id]));
}

/** Which permitted names are closest-side-only (drop the non-closest side). */
function closestSideOnlyNames(kind: MovementAnalysisKind, view: MovementViewAngle): Set<string> {
  return new Set(
    permittedMeasurements(kind, view)
      .filter(spec => spec.closestSideOnly)
      .map(spec => MEASUREMENT_ANGLE_NAME[spec.id]),
  );
}

// ─── filterEstimatedAngles ────────────────────────────────────────────────────

export function filterEstimatedAngles(
  angles:      EstimatedAngle[],
  kind:        MovementAnalysisKind,
  view:        MovementViewAngle,
  closestSide?: 'left' | 'right',
): EstimatedAngle[] {
  const permitted = permittedAngleNames(kind, view);
  const closestOnly = closestSideOnlyNames(kind, view);

  return angles.filter(a => {
    if (!permitted.has(a.name)) return false;
    if (closestOnly.has(a.name) && a.side !== 'center') {
      if (!closestSide || a.side !== closestSide) return false;
    }
    return true;
  });
}

// ─── filterAngleSeries ────────────────────────────────────────────────────────

export function filterAngleSeries(
  series:      AngleSeries[],
  kind:        MovementAnalysisKind,
  view:        MovementViewAngle,
  closestSide?: 'left' | 'right',
): AngleSeries[] {
  const permitted = permittedAngleNames(kind, view);
  const closestOnly = closestSideOnlyNames(kind, view);

  return series.filter(s => {
    if (!permitted.has(s.name)) return false;
    if (closestOnly.has(s.name) && s.side !== 'center') {
      if (!closestSide || s.side !== closestSide) return false;
    }
    return true;
  });
}

// ─── normalizeAnalysisKind ────────────────────────────────────────────────────
//
// Maps a persisted kind string (possibly the deprecated `lunge_single_leg`, or
// an unknown value from an older/newer store) onto a current MovementAnalysisKind.
// Legacy split by camera view: front → single_leg_control, side → lunge, other
// → single_leg_control.

const CURRENT_KINDS: MovementAnalysisKind[] = [
  'running_gait', 'squat', 'deadlift', 'single_leg_control', 'lunge', 'general',
];

export function normalizeAnalysisKind(
  kind:        string,
  cameraView?: MovementViewAngle,
): MovementAnalysisKind {
  if (kind === 'lunge_single_leg') {
    if (cameraView === 'front') return 'single_leg_control';
    if (cameraView === 'side')  return 'lunge';
    return 'single_leg_control';
  }
  if ((CURRENT_KINDS as string[]).includes(kind)) return kind as MovementAnalysisKind;
  return 'general';   // defensive: unknown persisted kind
}

// ─── Record migration (pure) ──────────────────────────────────────────────────
//
// Normalizes the `type` field of a persisted analysis-shaped record, preserving
// every other field verbatim. Lives here (not in the store) so it can be unit-
// tested without pulling in React Native / AsyncStorage. movementStore's persist
// merge calls this on rehydrate so Build 32/34/35 records migrate transparently.

export function migrateAnalysisKind<T extends { type: string; cameraView?: MovementViewAngle }>(
  record: T,
): T & { type: MovementAnalysisKind } {
  return { ...record, type: normalizeAnalysisKind(record.type, record.cameraView) };
}

// ─── Convenience ──────────────────────────────────────────────────────────────

/** True when the kind × view combination is a lateral lower-body clip whose
 *  sagittal metrics must be reported for the closest side only. Used by the UI
 *  to decide whether to show the "which side faced the camera?" chooser. */
export function requiresClosestSide(kind: MovementAnalysisKind, view: MovementViewAngle): boolean {
  return isLowerBody(kind) && canonicalView(view) === 'lateral';
}

/** Re-export so consumers that only import the matrix have the sequence type. */
export type { PoseSequenceResult, PoseLandmarkRecord };
