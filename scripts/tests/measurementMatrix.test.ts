import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  filterAngleSeries,
  filterEstimatedAngles,
  migrateAnalysisKind,
  permittedMeasurements,
} from '../../src/utils/measurementMatrix';
import type { AngleSeries, EstimatedAngle } from '../../src/types/movement';

const angles: EstimatedAngle[] = [
  { name: 'Knee flexion', joint: 'knee', side: 'left', degrees: 80, confidence: 0.9 },
  { name: 'Knee flexion', joint: 'knee', side: 'right', degrees: 82, confidence: 0.9 },
  { name: 'Hip angle', joint: 'hip', side: 'left', degrees: 70, confidence: 0.9 },
  { name: 'Hip angle', joint: 'hip', side: 'right', degrees: 72, confidence: 0.9 },
  { name: 'Trunk lean', joint: 'trunk', side: 'center', degrees: 12, confidence: 0.9 },
  { name: 'Elbow angle', joint: 'elbow', side: 'left', degrees: 90, confidence: 0.9 },
];

test('lateral lower-body measurements retain only the selected closest limb', () => {
  const filtered = filterEstimatedAngles(angles, 'squat', 'side', 'left');
  assert.deepEqual(filtered.map(a => `${a.name}:${a.side}`), [
    'Knee flexion:left',
    'Hip angle:left',
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
    ['Knee flexion:right', 'Hip angle:right', 'Trunk lean:center'],
  );
});

test('legacy combined movement kinds migrate by camera view', () => {
  assert.equal(migrateAnalysisKind({ type: 'lunge_single_leg', cameraView: 'front' as const }).type, 'single_leg_control');
  assert.equal(migrateAnalysisKind({ type: 'lunge_single_leg', cameraView: 'side' as const }).type, 'lunge');
});
