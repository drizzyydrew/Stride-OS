import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildActivityShareMessage,
  buildActivitySummary,
} from '../../src/utils/activitySummary';
import {
  buildAchievementHubModel,
  calculateCumulativeElevationAchievements,
  calculateMonthlyDistanceMilestones,
  calculatePersonalRecords,
  CUMULATIVE_ELEVATION_ACHIEVEMENTS,
} from '../../src/utils/achievements';
import {
  buildSegmentVoiceCues,
  estimateStructuredWorkout,
  reorderWorkoutGroup,
  workoutFromRunWalkTemplate,
  type WorkoutSegmentGroup,
} from '../../src/utils/structuredWorkout';
import type { Activity } from '../../src/types/activity';

const read = (path: string) => readFileSync(path, 'utf8');

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

test('Cumulative elevation achievements unlock only at the exact landmark threshold', () => {
  const hood = CUMULATIVE_ELEVATION_ACHIEVEMENTS.find(item => item.id === 'elevation_mount_hood');
  assert.ok(hood);
  const almost = activity({
    id: 'almost-hood',
    activityType: 'running',
    startTime: Date.UTC(2026, 7, 1),
    metrics: { durationSeconds: 1800, elevationGainMeters: hood.thresholdMeters - 0.01 },
  });
  assert.equal(calculateCumulativeElevationAchievements([almost]).find(item => item.id === 'elevation_mount_hood')?.complete, false);

  const exact = activity({
    id: 'exact-hood',
    activityType: 'running',
    startTime: Date.UTC(2026, 7, 2),
    metrics: { durationSeconds: 1800, elevationGainMeters: hood.thresholdMeters },
  });
  const unlocked = calculateCumulativeElevationAchievements([exact]).find(item => item.id === 'elevation_mount_hood');
  assert.equal(unlocked?.complete, true);
  assert.equal(unlocked?.unlockedAt, exact.startTime);
});

test('Cumulative elevation achievements cross multiple mountains from one imported workout without duplicating HealthKit UUIDs', () => {
  const everest = CUMULATIVE_ELEVATION_ACHIEVEMENTS.find(item => item.id === 'elevation_mount_everest');
  assert.ok(everest);
  const imported = activity({
    id: 'healthkit-big-climb',
    activityType: 'hiking',
    source: 'healthkit',
    startTime: Date.UTC(2026, 7, 3),
    metrics: { durationSeconds: 12_000, elevationGainMeters: everest.thresholdMeters + 1, metricSources: { elevation: 'healthkit' } },
    healthKit: {
      workoutUuid: 'hk-climb-1',
      sourceBundleIdentifier: 'com.apple.health',
      originalStartTime: Date.UTC(2026, 7, 3),
      originalEndTime: Date.UTC(2026, 7, 3, 3),
      localCalendarDate: '2026-08-03',
      importedAt: Date.UTC(2026, 7, 3, 4),
      routeStatus: 'available',
      importedByStrideOS: true,
    },
  });
  const awards = calculateCumulativeElevationAchievements([imported]);
  assert.equal(awards.find(item => item.id === 'elevation_denali')?.complete, true);
  assert.equal(awards.find(item => item.id === 'elevation_mount_everest')?.complete, true);
  assert.equal(awards.find(item => item.id === 'elevation_mauna_kea')?.complete, false);

  const duplicate = { ...imported, id: 'healthkit-big-climb-duplicate' };
  const deduped = calculateCumulativeElevationAchievements([imported, duplicate]);
  assert.equal(deduped.find(item => item.id === 'elevation_mauna_kea')?.complete, false);
});

test('Cumulative elevation achievements recalculate after edit/delete and preserve backdated crossing dates', () => {
  const hood = CUMULATIVE_ELEVATION_ACHIEVEMENTS.find(item => item.id === 'elevation_mount_hood');
  assert.ok(hood);
  const old = activity({
    id: 'old-climb',
    activityType: 'running',
    startTime: Date.UTC(2026, 6, 1),
    metrics: { durationSeconds: 1800, elevationGainMeters: 1000 },
  });
  const crossing = activity({
    id: 'crossing-climb',
    activityType: 'cycling',
    startTime: Date.UTC(2026, 6, 10),
    metrics: { durationSeconds: 3600, elevationGainMeters: hood.thresholdMeters },
  });
  const complete = calculateCumulativeElevationAchievements([old, crossing]).find(item => item.id === 'elevation_mount_hood');
  assert.equal(complete?.complete, true);
  assert.equal(complete?.unlockedAt, crossing.startTime);

  const deleted = calculateCumulativeElevationAchievements([old]).find(item => item.id === 'elevation_mount_hood');
  assert.equal(deleted?.complete, false);

  const edited = calculateCumulativeElevationAchievements([{ ...old, metrics: { ...old.metrics, elevationGainMeters: hood.thresholdMeters + 1 } }])
    .find(item => item.id === 'elevation_mount_hood');
  assert.equal(edited?.complete, true);
  assert.equal(edited?.unlockedAt, old.startTime);
});

test('Cumulative elevation progress, display metadata, and unsupported elevation sources are guarded', () => {
  const hood = CUMULATIVE_ELEVATION_ACHIEVEMENTS.find(item => item.id === 'elevation_mount_hood');
  assert.ok(hood);
  const estimated = activity({
    id: 'estimated-only',
    activityType: 'running',
    startTime: Date.UTC(2026, 7, 4),
    metrics: { elevationGainMeters: hood.thresholdMeters + 1, metricSources: { elevation: 'prescribed_estimate' } },
  });
  assert.equal(calculateCumulativeElevationAchievements([estimated]).find(item => item.id === 'elevation_mount_hood')?.complete, false);

  const partial = activity({
    id: 'partial-climb',
    activityType: 'running',
    startTime: Date.UTC(2026, 7, 5),
    metrics: { elevationGainMeters: 500 },
  });
  const progress = calculateCumulativeElevationAchievements([partial]).find(item => item.id === 'elevation_mount_hood');
  assert.ok(progress);
  assert.equal(progress.imperialDisplay, '11,240 ft');
  assert.equal(progress.metricDisplay, '3,426 m');
  assert.ok(progress.remainingMeters > 0);
  assert.ok(progress.progressRatio > 0 && progress.progressRatio < 1);
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

test('Achievement and activity sharing use StrideOS PNG card components with multiple visual options', () => {
  const achievementBadge = read('src/components/achievements/AchievementBadge.tsx');
  const achievementShare = read('src/components/achievements/AchievementShareCard.tsx');
  const activityShare = read('src/components/activity/ActivityShareCard.tsx');
  const achievementHub = read('app/(tabs)/more/achievements.tsx');
  const activityDetail = read('app/(tabs)/activity/[activityId].tsx');

  assert.match(achievementBadge, /five|chevron|BadgeMotif|STRIDE_LEVEL_DEFINITIONS|StrideOS|>>>>|Polyline/s);
  assert.match(achievementShare, /badge_square/);
  assert.match(achievementShare, /story_poster/);
  assert.match(achievementShare, /photo_overlay/);
  assert.match(activityShare, /performance_dark/);
  assert.match(activityShare, /route_story/);
  assert.match(activityShare, /photo_overlay/);
  assert.match(achievementHub, /shareReportCard/);
  assert.match(activityDetail, /shareReportCard/);
  assert.match(activityDetail, /Create Share PNG/);
  assert.match(achievementShare, /cumulative_elevation/);
  assert.match(achievementShare, /ImageBackground/);
  assert.doesNotMatch(achievementShare, /routeCoordinates|symptoms|readiness|notes/);
});

test('Health Sync UI is removed while Apple Health connection can remain for workout heart-rate plumbing', () => {
  const more = read('app/(tabs)/more/index.tsx');
  const settings = read('app/(tabs)/settings/index.tsx');
  const tabs = read('app/(tabs)/_layout.tsx');

  assert.doesNotMatch(more, /Health Sync/);
  assert.doesNotMatch(settings, /Health Workout Sync|Open Sync Review|health-sync/);
  assert.doesNotMatch(tabs, /more\/health-sync/);
  assert.match(settings, /Apple Health/);
});
