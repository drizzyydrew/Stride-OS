import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  filterEstimatedAngles,
  filterLandmarksForDisplay,
  movementOverlayConfiguration,
  permittedMeasurements,
  requiresClosestSide,
} from '../../src/utils/measurementMatrix';
import {
  ANALYSIS_CHECKLISTS,
  ANALYSIS_KIND_INFO,
  buildCoachHandoff,
} from '../../src/utils/movementEngine';
import { analyzeSequence } from '../../src/utils/poseSequence';
import type {
  EstimatedAngle,
  MovementAnalysis,
  PoseLandmarkRecord,
} from '../../src/types/movement';
import type { PoseJoint, PoseSequenceResult } from 'stride-pose';

const allAngles: EstimatedAngle[] = [
  { name: 'Knee flexion', joint: 'knee', side: 'left', degrees: 105, confidence: 0.9, metricId: 'knee_flexion' },
  { name: 'Knee flexion', joint: 'knee', side: 'right', degrees: 103, confidence: 0.8, metricId: 'knee_flexion' },
  { name: 'Hip flexion', joint: 'hip', side: 'left', degrees: 72, confidence: 0.9, metricId: 'hip_sagittal_motion', motion: 'flexion' },
  { name: 'Trunk lean', joint: 'trunk', side: 'center', degrees: 42, confidence: 0.9, metricId: 'trunk_lean' },
  { name: 'Elbow angle', joint: 'elbow', side: 'left', degrees: 148, confidence: 0.9, metricId: 'elbow_angle' },
  { name: 'Shoulder angle', joint: 'shoulder', side: 'left', degrees: 76, confidence: 0.9, metricId: 'shoulder_angle' },
  { name: 'Elbow angle', joint: 'elbow', side: 'right', degrees: 150, confidence: 0.8, metricId: 'elbow_angle' },
];

function bikePose(kneeY: number, timeMs: number): PoseSequenceResult['frames'][number] {
  const joints: PoseJoint[] = [
    { name: 'nose', x: 0.65, y: 0.12, confidence: 0.9 },
    { name: 'neck', x: 0.58, y: 0.2, confidence: 0.9 },
    { name: 'left_shoulder', x: 0.53, y: 0.28, confidence: 0.95 },
    { name: 'left_elbow', x: 0.66, y: 0.36, confidence: 0.95 },
    { name: 'left_wrist', x: 0.76, y: 0.4, confidence: 0.95 },
    { name: 'left_hip', x: 0.42, y: 0.52, confidence: 0.95 },
    { name: 'left_knee', x: 0.52, y: kneeY, confidence: 0.95 },
    { name: 'left_ankle', x: 0.58, y: 0.88, confidence: 0.95 },
    { name: 'right_shoulder', x: 0.52, y: 0.29, confidence: 0.65 },
    { name: 'right_elbow', x: 0.65, y: 0.37, confidence: 0.65 },
    { name: 'right_wrist', x: 0.75, y: 0.41, confidence: 0.65 },
    { name: 'right_hip', x: 0.41, y: 0.53, confidence: 0.65 },
    { name: 'right_knee', x: 0.51, y: kneeY + 0.01, confidence: 0.65 },
    { name: 'right_ankle', x: 0.57, y: 0.89, confidence: 0.65 },
  ];
  return { timeMs, joints };
}

test('Bike Fit taxonomy is direct-lateral and immediately follows Running Gait in the Movement Lab list', () => {
  assert.equal(ANALYSIS_KIND_INFO.bike_fit.title, 'Bike Fit');
  assert.match(ANALYSIS_KIND_INFO.bike_fit.cameraAngle, /Direct lateral/i);
  assert.equal(requiresClosestSide('bike_fit', 'side'), true);
  assert.equal(permittedMeasurements('bike_fit', 'front').length, 0);
  const unsupportedFront = movementOverlayConfiguration('bike_fit', 'front');
  assert.deepEqual(unsupportedFront.visibleJoints, []);
  assert.equal(unsupportedFront.bilateralDisplayAllowed, false);
  assert.equal(unsupportedFront.symmetryAllowed, false);

  const indexSource = readFileSync('app/(tabs)/movement/index.tsx', 'utf8');
  assert.match(indexSource, /'running_gait',\s*'bike_fit',/);
});

test('Bike Fit lateral measurements use one closest rider chain and supported metrics only', () => {
  const filtered = filterEstimatedAngles(allAngles, 'bike_fit', 'side', 'left');
  assert.deepEqual(filtered.map(angle => `${angle.name}:${angle.side}`), [
    'Knee flexion:left',
    'Hip flexion:left',
    'Trunk lean:center',
    'Elbow angle:left',
    'Shoulder angle:left',
  ]);

  const landmarks: PoseLandmarkRecord[] = [
    'left_shoulder', 'left_elbow', 'left_wrist', 'left_hip', 'left_knee', 'left_ankle',
    'right_shoulder', 'right_elbow', 'right_wrist', 'right_hip', 'right_knee', 'right_ankle',
  ].map((name, index) => ({ name, x: index / 20, y: index / 20, confidence: 0.9 }));
  const display = filterLandmarksForDisplay(landmarks, 'bike_fit', 'side', 'left') ?? [];
  assert.equal(display.some(landmark => landmark.name.startsWith('right_')), false);
  assert.equal(display.some(landmark => landmark.name === 'left_elbow'), true);

  const config = movementOverlayConfiguration('bike_fit', 'side', 'left');
  assert.equal(config.primaryBodyRegion, 'whole_body');
  assert.equal(config.symmetryAllowed, false);
  assert.equal(config.bilateralDisplayAllowed, false);
  assert.equal(config.manualReviewRequired, true);
  assert.equal(config.prohibitedMeasurements.includes('Exact bicycle geometry'), true);
  assert.equal(config.prohibitedMeasurements.includes('Diagnosis or injury prediction'), true);
});

test('Bike Fit sequence estimates top and bottom pedal frames without symmetry or rep claims', () => {
  const sequence: PoseSequenceResult = {
    durationMs: 1000,
    analyzedMs: 1000,
    imageWidth: 1000,
    imageHeight: 1000,
    frames: [
      bikePose(0.62, 0),
      bikePose(0.55, 250),
      bikePose(0.74, 500),
      bikePose(0.82, 750),
      bikePose(0.62, 1000),
    ],
  };
  const analysis = analyzeSequence(sequence, 'bike_fit', 'side', 'left');
  assert.equal(analysis.keyFrames.some(frame => frame.label.includes('top pedal phase')), true);
  assert.equal(analysis.keyFrames.some(frame => frame.label.includes('bottom pedal phase')), true);
  assert.deepEqual(analysis.repSummaries, []);
  assert.deepEqual(analysis.symmetryEstimates, []);
  assert.equal(analysis.limitations.some(limit => limit.includes('does not replace an in-person bike fit')), true);
});

test('Bike Fit Coach handoff stays closest-side, conservative, and manual-review aware', () => {
  const analysis: MovementAnalysis = {
    id: 'bike-fit',
    createdAt: 1,
    updatedAt: 1,
    type: 'bike_fit',
    mediaUri: 'bike-fit.mov',
    mediaType: 'video',
    cameraView: 'side',
    closestSide: 'left',
    closestSideSource: 'user',
    rawEstimatedAngles: allAngles,
    estimatedAngles: allAngles,
    checklistFindings: ANALYSIS_CHECKLISTS.bike_fit.map(item => ({
      itemId: item.id,
      label: item.label,
      value: item.options[0],
    })),
    confidence: 'moderate',
    recommendations: [],
    limitations: ['Based on the available lateral view. This does not replace an in-person bike fit.'],
    sequenceLimitations: ['Manual review recommended.'],
    status: 'complete',
    measurementConventionVersion: 2,
    bikeFitPhases: { topDeadCenterMs: 250, bottomDeadCenterMs: 750, source: 'estimated' },
  };
  const handoff = buildCoachHandoff(analysis);
  assert.equal(handoff.analysisType, 'bike_fit');
  assert.equal(handoff.closestSide, 'left');
  assert.equal(handoff.detectedAngles.some(angle => angle.name.includes('(right)')), false);
  assert.equal(handoff.symmetryNote, null);
  assert.equal(handoff.manualReviewRequired, true);
  assert.deepEqual(handoff.bikeFitPhases, analysis.bikeFitPhases);
  assert.equal(handoff.limitations.some(limit => limit.includes('does not replace')), true);
});

test('Bike Fit registry uses only named production placeholders and makes unsupported claims absent', () => {
  const registry = readFileSync('src/constants/dionImages.ts', 'utf8');
  assert.match(registry, /dion_bike_fit_side_bottom_dead_center_v1/);
  assert.match(registry, /dion_bike_fit_side_top_dead_center_v1/);

  const combined = [
    ANALYSIS_KIND_INFO.bike_fit.cameraAngle,
    ...ANALYSIS_KIND_INFO.bike_fit.setup,
    ...ANALYSIS_KIND_INFO.bike_fit.analyzes,
  ].join(' ').toLowerCase();
  assert.equal(combined.includes('complete professional bike fit'), false);
  assert.equal(combined.includes('injury predictor'), false);
  assert.equal(combined.includes('diagnosis'), false);
});
