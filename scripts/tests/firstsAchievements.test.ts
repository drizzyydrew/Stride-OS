import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import {
  FIRST_ACHIEVEMENT_DEFINITIONS,
} from '../../src/achievements/firsts/firstsDefinitions';
import { renderFirstAchievementBadgeSvg } from '../../src/achievements/firsts/firstsArtwork';
import { FIRSTS_COLORS } from '../../src/achievements/firsts/firstsTokens';
import {
  firstAchievementAccessibilityLabel,
  firstAchievementBadgeShieldLabel,
} from '../../src/achievements/firsts/firstsUtils';
import type { Activity } from '../../src/types/activity';
import {
  ACHIEVEMENT_SYSTEM_REGISTRY,
  evaluateAchievementSystem,
  formatAchievementSupportValue,
} from '../../src/utils/achievementSystem';

const M_PER_MI = 1609.344;
const M_PER_KM = 1000;
const baseTime = new Date('2026-08-03T12:00:00').getTime();

function activity(partial: Partial<Activity> & Pick<Activity, 'id' | 'activityType' | 'startTime'>): Activity {
  return {
    source: 'tracked',
    status: 'completed',
    scheduled: false,
    indoor: false,
    metrics: { durationSeconds: 1800 },
    trainingLoad: {
      method: 'estimated',
      wholeBody: 20,
      running: partial.activityType === 'running' ? 20 : 0,
      walking: partial.activityType === 'walking' ? 20 : 0,
      strength: partial.activityType === 'strength' ? 20 : 0,
      crossTraining: partial.activityType === 'cycling' ? 20 : 0,
      impactBearing: ['running', 'walking'].includes(partial.activityType) ? 20 : 0,
      nonImpactAerobic: ['cycling', 'indoor_cycling'].includes(partial.activityType) ? 20 : 0,
      confidence: 'moderate',
    },
    createdAt: partial.startTime,
    updatedAt: partial.startTime,
    ...partial,
    metrics: { durationSeconds: 1800, ...(partial.metrics ?? {}) },
  };
}

function run(id: string, miles: number, extra: Partial<Activity> = {}): Activity {
  return activity({
    id,
    activityType: 'running',
    startTime: baseTime,
    metrics: {
      durationSeconds: Math.round(miles * 600),
      distanceMeters: miles * M_PER_MI,
      ...(extra.metrics ?? {}),
    },
    ...extra,
  });
}

function readPng(assetPath: string): PNG {
  return PNG.sync.read(readFileSync(path.resolve(process.cwd(), assetPath)));
}

function alphaAt(png: PNG, x: number, y: number): number {
  return png.data[(png.width * y + x) * 4 + 3];
}

test('Firsts registry contains exactly the approved 15 achievements with no stale duplicates', () => {
  assert.deepEqual(FIRST_ACHIEVEMENT_DEFINITIONS.map(item => item.title), [
    'First Activity',
    'First Run',
    'First Walk',
    'First Run/Walk',
    'First Ride',
    'First Mobility Workout',
    'First 5K',
    'First 10K',
    'First Half Marathon',
    'First Marathon',
    'First Route Completed',
    'First Structured Workout',
    'First Adapted Workout',
    'First Strength Workout',
    'First Movement Lab Analysis',
  ]);
  assert.equal(new Set(FIRST_ACHIEVEMENT_DEFINITIONS.map(item => item.id)).size, 15);
  const firsts = ACHIEVEMENT_SYSTEM_REGISTRY.filter(item => item.family === 'firsts');
  assert.equal(firsts.length, 15);
  assert.equal(firsts.some(item => item.id === 'first_strength_session'), false);
  assert.equal(firsts.some(item => item.id === 'first_treadmill_run'), false);
  assert.equal(firsts.some(item => item.id === 'first_adapted_week'), false);
  assert.equal(firsts.some(item => item.id === 'first_movement_lab_assessment'), false);
  assert.equal(firsts.some(item => /yoga|pilates/i.test(`${item.id} ${item.title}`)), false);
});

test('Firsts generated assets exist for all four canonical states', () => {
  for (const definition of FIRST_ACHIEVEMENT_DEFINITIONS) {
    for (const assetPath of [
      definition.artworkPath,
      definition.lockedArtworkPath,
      definition.unlockedPngPath,
      definition.lockedPngPath,
      definition.shareTransparentSvgPath,
      definition.shareTransparentPngPath,
      definition.shareOpaqueSvgPath,
      definition.shareOpaquePngPath,
    ]) {
      assert.equal(existsSync(path.resolve(process.cwd(), assetPath)), true, `${definition.id} missing ${assetPath}`);
    }
  }
});

test('Firsts unlock rules evaluate each approved one-time achievement', () => {
  const activities = [
    activity({ id: 'walk', activityType: 'walking', startTime: baseTime }),
    run('run', 1),
    run('runwalk', 1, { subtype: 'run_walk', metrics: { distanceMeters: M_PER_MI, runWalkIntervals: [{ kind: 'run', durationSeconds: 60 }, { kind: 'walk', durationSeconds: 60 }] } }),
    activity({ id: 'ride', activityType: 'cycling', startTime: baseTime, metrics: { distanceMeters: 10 * M_PER_MI } }),
    activity({ id: 'mobility', activityType: 'mobility', startTime: baseTime }),
    run('five-k', 3.2),
    run('ten-k', 6.3),
    run('half', 13.2),
    run('full', 26.3),
    run('route', 2, { metrics: { distanceMeters: 2 * M_PER_MI, routeId: 'route-1' } }),
    run('structured', 2, { scheduledSessionId: 'scheduled-1' }),
    run('adapted', 2, { completionClassification: 'modified' }),
    activity({ id: 'strength', activityType: 'strength', startTime: baseTime }),
  ];
  const evaluated = evaluateAchievementSystem({
    activities,
    units: 'imperial',
    assessmentResults: [{
      id: 'assessment-1',
      testKey: 'plank',
      date: '2026-08-03',
      testedAt: baseTime,
      value: 60,
      valueUnit: 'seconds',
      rating: 'expected',
      confidence: 'moderate',
      interpretation: 'Saved Movement Lab assessment.',
    }],
  });
  const earned = new Set(evaluated.filter(item => item.family === 'firsts' && item.state === 'earned').map(item => item.id));
  for (const definition of FIRST_ACHIEVEMENT_DEFINITIONS) {
    assert.equal(earned.has(definition.id), true, `${definition.id} did not unlock`);
  }
});

test('Firsts distance thresholds unlock at exact threshold and recalculate when activity data changes', () => {
  const below5k = evaluateAchievementSystem({ activities: [activity({ id: 'below', activityType: 'running', startTime: baseTime, metrics: { distanceMeters: 4999 } })], units: 'metric' });
  const exact5k = evaluateAchievementSystem({ activities: [activity({ id: 'exact', activityType: 'running', startTime: baseTime, metrics: { distanceMeters: 5000 } })], units: 'metric' });
  assert.equal(below5k.find(item => item.id === 'first_5k')?.state, 'locked');
  assert.equal(exact5k.find(item => item.id === 'first_5k')?.state, 'earned');
  assert.equal(evaluateAchievementSystem({ activities: [], units: 'metric' }).find(item => item.id === 'first_5k')?.state, 'locked');
  assert.equal(evaluateAchievementSystem({ activities: [], units: 'metric', awarded: [{ id: 'first_5k', awardedAt: baseTime }] }).find(item => item.id === 'first_5k')?.state, 'earned');

  assert.equal(evaluateAchievementSystem({ activities: [activity({ id: 'ten', activityType: 'running', startTime: baseTime, metrics: { distanceMeters: 10 * M_PER_KM } })], units: 'metric' }).find(item => item.id === 'first_10k')?.state, 'earned');
  assert.equal(evaluateAchievementSystem({ activities: [run('half', 13.1094)], units: 'imperial' }).find(item => item.id === 'first_half_marathon')?.state, 'earned');
  assert.equal(evaluateAchievementSystem({ activities: [run('full', 26.2188)], units: 'imperial' }).find(item => item.id === 'first_marathon')?.state, 'earned');
});

test('Firsts HealthKit duplicate import does not duplicate supporting activity identity', () => {
  const tracked = run('tracked', 3.2, { endTime: baseTime + 1800_000 });
  const imported = run('healthkit', 3.2, {
    source: 'healthkit',
    endTime: baseTime + 1800_000,
    healthKit: {
      workoutUuid: 'uuid-1',
      sourceBundleIdentifier: 'com.apple.health',
      originalStartTime: baseTime,
      originalEndTime: baseTime + 1800_000,
      localCalendarDate: '2026-08-03',
      importedAt: baseTime + 2000,
      routeStatus: 'not_available',
      importedByStrideOS: true,
    },
  });
  const firstActivity = evaluateAchievementSystem({ activities: [tracked, imported], units: 'imperial' }).find(item => item.id === 'first_activity')!;
  assert.deepEqual(firstActivity.supportingActivityIds, ['tracked']);
});

test('Firsts unit behavior keeps 5K and 10K fixed while race badges switch support values', () => {
  const first5k = ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === 'first_5k')!;
  const first10k = ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === 'first_10k')!;
  const half = ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === 'first_half_marathon')!;
  const full = ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === 'first_marathon')!;
  assert.equal(formatAchievementSupportValue(first5k, 'imperial'), '5K');
  assert.equal(formatAchievementSupportValue(first5k, 'metric'), '5K');
  assert.equal(formatAchievementSupportValue(first10k, 'imperial'), '10K');
  assert.equal(formatAchievementSupportValue(first10k, 'metric'), '10K');
  assert.equal(formatAchievementSupportValue(half, 'imperial'), '13.1 mi');
  assert.equal(formatAchievementSupportValue(half, 'metric'), '21.1 km');
  assert.equal(formatAchievementSupportValue(full, 'imperial'), '26.2 mi');
  assert.equal(formatAchievementSupportValue(full, 'metric'), '42.2 km');
  assert.equal(firstAchievementBadgeShieldLabel(FIRST_ACHIEVEMENT_DEFINITIONS.find(item => item.id === 'first_half_marathon')!, 'metric'), '21.1');
  assert.equal(firstAchievementBadgeShieldLabel(FIRST_ACHIEVEMENT_DEFINITIONS.find(item => item.id === 'first_marathon')!, 'imperial'), '26.2');
});

test('Firsts renderer states preserve one canonical geometry and export semantics', () => {
  const unlocked = renderFirstAchievementBadgeSvg('first_run', 'unlocked');
  const locked = renderFirstAchievementBadgeSvg('first_run', 'locked').toLowerCase();
  const transparent = renderFirstAchievementBadgeSvg('first_run', 'share-transparent');
  assert.equal(unlocked.includes('FIRST RUN'), true);
  assert.equal(unlocked.includes('STRIDEOS'), true);
  assert.equal(transparent.includes('fill="transparent" fill-opacity="0"'), true);
  assert.equal(renderFirstAchievementBadgeSvg('first_run', 'share-opaque'), unlocked);
  for (const hex of Object.values(FIRSTS_COLORS).map(value => value.toLowerCase())) {
    assert.equal(locked.includes(hex), false, `locked Firsts renderer contains warm hue ${hex}`);
  }

  const transparentPng = readPng('assets/achievements/firsts/firsts-first-run-transparent.png');
  assert.equal(alphaAt(transparentPng, 0, 0), 0);
  assert.equal(alphaAt(transparentPng, 512, 160), 0);
});

test('Firsts glyph contracts distinguish the approved concepts', () => {
  const firstActivity = renderFirstAchievementBadgeSvg('first_activity', 'unlocked');
  const firstRun = renderFirstAchievementBadgeSvg('first_run', 'unlocked');
  const firstWalk = renderFirstAchievementBadgeSvg('first_walk', 'unlocked');
  const runWalk = renderFirstAchievementBadgeSvg('first_run_walk', 'unlocked');
  const movementLab = renderFirstAchievementBadgeSvg('first_movement_lab_analysis', 'unlocked');
  assert.match(firstActivity, /Q36\.1 23\.5 42 34\.4/);
  assert.match(firstRun, /H31\.7/);
  assert.doesNotMatch(firstWalk, /H31\.7/);
  assert.match(runWalk, /stroke-dasharray="1\.1 2\.7"/);
  assert.match(renderFirstAchievementBadgeSvg('first_strength_workout', 'unlocked'), /M25\.3 40\.5 H74\.7/);
  assert.match(movementLab, /H36\.6/);
  assert.match(movementLab, /L50 31 L57\.1 32\.6/);
  assert.doesNotMatch(movementLab, /stroke-dasharray/);
});

test('Firsts accessibility labels include status and race units where relevant', () => {
  const runDefinition = FIRST_ACHIEVEMENT_DEFINITIONS.find(item => item.id === 'first_run')!;
  const marathon = FIRST_ACHIEVEMENT_DEFINITIONS.find(item => item.id === 'first_marathon')!;
  assert.equal(firstAchievementAccessibilityLabel(runDefinition, 'earned', 'imperial'), 'First Run achievement. Unlocked.');
  assert.equal(firstAchievementAccessibilityLabel(runDefinition, 'locked', 'imperial'), 'First Run achievement. Not yet achieved.');
  assert.equal(firstAchievementAccessibilityLabel(marathon, 'earned', 'imperial'), 'First Marathon achievement. Unlocked. 26.2 miles.');
  assert.equal(firstAchievementAccessibilityLabel(marathon, 'earned', 'metric'), 'First Marathon achievement. Unlocked. 42.2 kilometers.');
});
