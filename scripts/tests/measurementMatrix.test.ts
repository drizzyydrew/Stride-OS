import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyAnalysisViewFilters,
  filterAngleSeries,
  filterChecklistItemsForView,
  filterEstimatedAngles,
  filterLandmarksForDisplay,
  migrateAnalysisKind,
  movementOverlayConfiguration,
  permittedMeasurements,
} from '../../src/utils/measurementMatrix';
import type { AngleSeries, EstimatedAngle, MovementAnalysis, PoseLandmarkRecord } from '../../src/types/movement';

const angles: EstimatedAngle[] = [
  { name: 'Knee flexion', joint: 'knee', side: 'left', degrees: 80, confidence: 0.9 },
  { name: 'Knee flexion', joint: 'knee', side: 'right', degrees: 82, confidence: 0.9 },
  { name: 'Hip flexion', joint: 'hip', side: 'left', degrees: 70, confidence: 0.9, metricId: 'hip_sagittal_motion', motion: 'flexion' },
  { name: 'Hip flexion', joint: 'hip', side: 'right', degrees: 72, confidence: 0.9, metricId: 'hip_sagittal_motion', motion: 'flexion' },
  { name: 'Trunk lean', joint: 'trunk', side: 'center', degrees: 12, confidence: 0.9 },
  { name: 'Elbow angle', joint: 'elbow', side: 'left', degrees: 90, confidence: 0.9 },
];

test('lateral lower-body measurements retain only the selected closest limb', () => {
  const filtered = filterEstimatedAngles(angles, 'squat', 'side', 'left');
  assert.deepEqual(filtered.map(a => `${a.name}:${a.side}`), [
    'Knee flexion:left',
    'Hip flexion:left',
    'Trunk lean:center',
  ]);
});

test('lateral side-specific metrics remain hidden until closest side is known', () => {
  const filtered = filterEstimatedAngles(angles, 'running_gait', 'side');
  assert.deepEqual(filtered.map(a => `${a.name}:${a.side}`), ['Trunk lean:center']);
});

test('frontal measurements are frontal-plane and bilateral where specified', () => {
  const specs = permittedMeasurements('single_leg_control', 'front');
  assert.deepEqual(specs.map(spec => spec.id), [
    'pelvic_obliquity',
    'frontal_knee_position',
    'trunk_lateral_lean',
  ]);
  assert.equal(specs.find(spec => spec.id === 'frontal_knee_position')?.bilateral, true);
});

test('angle-series filtering follows the same closest-side rule', () => {
  const series = angles.map<AngleSeries>(angle => ({
    name: angle.name,
    joint: angle.joint,
    side: angle.side,
    points: [{ timeMs: 0, degrees: angle.degrees, confidence: angle.confidence }],
  }));
  assert.deepEqual(
    filterAngleSeries(series, 'deadlift', 'side', 'right').map(item => `${item.name}:${item.side}`),
    ['Knee flexion:right', 'Hip flexion:right', 'Trunk lean:center'],
  );
});

test('legacy combined movement kinds migrate by camera view', () => {
  assert.equal(migrateAnalysisKind({ type: 'lunge_single_leg', cameraView: 'front' as const }).type, 'single_leg_control');
  assert.equal(migrateAnalysisKind({ type: 'lunge_single_leg', cameraView: 'side' as const }).type, 'lunge');
});

test('side-view lower-body overlay contains one clean closest-side chain', () => {
  const landmarks: PoseLandmarkRecord[] = [
    'nose', 'neck', 'mid_hip',
    'left_shoulder', 'left_hip', 'left_knee', 'left_ankle',
    'right_shoulder', 'right_hip', 'right_knee', 'right_ankle',
  ].map((name, index) => ({ name, x: index / 10, y: index / 10, confidence: 0.95 }));
  const filtered = filterLandmarksForDisplay(landmarks, 'squat', 'side', 'left') ?? [];
  assert.deepEqual(filtered.map(item => item.name), [
    'nose', 'neck',
    'left_shoulder', 'left_hip', 'left_knee', 'left_ankle',
  ]);
  assert.equal(filtered.some(item => item.name === 'mid_hip'), false);
  assert.equal(filtered.some(item => item.name.startsWith('right_')), false);

  const config = movementOverlayConfiguration('squat', 'side', 'left');
  assert.deepEqual(config.visibleConnections, [
    ['neck', 'left_shoulder'],
    ['left_shoulder', 'left_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
  ]);
  assert.equal(config.bilateralDisplayAllowed, false);
  assert.equal(config.symmetryAllowed, false);
});

test('overlay landmark filtering dedupes repeated marker names', () => {
  const landmarks: PoseLandmarkRecord[] = [
    { name: 'left_hip', x: 0.40, y: 0.52, confidence: 0.7 },
    { name: 'left_hip', x: 0.42, y: 0.54, confidence: 0.95 },
    { name: 'left_knee', x: 0.50, y: 0.70, confidence: 0.95 },
  ];
  const filtered = filterLandmarksForDisplay(landmarks, 'squat', 'side', 'left') ?? [];
  assert.deepEqual(filtered.map(item => item.name), ['left_hip', 'left_knee']);
  assert.equal(filtered[0].x, 0.42);
});

test('frontal configuration is bilateral but suppresses sagittal flexion', () => {
  const config = movementOverlayConfiguration('single_leg_control', 'front');
  assert.equal(config.bilateralDisplayAllowed, true);
  assert.equal(config.symmetryAllowed, true);
  assert.equal(config.visibleJoints.includes('left_knee'), true);
  assert.equal(config.visibleJoints.includes('right_knee'), true);
  assert.equal(filterEstimatedAngles(angles, 'single_leg_control', 'front').some(angle => angle.name === 'Knee flexion'), false);
});

test('manual checklist items obey the same camera-view rules', () => {
  const items = [
    { id: 'overstride' }, { id: 'trunk_lean' }, { id: 'symmetry' },
    { id: 'arm_swing' }, { id: 'knee_valgus' },
  ];
  assert.deepEqual(
    filterChecklistItemsForView(items, 'running_gait', 'side').map(item => item.id),
    ['overstride', 'trunk_lean'],
  );
  assert.deepEqual(
    filterChecklistItemsForView(items, 'running_gait', 'front').map(item => item.id),
    ['trunk_lean', 'symmetry', 'arm_swing', 'knee_valgus'],
  );
});

test('body-region configuration suppresses unrelated measurements', () => {
  const lower = movementOverlayConfiguration('deadlift', 'side', 'right');
  assert.equal(lower.prohibitedMeasurements.includes('Elbow angle'), true);
  assert.equal(lower.prohibitedMeasurements.includes('Wrist angle'), true);

  const upper = movementOverlayConfiguration('general', 'side', 'right', 'upper_body');
  assert.equal(upper.prohibitedMeasurements.includes('Knee flexion'), true);
  assert.equal(upper.prohibitedMeasurements.includes('Hip flexion'), true);
  assert.deepEqual(upper.allowedMeasurements, []);
});

test('saved lateral analyses filter far-side charts, key frames, and symmetry', () => {
  const analysis: MovementAnalysis = {
    id: 'legacy-side', createdAt: 1, updatedAt: 1,
    type: 'squat', mediaUri: 'frame.jpg', mediaType: 'video', cameraView: 'side',
    closestSide: 'left', checklistFindings: [], confidence: 'moderate', recommendations: [], limitations: [], status: 'complete',
    rawEstimatedAngles: angles,
    angleSeries: angles.map(angle => ({ name: angle.name, joint: angle.joint, side: angle.side, points: [] })),
    keyFrames: [{ id: 'right', label: 'Peak flexion — right', timeMs: 100, angles }],
    symmetryEstimates: [{ metric: 'Knee flexion', leftValue: 80, rightValue: 82, ratio: 0.98, withinNoise: true, note: 'Within single-camera noise.' }],
  };
  const filtered = applyAnalysisViewFilters(analysis);
  assert.equal(filtered.estimatedAngles?.some(angle => angle.side === 'right'), false);
  assert.equal(filtered.angleSeries?.some(series => series.side === 'right'), false);
  assert.deepEqual(filtered.keyFrames, []);
  assert.equal(filtered.symmetryEstimates, undefined);
});

test('legacy lateral hip angle is suppressed without destroying raw records', () => {
  const legacyHip: EstimatedAngle = {
    name: 'Hip angle', joint: 'hip', side: 'left', degrees: 42, confidence: 0.8,
  };
  const filtered = applyAnalysisViewFilters({
    id: 'legacy-hip', createdAt: 1, updatedAt: 1,
    type: 'squat', mediaUri: 'frame.jpg', mediaType: 'photo', cameraView: 'side',
    closestSide: 'left', rawEstimatedAngles: [legacyHip],
    checklistFindings: [], confidence: 'moderate', recommendations: [], limitations: [], status: 'complete',
  });
  assert.equal(filtered.estimatedAngles?.some(angle => angle.name === 'Hip angle'), false);
  assert.equal(filtered.rawEstimatedAngles?.[0]?.name, 'Hip angle');
  assert.deepEqual(filtered.legacyMeasurementsSuppressed, ['Hip angle']);
  assert.equal(filtered.measurementConventionVersion, 2);
});

test('mirrored saved media swaps anatomical left and right explicitly', () => {
  const filtered = applyAnalysisViewFilters({
    id: 'mirrored', createdAt: 1, updatedAt: 1,
    type: 'squat', mediaUri: 'frame.jpg', mediaType: 'photo', cameraView: 'side',
    closestSide: 'right', captureMetadata: { cameraFacing: 'front', isMirrored: true, orientationConfirmed: true },
    rawLandmarks: [{ name: 'left_knee', x: 0.2, y: 0.5, confidence: 0.9 }],
    rawEstimatedAngles: [{ name: 'Knee flexion', joint: 'knee', side: 'left', degrees: 80, confidence: 0.9 }],
    angleSeries: [{ name: 'Knee flexion', joint: 'knee', side: 'left', points: [] }],
    keyFrames: [{ id: 'left-peak', label: 'Peak flexion — left', timeMs: 100, angles: [{ name: 'Knee flexion', joint: 'knee', side: 'left', degrees: 80, confidence: 0.9 }] }],
    checklistFindings: [], confidence: 'moderate', recommendations: [], limitations: [], status: 'complete',
  });
  assert.equal(filtered.displayLandmarks?.[0]?.name, 'right_knee');
  assert.equal(filtered.estimatedAngles?.[0]?.side, 'right');
  assert.equal(filtered.angleSeries?.[0]?.side, 'right');
  assert.equal(filtered.keyFrames?.[0]?.label, 'Peak flexion — right');

  const reopened = applyAnalysisViewFilters(filtered);
  assert.equal(reopened.angleSeries?.[0]?.side, 'right');
  assert.equal(reopened.keyFrames?.[0]?.label, 'Peak flexion — right');
});

test('version-two lateral records preserve raw material and switch every display surface', () => {
  const rawAngleSeries: AngleSeries[] = angles.map(angle => ({
    name: angle.name,
    joint: angle.joint,
    side: angle.side,
    points: [{ timeMs: 0, degrees: angle.degrees, confidence: angle.confidence }],
  }));
  const base: MovementAnalysis = {
    id: 'v2-side', createdAt: 1, updatedAt: 1,
    type: 'squat', mediaUri: 'frame.jpg', mediaType: 'video', cameraView: 'side',
    closestSide: 'left', measurementConventionVersion: 2,
    rawEstimatedAngles: angles, rawAngleSeries,
    rawKeyFrames: [
      { id: 'left', label: 'Deepest position — left', timeMs: 100, angles },
      { id: 'right', label: 'Deepest position — right', timeMs: 100, angles },
    ],
    checklistFindings: [], confidence: 'moderate', recommendations: [], limitations: [], status: 'complete',
  };
  const left = applyAnalysisViewFilters(base);
  assert.deepEqual(left.angleSeries?.filter(series => series.side !== 'center').map(series => series.side), ['left', 'left']);
  assert.deepEqual(left.keyFrames?.map(frame => frame.id), ['left']);
  assert.equal(left.estimatedAngles?.filter(angle => angle.side !== 'center').every(angle => angle.side === 'left'), true);
  assert.equal(left.rawAngleSeries?.some(series => series.side === 'right'), true);

  const right = applyAnalysisViewFilters({ ...left, closestSide: 'right', viewFiltersMaterialized: false });
  assert.deepEqual(right.angleSeries?.filter(series => series.side !== 'center').map(series => series.side), ['right', 'right']);
  assert.deepEqual(right.keyFrames?.map(frame => frame.id), ['right']);
  assert.equal(right.estimatedAngles?.filter(angle => angle.side !== 'center').every(angle => angle.side === 'right'), true);
  assert.equal(right.measurementConventionVersion, 2);
});
