import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assessReadiness } from '../../src/utils/readinessEngine';
import type { MovementAnalysis } from '../../src/types/movement';

const analysis: MovementAnalysis = {
  id: 'single-leg',
  createdAt: 1,
  updatedAt: 1,
  type: 'single_leg_control',
  mediaUri: 'clip.mov',
  mediaType: 'video',
  cameraView: 'front',
  checklistFindings: [],
  confidence: 'moderate',
  recommendations: [],
  limitations: [],
  status: 'complete',
  sequenceConfidence: 'moderate',
  angleSeries: [{
    name: 'Frontal-plane knee position',
    joint: 'knee',
    side: 'left',
    points: [
      { timeMs: 0, degrees: 0, confidence: 0.9 },
      { timeMs: 100, degrees: 2, confidence: 0.9 },
      { timeMs: 200, degrees: 3, confidence: 0.9 },
    ],
  }],
};

test('an unclear athlete review overrides the automatic single-leg category', () => {
  const result = assessReadiness('running', [{
    testId: 'single_leg_squat',
    method: 'video',
    analysisId: analysis.id,
    manualValues: { reviewStatus: 'unclear' },
  }], [analysis]);
  const domain = result.domainResults.find(item => item.domain === 'single_leg_control');
  assert.equal(domain?.category, 'manual_review');
});

test('symptom details are stored verbatim and imply pain-reported messaging', () => {
  const result = assessReadiness('walking', [], [], false, {
    intensity: 4,
    location: 'left knee',
    notes: 'Only near the bottom position',
  });
  assert.equal(result.painReported, true);
  assert.deepEqual(result.symptom, {
    intensity: 4,
    location: 'left knee',
    notes: 'Only near the bottom position',
  });
});
