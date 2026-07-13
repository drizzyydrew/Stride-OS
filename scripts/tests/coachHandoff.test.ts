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
