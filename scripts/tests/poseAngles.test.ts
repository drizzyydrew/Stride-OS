import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computeAnatomicalHipMotion,
  computeEstimatedAngles,
} from '../../src/utils/poseAngles';
import { smoothAngleSeries } from '../../src/utils/poseSequence';
import type { AngleSeries } from '../../src/types/movement';
import type { PoseJoint } from 'stride-pose';

function lateralPose(
  facing: 'image_left' | 'image_right',
  knee: { x: number; y: number },
  confidence = 0.95,
): PoseJoint[] {
  const mirrored = facing === 'image_left';
  const x = (value: number) => mirrored ? 1 - value : value;
  return [
    { name: 'nose', x: x(0.55), y: 0.12, confidence },
    { name: 'neck', x: x(0.50), y: 0.20, confidence },
    { name: 'left_shoulder', x: x(0.40), y: 0.20, confidence },
    { name: 'left_hip', x: x(0.40), y: 0.50, confidence },
    { name: 'left_knee', x: x(knee.x), y: knee.y, confidence },
    { name: 'left_ankle', x: x(0.45), y: 0.90, confidence },
  ];
}

test('anatomical hip motion reports neutral standing near zero flexion', () => {
  const angle = computeAnatomicalHipMotion(
    lateralPose('image_right', { x: 0.40, y: 0.80 }),
    'left',
    { view: 'side' },
  );
  assert.equal(angle?.name, 'Hip flexion');
  assert.ok((angle?.degrees ?? 99) <= 1);
});

test('anatomical hip flexion increases from shallow to deep squat', () => {
  const shallow = computeAnatomicalHipMotion(
    lateralPose('image_right', { x: 0.65, y: 0.65 }),
    'left',
    { view: 'side' },
  );
  const deep = computeAnatomicalHipMotion(
    lateralPose('image_right', { x: 0.65, y: 0.45 }),
    'left',
    { view: 'side' },
  );
  assert.equal(shallow?.name, 'Hip flexion');
  assert.equal(deep?.name, 'Hip flexion');
  assert.ok((shallow?.degrees ?? 0) > 40);
  assert.ok((deep?.degrees ?? 0) > (shallow?.degrees ?? 999));
  assert.ok((deep?.degrees ?? 0) >= 90);
});

test('hip extension is named directly and never emitted as negative flexion', () => {
  const angle = computeAnatomicalHipMotion(
    lateralPose('image_right', { x: 0.35, y: 0.80 }),
    'left',
    { view: 'side' },
  );
  assert.equal(angle?.name, 'Hip extension');
  assert.equal(angle?.motion, 'extension');
  assert.ok((angle?.degrees ?? -1) > 0);
});

test('mirrored poses retain anatomical magnitude and naming', () => {
  const normal = computeAnatomicalHipMotion(
    lateralPose('image_right', { x: 0.65, y: 0.45 }),
    'left',
    { view: 'side' },
  );
  const mirrored = computeAnatomicalHipMotion(
    lateralPose('image_left', { x: 0.65, y: 0.45 }),
    'left',
    { view: 'side' },
  );
  assert.equal(mirrored?.name, normal?.name);
  assert.equal(mirrored?.degrees, normal?.degrees);
});

test('closest-side filtering, confidence, missing landmarks, and unsupported views are conservative', () => {
  const pose = lateralPose('image_right', { x: 0.65, y: 0.45 }, 0.42);
  const angles = computeEstimatedAngles(pose, 'squat', { view: 'side', closestSide: 'left' });
  const hip = angles.find(angle => angle.metricId === 'hip_sagittal_motion');
  assert.equal(hip?.side, 'left');
  assert.equal(hip?.confidence, 0.42);
  assert.equal(angles.some(angle => angle.side === 'right'), false);
  assert.equal(computeAnatomicalHipMotion(pose, 'left', { view: 'front' }), null);
  assert.equal(
    computeAnatomicalHipMotion(pose.filter(joint => joint.name !== 'left_knee'), 'left', { view: 'side' }),
    null,
  );
  assert.equal(
    computeAnatomicalHipMotion(lateralPose('image_right', { x: 0.65, y: 0.45 }, 0.2), 'left', { view: 'side' }),
    null,
  );
});

test('hip-series smoothing preserves the anatomical motion label', () => {
  const series: AngleSeries[] = [{
    name: 'Hip flexion',
    joint: 'hip',
    side: 'left',
    metricId: 'hip_sagittal_motion',
    motion: 'flexion',
    points: [
      { timeMs: 0, degrees: 80, confidence: 0.9 },
      { timeMs: 100, degrees: 120, confidence: 0.9 },
      { timeMs: 200, degrees: 82, confidence: 0.9 },
    ],
  }];
  const [smoothed] = smoothAngleSeries(series, 3);
  assert.equal(smoothed.name, 'Hip flexion');
  assert.equal(smoothed.motion, 'flexion');
  assert.ok((smoothed.points[1]?.degrees ?? 0) < 120);
});
