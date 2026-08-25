// ─── Measurement-Permission Matrix ─────────────────────────────────────────────
//
// The single source of truth for WHICH estimated measurements are valid for a
// given movement × camera view. Build 36 binding contract (see
// docs/build36-fable-ticket.md → "Measurement-permission matrix"). Agents B and
// C consume these exact export signatures.
//
// Core rules:
//   • Lateral lower-body kinds → closest-side knee flexion, anatomical hip
//     flexion/extension, trunk inclination. NEVER elbow/wrist/shoulder or both limbs.
//   • Bike Fit lateral → one closest-side rider chain, including supported
//     shoulder/elbow estimates plus knee, hip, and trunk. Bicycle geometry,
//     forces, pressure, cleat position, and exact fit prescriptions stay manual.
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
  KeyFrameRecord,
  MovementAnalysis,
  MovementAnalysisKind,
  MovementViewAngle,
  PoseLandmarkRecord,
} from '../types/movement';
import type { PoseJoint, PoseSequenceResult } from 'stride-pose';
import {
  computeEstimatedAngles,
  FRONTAL_METRIC_NAMES,
  determineClosestSide as determineClosestSideImpl,
} from './poseAngles';

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
  id:              string;   // stable measurement-contract identifier
  label:           string;
  joint:           string;
  bilateral:       boolean;  // frontal/posterior L/R-comparison metrics only
  closestSideOnly: boolean;  // lateral sagittal metrics only
};

export type MovementBodyRegion = 'lower_body' | 'upper_body' | 'whole_body' | 'custom';

export type MovementOverlayConfiguration = {
  requiredView: MovementViewAngle;
  primaryBodyRegion: MovementBodyRegion;
  visibleJoints: string[];
  visibleConnections: [string, string][];
  allowedMeasurements: MeasurementSpec[];
  prohibitedMeasurements: string[];
  prohibitedChecklistIds: string[];
  bilateralDisplayAllowed: boolean;
  closestSideRequired: boolean;
  symmetryAllowed: boolean;
  manualReviewRequired: boolean;
};

/** Maps a MeasurementSpec.id to the series/angle `name` string that
 *  poseAngles / poseSequence actually emit, so the filters can gate by id. */
const MEASUREMENT_ANGLE_NAMES: Record<string, string[]> = {
  knee_flexion:          ['Knee flexion'],
  hip_sagittal_motion:   ['Hip flexion', 'Hip extension'],
  trunk_lean:            ['Trunk lean'],
  elbow_angle:           ['Elbow angle'],
  shoulder_angle:        ['Shoulder angle'],
  pelvic_obliquity:      [FRONTAL_METRIC_NAMES.pelvicObliquity],
  frontal_knee_position: [FRONTAL_METRIC_NAMES.frontalKnee],
  trunk_lateral_lean:    [FRONTAL_METRIC_NAMES.trunkLateralLean],
};

// ── Spec definitions ──────────────────────────────────────────────────────────

const KNEE_FLEXION_SPEC: MeasurementSpec = {
  id: 'knee_flexion', label: 'Knee flexion', joint: 'knee', bilateral: false, closestSideOnly: true,
};
const HIP_ANGLE_SPEC: MeasurementSpec = {
  id: 'hip_sagittal_motion', label: 'Hip flexion / extension', joint: 'hip', bilateral: false, closestSideOnly: true,
};
const TRUNK_LEAN_SPEC: MeasurementSpec = {
  id: 'trunk_lean', label: 'Trunk inclination', joint: 'trunk', bilateral: false, closestSideOnly: false,
};
const ELBOW_ANGLE_SPEC: MeasurementSpec = {
  id: 'elbow_angle', label: 'Elbow angle', joint: 'elbow', bilateral: false, closestSideOnly: true,
};
const SHOULDER_ANGLE_SPEC: MeasurementSpec = {
  id: 'shoulder_angle', label: 'Shoulder position', joint: 'shoulder', bilateral: false, closestSideOnly: true,
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
const BIKE_FIT_LATERAL: MeasurementSpec[] = [
  KNEE_FLEXION_SPEC,
  HIP_ANGLE_SPEC,
  TRUNK_LEAN_SPEC,
  ELBOW_ANGLE_SPEC,
  SHOULDER_ANGLE_SPEC,
];

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

const REQUIRED_VIEW: Record<MovementAnalysisKind, MovementViewAngle> = {
  running_gait: 'side',
  bike_fit: 'side',
  squat: 'side',
  deadlift: 'side',
  single_leg_control: 'front',
  lunge: 'side',
  general: 'unknown',
  lunge_single_leg: 'unknown',
};

const LOWER_BODY_PROHIBITED = [
  'Elbow angle',
  'Wrist angle',
  'Hand angle',
  'Shoulder angle',
  'Ankle dorsiflexion without foot landmarks',
  'Footstrike classification',
];

const BIKE_FIT_PROHIBITED = [
  'Far-side joint measurements',
  'Left/right symmetry from one lateral view',
  'Ankle angle without validated foot landmarks',
  'Saddle fore-aft from untracked pedal spindle geometry',
  'Cleat position',
  'Pelvic rocking',
  'Pressure distribution',
  'Joint loading or force',
  'Exact bicycle geometry',
  'Aerodynamic optimization',
  'Diagnosis or injury prediction',
];

const UPPER_BODY_PROHIBITED = [
  'Knee flexion',
  'Hip flexion',
  'Hip extension',
  'Ankle angle',
  'Foot angle',
];

const LATERAL_PROHIBITED_CHECKLIST_IDS = [
  'symmetry', 'arm_swing', 'pelvic_drop', 'knee_valgus', 'crossover', 'hip_shift',
];

const FRONTAL_PROHIBITED_CHECKLIST_IDS = [
  'overstride', 'vertical_oscillation', 'depth', 'trunk_angle',
  'hip_hinge', 'bar_path', 'lockout', 'start_position',
];

const CENTER_JOINTS = ['nose', 'neck', 'mid_hip'];
const LATERAL_DISPLAY_CENTER_JOINTS = ['nose', 'neck'];
const LOWER_BODY_SIDE_JOINTS = ['shoulder', 'hip', 'knee', 'ankle'];
const BIKE_FIT_SIDE_JOINTS = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'];
const FRONTAL_LOWER_BODY_JOINTS = [
  'nose', 'neck', 'mid_hip',
  'left_shoulder', 'right_shoulder',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
];

function lateralJoints(closestSide?: 'left' | 'right'): string[] {
  if (!closestSide) return CENTER_JOINTS;
  return [
    ...LATERAL_DISPLAY_CENTER_JOINTS,
    ...LOWER_BODY_SIDE_JOINTS.map(joint => `${closestSide}_${joint}`),
  ];
}

function lateralConnections(closestSide?: 'left' | 'right'): [string, string][] {
  if (!closestSide) return [];
  return [
    ['neck', `${closestSide}_shoulder`],
    [`${closestSide}_shoulder`, `${closestSide}_hip`],
    [`${closestSide}_hip`, `${closestSide}_knee`],
    [`${closestSide}_knee`, `${closestSide}_ankle`],
  ];
}

function bikeFitLateralJoints(closestSide?: 'left' | 'right'): string[] {
  if (!closestSide) return CENTER_JOINTS;
  return [
    ...LATERAL_DISPLAY_CENTER_JOINTS,
    ...BIKE_FIT_SIDE_JOINTS.map(joint => `${closestSide}_${joint}`),
  ];
}

function bikeFitLateralConnections(closestSide?: 'left' | 'right'): [string, string][] {
  if (!closestSide) return [];
  return [
    ['neck', `${closestSide}_shoulder`],
    [`${closestSide}_shoulder`, `${closestSide}_elbow`],
    [`${closestSide}_elbow`, `${closestSide}_wrist`],
    [`${closestSide}_shoulder`, `${closestSide}_hip`],
    [`${closestSide}_hip`, `${closestSide}_knee`],
    [`${closestSide}_knee`, `${closestSide}_ankle`],
  ];
}

const FRONTAL_CONNECTIONS: [string, string][] = [
  ['neck', 'left_shoulder'], ['neck', 'right_shoulder'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
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

  if (kind === 'bike_fit') {
    return cv === 'lateral' ? BIKE_FIT_LATERAL : [];
  }

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
  return new Set(permittedMeasurements(kind, view).flatMap(spec => MEASUREMENT_ANGLE_NAMES[spec.id] ?? []));
}

/** Which permitted names are closest-side-only (drop the non-closest side). */
function closestSideOnlyNames(kind: MovementAnalysisKind, view: MovementViewAngle): Set<string> {
  return new Set(
    permittedMeasurements(kind, view)
      .filter(spec => spec.closestSideOnly)
      .flatMap(spec => MEASUREMENT_ANGLE_NAMES[spec.id] ?? []),
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
  'running_gait', 'bike_fit', 'squat', 'deadlift', 'single_leg_control', 'lunge', 'general',
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
  return (isLowerBody(kind) || kind === 'bike_fit') && canonicalView(view) === 'lateral';
}

/** Centralized movement/view presentation contract used by capture guidance,
 * overlays, charts, saved records, and Coach handoffs. */
export function movementOverlayConfiguration(
  kind: MovementAnalysisKind,
  view: MovementViewAngle,
  closestSide?: 'left' | 'right',
  bodyRegion: MovementBodyRegion = kind === 'general' ? 'custom' : kind === 'bike_fit' ? 'whole_body' : 'lower_body',
): MovementOverlayConfiguration {
  const cv = canonicalView(view);
  const lateral = cv === 'lateral';
  const frontal = cv === 'frontal' || cv === 'posterior';
  const lowerBody = bodyRegion === 'lower_body' || bodyRegion === 'whole_body';
  const bikeFit = kind === 'bike_fit';

  const visibleJoints = lowerBody
    ? bikeFit
      ? lateral ? bikeFitLateralJoints(closestSide) : []
      : lateral ? lateralJoints(closestSide) : frontal ? FRONTAL_LOWER_BODY_JOINTS : CENTER_JOINTS
    : [];
  const visibleConnections = lowerBody
    ? bikeFit
      ? lateral ? bikeFitLateralConnections(closestSide) : []
      : lateral ? lateralConnections(closestSide) : frontal ? FRONTAL_CONNECTIONS : []
    : [];

  return {
    requiredView: REQUIRED_VIEW[kind] ?? 'unknown',
    primaryBodyRegion: bodyRegion,
    visibleJoints,
    visibleConnections,
    allowedMeasurements: bodyRegion === 'upper_body' ? [] : permittedMeasurements(kind, view),
    prohibitedMeasurements: bodyRegion === 'upper_body'
      ? UPPER_BODY_PROHIBITED
      : bikeFit ? BIKE_FIT_PROHIBITED : LOWER_BODY_PROHIBITED,
    prohibitedChecklistIds: lateral
      ? LATERAL_PROHIBITED_CHECKLIST_IDS
      : frontal ? FRONTAL_PROHIBITED_CHECKLIST_IDS : [],
    bilateralDisplayAllowed: frontal && !bikeFit,
    closestSideRequired: lowerBody && lateral,
    symmetryAllowed: frontal && !bikeFit,
    manualReviewRequired: kind === 'general' || kind === 'bike_fit' || cv === 'unknown',
  };
}

export function filterChecklistItemsForView<T extends { id?: string; itemId?: string }>(
  items: T[],
  kind: MovementAnalysisKind,
  view: MovementViewAngle,
): T[] {
  const prohibited = new Set(movementOverlayConfiguration(kind, view).prohibitedChecklistIds);
  return items.filter(item => !prohibited.has(item.id ?? item.itemId ?? ''));
}

export function filterLandmarksForDisplay(
  landmarks: PoseLandmarkRecord[] | undefined,
  kind: MovementAnalysisKind,
  view: MovementViewAngle,
  closestSide?: 'left' | 'right',
  bodyRegion?: MovementBodyRegion,
): PoseLandmarkRecord[] | undefined {
  if (!landmarks) return undefined;
  const allowed = new Set(movementOverlayConfiguration(kind, view, closestSide, bodyRegion).visibleJoints);
  const filtered = new Map<string, PoseLandmarkRecord>();
  for (const landmark of landmarks) {
    if (allowed.has(landmark.name)) filtered.set(landmark.name, landmark);
  }
  return Array.from(filtered.values());
}

export function filterKeyFrames(
  keyFrames: KeyFrameRecord[] | undefined,
  kind: MovementAnalysisKind,
  view: MovementViewAngle,
  closestSide?: 'left' | 'right',
): KeyFrameRecord[] | undefined {
  if (!keyFrames) return undefined;
  const farSide = closestSide === 'left' ? 'right' : closestSide === 'right' ? 'left' : null;
  return keyFrames
    .filter(frame => !farSide || !frame.label.toLowerCase().includes(`— ${farSide}`))
    .map(frame => ({
      ...frame,
      landmarks: filterLandmarksForDisplay(frame.landmarks, kind, view, closestSide),
      angles: frame.angles ? filterEstimatedAngles(frame.angles, kind, view, closestSide) : undefined,
    }));
}

/** Preserves raw/original values while materializing the effective values the
 * athlete is allowed to see for this movement, view, and closest-side choice. */
export function applyAnalysisViewFilters(analysis: MovementAnalysis): MovementAnalysis {
  const rawLandmarks = analysis.rawLandmarks ?? analysis.autoLandmarks ?? analysis.landmarks;
  const legacyConvention = analysis.measurementConventionVersion !== 2;
  const legacyAngleNames = new Set(['Hip angle']);
  const originalRawEstimatedAngles = analysis.rawEstimatedAngles ?? analysis.estimatedAngles;
  const recomputedHipAngles = legacyConvention && rawLandmarks && canonicalView(analysis.cameraView) === 'lateral'
      ? computeEstimatedAngles(rawLandmarks as PoseJoint[], analysis.type, {
        view: analysis.cameraView,
        subjectFacing: analysis.captureMetadata?.subjectFacing,
      }).filter(angle => angle.metricId === 'hip_sagittal_motion')
    : [];
  const effectiveEstimatedAngles = legacyConvention
    ? [
        ...(originalRawEstimatedAngles ?? []).filter(angle => !legacyAngleNames.has(angle.name)),
        ...recomputedHipAngles,
      ]
    : originalRawEstimatedAngles;
  const rawAngleSeries = analysis.rawAngleSeries ?? analysis.angleSeries;
  const rawKeyFrames = analysis.rawKeyFrames ?? analysis.keyFrames;
  const rawRepSummaries = analysis.repSummaries;
  const rawSymmetryEstimates = analysis.symmetryEstimates;
  const config = movementOverlayConfiguration(analysis.type, analysis.cameraView, analysis.closestSide);
  const mirrored = analysis.captureMetadata?.isMirrored === true;
  const inlineDataAlreadyMaterialized = analysis.viewFiltersMaterialized === true;
  const seriesAlreadyMaterialized = inlineDataAlreadyMaterialized && !analysis.rawAngleSeries;
  const keyFramesAlreadyMaterialized = inlineDataAlreadyMaterialized && !analysis.rawKeyFrames;
  const swapName = (name: string) => mirrored
    ? name.replace(/^left_/, '__swap_').replace(/^right_/, 'left_').replace(/^__swap_/, 'right_')
    : name;
  const swapSide = (side: 'left' | 'right' | 'center') => !mirrored || side === 'center'
    ? side
    : side === 'left' ? 'right' : 'left';
  const swapSideText = (value: string) => mirrored
    ? value.replace(/\bleft\b/gi, '__swap_side__').replace(/\bright\b/gi, 'left').replace(/__swap_side__/g, 'right')
    : value;
  const normalizedLandmarks = rawLandmarks?.map(landmark => ({ ...landmark, name: swapName(landmark.name) }));
  const normalizedAngles = effectiveEstimatedAngles?.map(angle => ({ ...angle, side: swapSide(angle.side) }));
  const normalizedSeries = rawAngleSeries
    ?.filter(series => !legacyConvention || !legacyAngleNames.has(series.name))
    .map(series => ({
    ...series,
    side: seriesAlreadyMaterialized ? series.side : swapSide(series.side),
  }));
  const normalizedKeyFrames = rawKeyFrames?.map(frame => ({
    ...frame,
    label: keyFramesAlreadyMaterialized ? frame.label : swapSideText(frame.label),
    landmarks: frame.landmarks?.map(landmark => ({
      ...landmark,
      name: keyFramesAlreadyMaterialized ? landmark.name : swapName(landmark.name),
    })),
    angles: frame.angles
      ?.filter(angle => !legacyConvention || !legacyAngleNames.has(angle.name))
      .map(angle => ({
        ...angle,
        side: keyFramesAlreadyMaterialized ? angle.side : swapSide(angle.side),
      })),
  }));
  const suppressedLegacy = legacyConvention && (
    (originalRawEstimatedAngles ?? []).some(angle => legacyAngleNames.has(angle.name))
    || (analysis.angleSeries ?? []).some(series => legacyAngleNames.has(series.name))
  );
  const legacyLimitation = 'Legacy included hip-angle values were hidden. Anatomical hip flexion or extension requires reanalysis from direct-lateral raw landmarks.';

  return {
    ...analysis,
    rawLandmarks,
    rawEstimatedAngles: originalRawEstimatedAngles,
    rawAngleSeries,
    rawKeyFrames,
    measurementConventionVersion: 2,
    legacyMeasurementsSuppressed: suppressedLegacy
      ? [...new Set([...(analysis.legacyMeasurementsSuppressed ?? []), 'Hip angle'])]
      : analysis.legacyMeasurementsSuppressed,
    limitations: suppressedLegacy && recomputedHipAngles.length === 0
      ? [...new Set([...analysis.limitations, legacyLimitation])]
      : analysis.limitations,
    viewFiltersMaterialized: true,
    displayLandmarks: filterLandmarksForDisplay(normalizedLandmarks, analysis.type, analysis.cameraView, analysis.closestSide),
    landmarks: filterLandmarksForDisplay(normalizedLandmarks, analysis.type, analysis.cameraView, analysis.closestSide),
    estimatedAngles: normalizedAngles
      ? filterEstimatedAngles(normalizedAngles, analysis.type, analysis.cameraView, analysis.closestSide)
      : undefined,
    checklistFindings: filterChecklistItemsForView(analysis.checklistFindings, analysis.type, analysis.cameraView),
    angleSeries: normalizedSeries
      ? filterAngleSeries(normalizedSeries, analysis.type, analysis.cameraView, analysis.closestSide)
      : undefined,
    keyFrames: filterKeyFrames(normalizedKeyFrames, analysis.type, analysis.cameraView, analysis.closestSide),
    repSummaries: legacyConvention
      ? rawRepSummaries?.map(rep => ({ ...rep, hipAngleAtBottom: undefined }))
      : rawRepSummaries,
    symmetryEstimates: config.symmetryAllowed ? rawSymmetryEstimates : undefined,
  };
}

/** Re-export so consumers that only import the matrix have the sequence type. */
export type { PoseSequenceResult, PoseLandmarkRecord };
