import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActivityShareMessage,
  buildActivitySummary,
} from '../../src/utils/activitySummary';
import {
  buildAchievementHubModel,
  calculateMonthlyDistanceMilestones,
  calculatePersonalRecords,
} from '../../src/utils/achievements';
import {
  buildSegmentVoiceCues,
  estimateStructuredWorkout,
  reorderWorkoutGroup,
  workoutFromRunWalkTemplate,
  type WorkoutSegmentGroup,
} from '../../src/utils/structuredWorkout';
import type { Activity } from '../../src/types/activity';

function activity(overrides: Partial<Activity> & Pick<Activity, 'id' | 'activityType' | 'startTime'>): Activity {
  return {
    id: overrides.id,
    activityType: overrides.activityType,
    source: 'manual',
    status: 'completed',
    scheduled: false,
    startTime: overrides.startTime,
    endTime: overrides.startTime + 3_600_000,
    indoor: false,
    metrics: { durationSeconds: 3600 },
    trainingLoad: {
      method: 'session_rpe',
      wholeBody: 20,
      running: 20,
      walking: 0,
      strength: 0,
      crossTraining: 0,
      impactBearing: 20,
      nonImpactAerobic: 0,
      confidence: 'moderate',
    },
    createdAt: overrides.startTime,
    updatedAt: overrides.startTime,
    ...overrides,
    metrics: { durationSeconds: 3600, ...(overrides.metrics ?? {}) },
    trainingLoad: overrides.trainingLoad ?? {
      method: 'session_rpe',
      wholeBody: 20,
      running: overrides.activityType === 'running' ? 20 : 0,
      walking: overrides.activityType === 'walking' ? 20 : 0,
      strength: overrides.activityType === 'strength' ? 20 : 0,
      crossTraining: overrides.activityType === 'cycling' ? 20 : 0,
      impactBearing: overrides.activityType === 'cycling' ? 0 : 20,
      nonImpactAerobic: overrides.activityType === 'cycling' ? 20 : 0,
      confidence: 'moderate',
    },
  };
}

test('Build 57 Activity Detail summary surfaces stored metrics and obeys units', () => {
  const run = activity({
    id: 'run-rich',
    activityType: 'running',
    rpe: 4,
    startTime: Date.UTC(2026, 7, 1, 12),
    metrics: {
      durationSeconds: 2700,
      distanceMeters: 8046.72,
      elevationGainMeters: 100,
      averageHeartRateBpm: 141,
      maximumHeartRateBpm: 171,
      cadenceRpm: 166,
      pace: { averageSecondsPerKilometer: 330, splitsSecondsPerKilometer: [335, 325, 330] },
      heartRateZoneSeconds: { 2: 1200, 3: 900 },
      distanceSource: 'gps',
    },
  });
  const imperial = buildActivitySummary(run, 'imperial', { dataRich: true });
  assert.equal(imperial.primary.find(item => item.label === 'Distance')?.value, '5.0 mi');
  assert.equal(imperial.primary.find(item => item.label === 'Elevation gain')?.value, '328 ft');
  assert.ok(imperial.sections.some(section => section.metrics.some(item => item.label === 'Cadence' && item.value === '166 rpm')));

  const metric = buildActivitySummary(run, 'metric', { dataRich: true });
  assert.equal(metric.primary.find(item => item.label === 'Distance')?.value, '8.0 km');
  assert.equal(metric.primary.find(item => item.label === 'Elevation gain')?.value, '100 m');
});

test('Build 57 activity sharing excludes symptoms and private notes', () => {
  const run = activity({
    id: 'private-run',
    activityType: 'running',
    startTime: Date.UTC(2026, 7, 1, 12),
    notes: 'Start from home',
    symptoms: ['ankle sore'],
    metrics: {
      durationSeconds: 1800,
      distanceMeters: 3218.688,
      pace: { averageSecondsPerKilometer: 360 },
    },
  });
  const message = buildActivityShareMessage(run, 'imperial');
  assert.match(message, /StrideOS/);
  assert.doesNotMatch(message, /home|ankle/i);
});

test('Build 57 achievement model recalculates PRs after edit/delete style input changes', () => {
  const first = activity({
    id: 'run-1',
    activityType: 'running',
    startTime: Date.UTC(2026, 7, 1),
    metrics: { durationSeconds: 1800, distanceMeters: 5000 },
  });
  const second = activity({
    id: 'run-2',
    activityType: 'running',
    startTime: Date.UTC(2026, 7, 2),
    metrics: { durationSeconds: 2400, distanceMeters: 7000 },
  });
  assert.equal(calculatePersonalRecords([first, second]).find(item => item.id === 'pr_farthest_run')?.activityId, 'run-2');
  assert.equal(calculatePersonalRecords([first]).find(item => item.id === 'pr_farthest_run')?.activityId, 'run-1');
  assert.equal(calculatePersonalRecords([{ ...first, metrics: { ...first.metrics, distanceMeters: 9000 } }]).find(item => item.id === 'pr_farthest_run')?.value, 9000);
});

test('Build 57 monthly milestones use canonical metric thresholds regardless of display units', () => {
  const items = [
    activity({ id: 'run-a', activityType: 'running', startTime: new Date(2026, 7, 1, 8).getTime(), metrics: { distanceMeters: 15_000, durationSeconds: 5400 } }),
    activity({ id: 'run-b', activityType: 'running', startTime: new Date(2026, 7, 8, 8).getTime(), metrics: { distanceMeters: 36_000, durationSeconds: 12_000 } }),
  ];
  const milestones = calculateMonthlyDistanceMilestones(items);
  assert.ok(milestones.some(item => item.id === 'monthly_run_50k'));
  assert.ok(!milestones.some(item => item.id === 'monthly_run_75k'));
});

test('Build 57 hub exposes challenges and Stride Levels from canonical activity history', () => {
  const now = Date.UTC(2026, 7, 9, 12);
  const items = Array.from({ length: 4 }, (_, week) =>
    [0, 1, 2].map(day => activity({
      id: `run-${week}-${day}`,
      activityType: 'running',
      startTime: now - (week * 7 + day) * 24 * 60 * 60 * 1000,
      metrics: { durationSeconds: 1800, distanceMeters: 5000 },
    })),
  ).flat();
  const hub = buildAchievementHubModel(items, [], now);
  assert.ok(hub.consistencyAwards.some(item => item.id === 'four_week_consistency'));
  assert.ok(hub.challengeProgress.some(item => item.definition.id === 'challenge_four_week_consistency' && item.complete));
  assert.ok(hub.strideLevels.some(item => item.id === 'stride_level_pacesetter' && item.complete));
});

test('Build 57 structured workout estimates repeats, reorder, and boundary voice cues', () => {
  const workout = workoutFromRunWalkTemplate({
    id: 'rw',
    name: 'Run Walk',
    warmupSeconds: 300,
    runSeconds: 75,
    walkSeconds: 45,
    repeatCount: 8,
    cooldownSeconds: 300,
  });
  const estimate = estimateStructuredWorkout(workout, { fallbackRunPaceSecPerMile: 600, fallbackWalkPaceSecPerMile: 1200 });
  assert.equal(estimate.totalSeconds, 1560);
  assert.ok(estimate.totalMeters > 0);

  const group: WorkoutSegmentGroup = {
    id: 'g',
    repeatCount: 1,
    segments: [
      { id: 'a', kind: 'run', target: { type: 'time', seconds: 60 } },
      { id: 'b', kind: 'walk', target: { type: 'time', seconds: 30 } },
    ],
  };
  assert.deepEqual(reorderWorkoutGroup(group, 0, 1).segments.map(item => item.id), ['b', 'a']);

  const cues = buildSegmentVoiceCues(workout, { countdowns: true });
  assert.ok(cues.some(item => item.text.includes('Workout complete')));
  assert.ok(cues.some(item => item.category === 'countdown' && item.text === '10 seconds.'));
});
