import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCoachHandoff } from '../../src/utils/movementEngine';
import type { MovementAnalysis } from '../../src/types/movement';

test('structured Coach handoff stays compact enough for the focused prompt', () => {
  const analysis: MovementAnalysis = {
    id: 'test',
    createdAt: 1,
    updatedAt: 1,
    type: 'squat',
    mediaUri: 'analysis.mov',
    mediaType: 'video',
    cameraView: 'side',
    closestSide: 'left',
    checklistFindings: [],
    confidence: 'moderate',
    recommendations: Array.from({ length: 6 }, (_, index) => ({
      finding: `Finding ${index + 1}`,
      meaning: 'Estimated from one camera view and requires confirmation.',
      recommendation: 'Review the key frame before changing training.',
    })),
    limitations: ['Single-camera 2D estimate.'],
    status: 'complete',
    keyFrames: Array.from({ length: 8 }, (_, index) => ({ id: `kf${index}`, label: `Frame ${index}`, timeMs: index * 500 })),
    repSummaries: Array.from({ length: 5 }, (_, index) => ({
      index,
      startMs: index * 1000,
      bottomMs: index * 1000 + 400,
      endMs: index * 1000 + 800,
      durationMs: 800,
      peakFlexionDeg: 80 + index,
    })),
    sequenceConfidence: 'moderate',
  };
  const serialized = JSON.stringify(buildCoachHandoff(analysis));
  assert.ok(serialized.length < 8_000, `handoff was ${serialized.length} characters`);
});

test('side-view Coach handoff excludes far-limb metrics and lateral symmetry', () => {
  const analysis: MovementAnalysis = {
    id: 'side', createdAt: 1, updatedAt: 1,
    type: 'running_gait', mediaUri: 'run.mov', mediaType: 'video', cameraView: 'side',
    closestSide: 'left', closestSideSource: 'user',
    rawEstimatedAngles: [
      { name: 'Knee flexion', joint: 'knee', side: 'left', degrees: 80, confidence: 0.9 },
      { name: 'Knee flexion', joint: 'knee', side: 'right', degrees: 90, confidence: 0.9 },
      { name: 'Elbow angle', joint: 'elbow', side: 'left', degrees: 70, confidence: 0.9 },
    ],
    symmetryEstimates: [{ metric: 'Knee flexion', leftValue: 80, rightValue: 90, ratio: 0.89, withinNoise: false, note: 'Estimated difference.' }],
    checklistFindings: [], confidence: 'moderate', recommendations: [], limitations: [], status: 'complete',
  };
  const handoff = buildCoachHandoff(analysis);
  assert.deepEqual(handoff.detectedAngles.map(angle => angle.name), ['Knee flexion (left)']);
  assert.equal(handoff.symmetryNote, null);
  assert.equal(handoff.closestSide, 'left');
});
