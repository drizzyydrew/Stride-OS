import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import type { Activity } from '../../src/types/activity';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';
import {
  ACHIEVEMENT_SYSTEM_REGISTRY,
  auditAchievementRegistry,
  achievementShareAllowed,
  evaluateAchievementSystem,
  formatAchievementSupportValue,
} from '../../src/utils/achievementSystem';
import { ACHIEVEMENT_ASSET_MANIFEST, getAchievementManifestEntry } from '../../src/utils/achievementSystemManifest';
import {
  LIFETIME_DISTANCE_CYCLING_DEFINITIONS,
} from '../../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingDefinitions';
import {
  formatLifetimeCyclingMilestoneNumber,
} from '../../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingUtils';
import { renderLifetimeDistanceCyclingBadgeSvg } from '../../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingArtwork';
import { LIFETIME_DISTANCE_CYCLING_TIER_COLORS } from '../../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingTokens';
import {
  LIFETIME_DISTANCE_RUNNING_DEFINITIONS,
} from '../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningDefinitions';
import {
  formatLifetimeRunningMilestoneNumber,
} from '../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningUtils';
import { renderLifetimeDistanceRunningBadgeSvg } from '../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningArtwork';
import { LIFETIME_DISTANCE_RUNNING_TIER_COLORS } from '../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningTokens';
import { RUN_LEVEL_DEFINITIONS } from '../../src/achievements/runLevels/runLevelDefinitions';
import {
  WEEKLY_DISTANCE_DEFINITIONS,
} from '../../src/achievements/weeklyDistance/weeklyDistanceDefinitions';
import { renderWeeklyDistanceBadgeSvg } from '../../src/achievements/weeklyDistance/weeklyDistanceArtwork';
import { WEEKLY_DISTANCE_TIER_COLORS } from '../../src/achievements/weeklyDistance/weeklyDistanceTokens';
import { buildAchievementHubModel, evaluateAchievementAwards } from '../../src/utils/achievements';
import { activityHasShareableRoute, normalizeRouteForOverlay } from '../../src/utils/routeOverlay';

const M_PER_MI = 1609.344;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
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
      crossTraining: 0,
      impactBearing: partial.activityType === 'running' ? 20 : 0,
      nonImpactAerobic: partial.activityType === 'cycling' ? 20 : 0,
      confidence: 'moderate',
    },
    createdAt: partial.startTime,
    updatedAt: partial.startTime,
    ...partial,
    metrics: { durationSeconds: 1800, ...(partial.metrics ?? {}) },
  };
}

function run(id: string, day: number, miles: number, extra: Partial<Activity> = {}): Activity {
  return activity({
    id,
    activityType: 'running',
    startTime: baseTime + day * DAY_MS,
    metrics: {
      durationSeconds: Math.round(miles * 600),
      distanceMeters: miles * M_PER_MI,
      pace: { averageSecondsPerKilometer: 360 },
      ...(extra.metrics ?? {}),
    },
    ...extra,
  });
}

function ride(id: string, day: number, miles: number, extra: Partial<Activity> = {}): Activity {
  return activity({
    id,
    activityType: 'cycling',
    startTime: baseTime + day * DAY_MS,
    metrics: {
      durationSeconds: Math.round(miles * 240),
      distanceMeters: miles * M_PER_MI,
      ...(extra.metrics ?? {}),
    },
    ...extra,
  });
}

function session(date: string, patch: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    scheduledSessionId: `session_${date}`,
    date,
    originalDate: date,
    activityType: 'run',
    subtype: 'easy',
    title: 'Easy Run',
    purpose: 'Aerobic consistency',
    priority: 'primary',
    durationMinutes: 30,
    target: '30 min',
    status: 'upcoming',
    ...patch,
  };
}

test('achievement registry has unique IDs and mapped artwork manifest entries', () => {
  const audit = auditAchievementRegistry();
  assert.equal(audit.total, ACHIEVEMENT_SYSTEM_REGISTRY.length);
  assert.equal(audit.duplicateIds.length, 0);
  assert.equal(audit.uniqueIds, ACHIEVEMENT_SYSTEM_REGISTRY.length);
  assert.equal(ACHIEVEMENT_ASSET_MANIFEST.length, ACHIEVEMENT_SYSTEM_REGISTRY.length);
  assert.ok(getAchievementManifestEntry('streak_365_day'));
  assert.ok(getAchievementManifestEntry('elevation_denali')?.sourceReferenceNotes?.includes('CUMULATIVE'));
});

test('achievement asset manifest points to files committed in the app bundle', () => {
  for (const item of ACHIEVEMENT_ASSET_MANIFEST) {
    const paths = [item.artworkPath, item.lockedArtworkPath, item.shareArtPath, item.shareOverlayPath].filter(Boolean);
    for (const assetPath of paths) {
      assert.equal(
        existsSync(path.resolve(process.cwd(), assetPath!)),
        true,
        `${item.achievementId} missing asset ${assetPath}`,
      );
    }
  }
});

test('canonical run levels contain exactly seven progressive badge definitions and share assets', () => {
  assert.deepEqual(RUN_LEVEL_DEFINITIONS.map(level => level.title), [
    'Foundation',
    'Rhythm',
    'Momentum',
    'Durability',
    'Engine',
    'Peak',
    'Summit',
  ]);
  assert.deepEqual(RUN_LEVEL_DEFINITIONS.map(level => level.thresholdMiles), [0, 50, 150, 400, 750, 1500, 3000]);
  assert.deepEqual(RUN_LEVEL_DEFINITIONS.map(level => level.ringCount), [5, 5, 6, 6, 7, 8, 9]);
  for (const level of RUN_LEVEL_DEFINITIONS) {
    assert.equal(existsSync(path.resolve(process.cwd(), level.artworkPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), level.lockedArtworkPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), level.shareTransparentPngPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), level.shareOpaquePngPath)), true);
  }
});

test('canonical Lifetime Distance - Running ladder has ten original diamond badge definitions', () => {
  assert.deepEqual(LIFETIME_DISTANCE_RUNNING_DEFINITIONS.map(item => item.thresholdMiles), [
    1,
    5,
    10,
    26.2,
    50,
    100,
    250,
    500,
    1000,
    10000,
  ]);
  assert.deepEqual(LIFETIME_DISTANCE_RUNNING_DEFINITIONS.map(item => item.id), [
    'lifetime_run_1_mi',
    'lifetime_run_5_mi',
    'lifetime_run_10_mi',
    'lifetime_run_26_2_mi',
    'lifetime_run_50_mi',
    'lifetime_run_100_mi',
    'lifetime_run_250_mi',
    'lifetime_run_500_mi',
    'lifetime_run_1000_mi',
    'lifetime_run_10000_mi',
  ]);
  for (const definition of LIFETIME_DISTANCE_RUNNING_DEFINITIONS) {
    assert.equal(existsSync(path.resolve(process.cwd(), definition.artworkPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.lockedArtworkPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.shareTransparentPngPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.shareOpaquePngPath)), true);
  }
});

test('Lifetime Distance - Running badge numbers convert for metric display without duplicating achievements', () => {
  assert.equal(formatLifetimeRunningMilestoneNumber(1, 'metric'), '1.6');
  assert.equal(formatLifetimeRunningMilestoneNumber(5, 'metric'), '8');
  assert.equal(formatLifetimeRunningMilestoneNumber(26.2, 'metric'), '42.2');
  assert.equal(formatLifetimeRunningMilestoneNumber(500, 'metric'), '805');
  assert.equal(formatLifetimeRunningMilestoneNumber(1000, 'metric'), '1,609');
  assert.equal(formatLifetimeRunningMilestoneNumber(10000, 'metric'), '16,093');

  const imperial = evaluateAchievementSystem({ activities: [run('r500', 0, 500)], units: 'imperial' });
  const metric = evaluateAchievementSystem({ activities: [run('r500', 0, 500)], units: 'metric' });
  const imperial500 = imperial.find(item => item.id === 'lifetime_run_500_mi')!;
  const metric500 = metric.find(item => item.id === 'lifetime_run_500_mi')!;
  assert.equal(imperial500.displayTarget, '500 mi');
  assert.equal(metric500.displayTarget, '805 km');
  assert.equal(imperial500.artworkKey, metric500.artworkKey);
  assert.equal(imperial500.id, metric500.id);
});

test('Lifetime Distance - Running state boundaries and progress remain stable', () => {
  const below = evaluateAchievementSystem({ activities: [run('below', 0, 499.99)], units: 'imperial' }).find(item => item.id === 'lifetime_run_500_mi')!;
  const exact = evaluateAchievementSystem({ activities: [run('exact', 0, 500)], units: 'imperial' }).find(item => item.id === 'lifetime_run_500_mi')!;
  const above = evaluateAchievementSystem({ activities: [run('above', 0, 525)], units: 'imperial' }).find(item => item.id === 'lifetime_run_500_mi')!;
  assert.equal(below.state, 'locked');
  assert.equal(below.displayRemaining, '0.1 mi remaining');
  assert.equal(exact.state, 'earned');
  assert.equal(exact.remaining, 0);
  assert.equal(above.state, 'earned');
  assert.equal(above.remaining, 0);
  assert.equal(above.progressPercentage, 1);
});

test('Lifetime Distance - Running awards persist through the legacy award emitter and hub model', () => {
  const activities = [run('legacy500', 0, 500)];
  const awards = evaluateAchievementAwards(activities, [], baseTime);
  const awardIds = awards.map(item => item.id);
  assert.equal(awardIds.includes('lifetime_run_1_mi'), true);
  assert.equal(awardIds.includes('lifetime_run_500_mi'), true);
  assert.equal(awardIds.includes('lifetime_run_1000_mi'), false);
  assert.deepEqual(
    awards.find(item => item.id === 'lifetime_run_500_mi')?.supportingActivityIds,
    ['legacy500'],
  );

  const hub = buildAchievementHubModel(activities, [], baseTime);
  assert.equal(hub.definitions.some(item => item.id === 'lifetime_run_500_mi' && item.category === 'lifetime_running'), true);
  assert.equal(hub.shareable.some(item => item.id === 'lifetime_run_500_mi'), true);
});

test('Lifetime Distance - Running exports preserve transparent alpha, locked hue removal, and opaque parity', () => {
  const definition = LIFETIME_DISTANCE_RUNNING_DEFINITIONS.find(item => item.thresholdMiles === 500)!;
  const transparent = PNG.sync.read(readFileSync(path.resolve(process.cwd(), definition.shareTransparentPngPath)));
  const cornerAlpha = transparent.data[3];
  const centerAlpha = transparent.data[(transparent.width * 512 + 512) * 4 + 3];
  assert.equal(cornerAlpha, 0);
  assert.equal(centerAlpha, 0);

  const lockedSvg = readFileSync(path.resolve(process.cwd(), definition.lockedArtworkPath), 'utf8').toLowerCase();
  const tierHexes = Object.values(LIFETIME_DISTANCE_RUNNING_TIER_COLORS).flatMap(colors => Object.values(colors).map(value => value.toLowerCase()));
  for (const hex of tierHexes) assert.equal(lockedSvg.includes(hex), false, `${definition.lockedArtworkPath} contains tier hue ${hex}`);

  assert.equal(
    renderLifetimeDistanceRunningBadgeSvg(500, 'share-opaque'),
    renderLifetimeDistanceRunningBadgeSvg(500, 'unlocked'),
  );
});

test('Lifetime Distance - Running accessibility labels include state and unit-aware remaining distance', () => {
  const below = evaluateAchievementSystem({ activities: [run('r417', 0, 417)], units: 'imperial' }).find(item => item.id === 'lifetime_run_500_mi')!;
  const metric = evaluateAchievementSystem({ activities: [run('r417m', 0, 417)], units: 'metric' }).find(item => item.id === 'lifetime_run_500_mi')!;
  const earned = evaluateAchievementSystem({ activities: [run('r500a11y', 0, 500)], units: 'imperial' }).find(item => item.id === 'lifetime_run_500_mi')!;
  assert.equal(below.accessibilityLabel, '500 mile lifetime running distance achievement. Locked. 83 miles remaining.');
  assert.equal(metric.accessibilityLabel, '805 kilometer lifetime running distance achievement. Locked. 134 kilometers remaining.');
  assert.equal(earned.accessibilityLabel, '500 mile lifetime running distance achievement. Unlocked.');
});

test('canonical Lifetime Distance - Cycling ladder has nine original diamond badge definitions', () => {
  assert.deepEqual(LIFETIME_DISTANCE_CYCLING_DEFINITIONS.map(item => item.thresholdMiles), [
    10,
    50,
    100,
    250,
    500,
    1000,
    2500,
    5000,
    10000,
  ]);
  assert.deepEqual(LIFETIME_DISTANCE_CYCLING_DEFINITIONS.map(item => item.id), [
    'lifetime_cycle_10_mi',
    'lifetime_cycle_50_mi',
    'lifetime_cycle_100_mi',
    'lifetime_cycle_250_mi',
    'lifetime_cycle_500_mi',
    'lifetime_cycle_1000_mi',
    'lifetime_cycle_2500_mi',
    'lifetime_cycle_5000_mi',
    'lifetime_cycle_10000_mi',
  ]);
  assert.equal(LIFETIME_DISTANCE_CYCLING_DEFINITIONS.length, 9);
  for (const definition of LIFETIME_DISTANCE_CYCLING_DEFINITIONS) {
    assert.equal(existsSync(path.resolve(process.cwd(), definition.artworkPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.lockedArtworkPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.shareTransparentPngPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.shareOpaquePngPath)), true);
  }
});

test('Lifetime Distance - Cycling badge numbers convert for metric display without duplicating achievements', () => {
  assert.equal(formatLifetimeCyclingMilestoneNumber(10, 'metric'), '16');
  assert.equal(formatLifetimeCyclingMilestoneNumber(50, 'metric'), '80');
  assert.equal(formatLifetimeCyclingMilestoneNumber(100, 'metric'), '161');
  assert.equal(formatLifetimeCyclingMilestoneNumber(500, 'metric'), '805');
  assert.equal(formatLifetimeCyclingMilestoneNumber(1000, 'metric'), '1,609');
  assert.equal(formatLifetimeCyclingMilestoneNumber(2500, 'metric'), '4,023');
  assert.equal(formatLifetimeCyclingMilestoneNumber(5000, 'metric'), '8,047');
  assert.equal(formatLifetimeCyclingMilestoneNumber(10000, 'metric'), '16,093');

  const imperial = evaluateAchievementSystem({ activities: [ride('ride500', 0, 500)], units: 'imperial' });
  const metric = evaluateAchievementSystem({ activities: [ride('ride500', 0, 500)], units: 'metric' });
  const imperial500 = imperial.find(item => item.id === 'lifetime_cycle_500_mi')!;
  const metric500 = metric.find(item => item.id === 'lifetime_cycle_500_mi')!;
  assert.equal(imperial500.displayTarget, '500 mi');
  assert.equal(metric500.displayTarget, '805 km');
  assert.equal(imperial500.artworkKey, metric500.artworkKey);
  assert.equal(imperial500.id, metric500.id);
});

test('Lifetime Distance - Cycling state boundaries, indoor distance, and progress remain stable', () => {
  const below = evaluateAchievementSystem({ activities: [ride('below-cycle', 0, 499.99)], units: 'imperial' }).find(item => item.id === 'lifetime_cycle_500_mi')!;
  const exact = evaluateAchievementSystem({ activities: [ride('exact-cycle', 0, 500)], units: 'imperial' }).find(item => item.id === 'lifetime_cycle_500_mi')!;
  const indoor = evaluateAchievementSystem({
    activities: [
      ride('outdoor-cycle', 0, 250),
      ride('indoor-cycle', 1, 250, { activityType: 'indoor_cycling', indoor: true, metrics: { distanceMeters: 250 * M_PER_MI, distanceSource: 'sensor_fusion' } }),
    ],
    units: 'imperial',
  }).find(item => item.id === 'lifetime_cycle_500_mi')!;
  const runningOnly = evaluateAchievementSystem({ activities: [run('run-not-cycle', 0, 500)], units: 'imperial' }).find(item => item.id === 'lifetime_cycle_500_mi')!;
  assert.equal(below.state, 'locked');
  assert.equal(below.displayRemaining, '0.1 mi remaining');
  assert.equal(exact.state, 'earned');
  assert.equal(exact.remaining, 0);
  assert.equal(indoor.state, 'earned');
  assert.deepEqual(indoor.supportingActivityIds, ['outdoor-cycle', 'indoor-cycle']);
  assert.equal(runningOnly.state, 'locked');
});

test('Lifetime Distance - Cycling awards persist through the legacy award emitter and hub model', () => {
  const activities = [ride('legacy-cycle500', 0, 500)];
  const awards = evaluateAchievementAwards(activities, [], baseTime);
  const awardIds = awards.map(item => item.id);
  assert.equal(awardIds.includes('lifetime_cycle_10_mi'), true);
  assert.equal(awardIds.includes('lifetime_cycle_500_mi'), true);
  assert.equal(awardIds.includes('lifetime_cycle_1000_mi'), false);
  assert.deepEqual(
    awards.find(item => item.id === 'lifetime_cycle_500_mi')?.supportingActivityIds,
    ['legacy-cycle500'],
  );

  const hub = buildAchievementHubModel(activities, [], baseTime);
  assert.equal(hub.definitions.some(item => item.id === 'lifetime_cycle_500_mi' && item.category === 'lifetime_cycling'), true);
  assert.equal(hub.shareable.some(item => item.id === 'lifetime_cycle_500_mi'), true);
});

test('Lifetime Distance - Cycling exports preserve transparent alpha, locked hue removal, no inner ring, and opaque parity', () => {
  const definition = LIFETIME_DISTANCE_CYCLING_DEFINITIONS.find(item => item.thresholdMiles === 500)!;
  const transparent = PNG.sync.read(readFileSync(path.resolve(process.cwd(), definition.shareTransparentPngPath)));
  const cornerAlpha = transparent.data[3];
  const centerAlpha = transparent.data[(transparent.width * 512 + 512) * 4 + 3];
  assert.equal(cornerAlpha, 0);
  assert.equal(centerAlpha, 0);

  const unlockedSvg = readFileSync(path.resolve(process.cwd(), definition.artworkPath), 'utf8');
  const lockedSvg = readFileSync(path.resolve(process.cwd(), definition.lockedArtworkPath), 'utf8').toLowerCase();
  assert.equal(unlockedSvg.includes('M50 15.2 Q51.7 15.2 53.1 16.6'), false);
  const tierHexes = Object.values(LIFETIME_DISTANCE_CYCLING_TIER_COLORS).flatMap(colors => Object.values(colors).map(value => value.toLowerCase()));
  for (const hex of tierHexes) assert.equal(lockedSvg.includes(hex), false, `${definition.lockedArtworkPath} contains tier hue ${hex}`);

  assert.equal(
    renderLifetimeDistanceCyclingBadgeSvg(500, 'share-opaque'),
    renderLifetimeDistanceCyclingBadgeSvg(500, 'unlocked'),
  );
});

test('Lifetime Distance - Cycling accessibility labels include state and unit-aware remaining distance', () => {
  const below = evaluateAchievementSystem({ activities: [ride('c382', 0, 382)], units: 'imperial' }).find(item => item.id === 'lifetime_cycle_500_mi')!;
  const metric = evaluateAchievementSystem({ activities: [ride('c382m', 0, 382)], units: 'metric' }).find(item => item.id === 'lifetime_cycle_500_mi')!;
  const earned = evaluateAchievementSystem({ activities: [ride('c500a11y', 0, 500)], units: 'imperial' }).find(item => item.id === 'lifetime_cycle_500_mi')!;
  assert.equal(below.accessibilityLabel, '500 mile lifetime cycling distance achievement. Locked. 118 miles remaining.');
  assert.equal(metric.accessibilityLabel, '805 kilometer lifetime cycling distance achievement. Locked. 190 kilometers remaining.');
  assert.equal(earned.accessibilityLabel, '500 mile lifetime cycling distance achievement. Unlocked.');
});

test('run level progress follows the canonical unit toggle without changing badge identity', () => {
  const activities = [run('run512', 0, 512)];
  const imperial = evaluateAchievementSystem({ activities, units: 'imperial' });
  const metric = evaluateAchievementSystem({ activities, units: 'metric' });
  const engineImperial = imperial.find(item => item.id === 'run_level_engine');
  const engineMetric = metric.find(item => item.id === 'run_level_engine');
  assert.equal(engineImperial?.state, 'locked');
  assert.equal(engineImperial?.displayProgress, '512 mi');
  assert.equal(engineImperial?.displayRemaining, '238 mi to Engine');
  assert.equal(engineImperial?.displayTarget, '750 mi');
  assert.equal(engineMetric?.displayProgress, '824 km');
  assert.equal(engineMetric?.displayRemaining, '383 km to Engine');
  assert.equal(engineMetric?.displayTarget, '1,207 km');
  assert.equal(engineImperial?.artworkKey, engineMetric?.artworkKey);
});

test('canonical Weekly Distance ladder has eight fixed-K original hex badge definitions', () => {
  assert.deepEqual(WEEKLY_DISTANCE_DEFINITIONS.map(item => item.thresholdKm), [5, 10, 15, 25, 30, 50, 75, 100]);
  assert.deepEqual(WEEKLY_DISTANCE_DEFINITIONS.map(item => item.id), [
    'weekly_5k',
    'weekly_10k',
    'weekly_15k',
    'weekly_25k',
    'weekly_30k',
    'weekly_50k',
    'weekly_75k',
    'weekly_100k',
  ]);
  for (const definition of WEEKLY_DISTANCE_DEFINITIONS) {
    assert.equal(existsSync(path.resolve(process.cwd(), definition.artworkPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.lockedArtworkPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.shareTransparentPngPath)), true);
    assert.equal(existsSync(path.resolve(process.cwd(), definition.shareOpaquePngPath)), true);
  }
});

test('Weekly Distance badge identity stays fixed-K while supporting progress follows unit preference', () => {
  const imperial = evaluateAchievementSystem({ activities: [run('wk12mi', 0, 12.4)], units: 'imperial' });
  const metric = evaluateAchievementSystem({ activities: [run('wk12mi', 0, 12.4)], units: 'metric' });
  const weeklyImperial = imperial.find(item => item.id === 'weekly_25k')!;
  const weeklyMetric = metric.find(item => item.id === 'weekly_25k')!;

  assert.equal(weeklyImperial.title, '25K Per Week');
  assert.equal(weeklyMetric.title, '25K Per Week');
  assert.equal(weeklyImperial.shortTitle, '25K');
  assert.equal(weeklyMetric.shortTitle, '25K');
  assert.equal(weeklyImperial.displayProgress, '12.4 mi');
  assert.equal(weeklyImperial.displayTarget, '15.5 mi');
  assert.equal(weeklyMetric.displayProgress, '20 km');
  assert.equal(weeklyMetric.displayTarget, '25 km');
  assert.equal(weeklyImperial.id, weeklyMetric.id);
  assert.equal(weeklyImperial.artworkKey, weeklyMetric.artworkKey);

  const svg = renderWeeklyDistanceBadgeSvg(25, 'unlocked');
  assert.equal(svg.includes('25K'), true);
  assert.equal(svg.includes('PER WEEK'), true);
  assert.equal(/\bMI\b|\bKM\b/.test(svg), false);
});

test('Weekly Distance state boundaries, local week grouping, and progress remain stable', () => {
  const below = evaluateAchievementSystem({ activities: [run('week-below', 0, 15.52)], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;
  const exact = evaluateAchievementSystem({ activities: [activity({ id: 'week-exact', activityType: 'running', startTime: baseTime, metrics: { distanceMeters: 25_000 } })], units: 'metric' }).find(item => item.id === 'weekly_25k')!;
  const above = evaluateAchievementSystem({ activities: [run('week-above', 0, 16)], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;
  const splitWeeks = evaluateAchievementSystem({
    activities: [
      run('sun', -1, 10),
      run('mon', 0, 10),
    ],
    units: 'imperial',
  }).find(item => item.id === 'weekly_25k')!;

  assert.equal(below.state, 'locked');
  assert.equal(below.remaining > 0, true);
  assert.equal(exact.state, 'earned');
  assert.equal(exact.remaining, 0);
  assert.equal(above.state, 'earned');
  assert.equal(above.remaining, 0);
  assert.equal(above.progressPercentage, 1);
  assert.equal(splitWeeks.state, 'locked');
  assert.equal(splitWeeks.currentPeriodKey, '2026-07-27');
});

test('Weekly Distance recalculates after activity edit, delete, backdate, and HealthKit dedupe', () => {
  const earned = evaluateAchievementSystem({ activities: [run('weekly-edit', 0, 16)], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;
  const edited = evaluateAchievementSystem({ activities: [run('weekly-edit', 0, 9)], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;
  const deleted = evaluateAchievementSystem({ activities: [], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;
  const backdated = evaluateAchievementSystem({ activities: [run('weekly-backdated', -30, 16)], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;
  const tracked = run('weekly-tracked', 0, 10, { source: 'tracked', endTime: baseTime + 3600_000 });
  const imported = run('weekly-hk', 0, 10, {
    source: 'healthkit',
    endTime: baseTime + 3600_000,
    healthKit: {
      workoutUuid: 'same-weekly-run',
      sourceBundleIdentifier: 'com.apple.health',
      originalStartTime: baseTime,
      originalEndTime: baseTime + 3600_000,
      localCalendarDate: '2026-08-03',
      importedAt: baseTime + 4000,
      routeStatus: 'not_available',
      importedByStrideOS: true,
    },
  });
  const deduped = evaluateAchievementSystem({ activities: [tracked, imported], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;

  assert.equal(earned.state, 'earned');
  assert.equal(edited.state, 'locked');
  assert.equal(deleted.state, 'locked');
  assert.equal(backdated.state, 'earned');
  assert.equal(backdated.currentPeriodKey, '2026-06-29');
  assert.equal(deduped.state, 'locked');
  assert.deepEqual(deduped.supportingActivityIds, ['weekly-tracked']);
});

test('Weekly Distance awards persist through the legacy award emitter and hub model', () => {
  const activities = [run('legacy-weekly25', 0, 16)];
  const awards = evaluateAchievementAwards(activities, [], baseTime);
  const awardIds = awards.map(item => item.id);
  assert.equal(awardIds.includes('weekly_25k'), true);
  assert.equal(awardIds.includes('weekly_30k'), false);
  assert.deepEqual(
    awards.find(item => item.id === 'weekly_25k')?.supportingActivityIds,
    ['legacy-weekly25'],
  );

  const hub = buildAchievementHubModel(activities, [], baseTime);
  assert.equal(hub.definitions.some(item => item.id === 'weekly_25k' && item.category === 'weekly_distance'), true);
  assert.equal(hub.shareable.some(item => item.id === 'weekly_25k'), true);
});

test('Weekly Distance exports preserve transparent alpha, locked hue removal, no divider, and opaque parity', () => {
  const definition = WEEKLY_DISTANCE_DEFINITIONS.find(item => item.thresholdKm === 25)!;
  const transparent = PNG.sync.read(readFileSync(path.resolve(process.cwd(), definition.shareTransparentPngPath)));
  const cornerAlpha = transparent.data[3];
  const centerAlpha = transparent.data[(transparent.width * 512 + 512) * 4 + 3];
  assert.equal(cornerAlpha, 0);
  assert.equal(centerAlpha, 0);

  const unlockedSvg = readFileSync(path.resolve(process.cwd(), definition.artworkPath), 'utf8');
  const lockedSvg = readFileSync(path.resolve(process.cwd(), definition.lockedArtworkPath), 'utf8').toLowerCase();
  assert.equal(unlockedSvg.includes('PER WEEK'), true);
  assert.equal(unlockedSvg.includes('M39 65 H73'), false);
  const tierHexes = Object.values(WEEKLY_DISTANCE_TIER_COLORS).flatMap(colors => Object.values(colors).map(value => value.toLowerCase()));
  for (const hex of tierHexes) assert.equal(lockedSvg.includes(hex), false, `${definition.lockedArtworkPath} contains tier hue ${hex}`);

  assert.equal(
    renderWeeklyDistanceBadgeSvg(25, 'share-opaque'),
    renderWeeklyDistanceBadgeSvg(25, 'unlocked'),
  );
});

test('Weekly Distance accessibility labels include fixed achievement identity and unit-aware remaining distance', () => {
  const below = evaluateAchievementSystem({ activities: [run('wk-a11y', 0, 12.4)], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;
  const metric = evaluateAchievementSystem({ activities: [activity({ id: 'wk-a11y-metric', activityType: 'running', startTime: baseTime, metrics: { distanceMeters: 20_400 } })], units: 'metric' }).find(item => item.id === 'weekly_25k')!;
  const earned = evaluateAchievementSystem({ activities: [run('wk-a11y-earned', 0, 16)], units: 'imperial' }).find(item => item.id === 'weekly_25k')!;
  assert.equal(below.accessibilityLabel, '25 kilometer weekly distance achievement. Locked. 3.1 miles remaining this week.');
  assert.equal(metric.accessibilityLabel, '25 kilometer weekly distance achievement. Locked. 4.6 kilometers remaining this week.');
  assert.equal(earned.accessibilityLabel, '25 kilometer weekly distance achievement. Unlocked.');
});

test('first 5K boundary unlocks at exact threshold and keeps fixed-K identity', () => {
  const below = evaluateAchievementSystem({ activities: [run('r1', 0, 3.1062)], units: 'imperial' });
  assert.equal(below.find(item => item.id === 'first_5k')?.state, 'locked');
  const exact = evaluateAchievementSystem({ activities: [run('r2', 0, 3.106856)], units: 'imperial' });
  const first5k = exact.find(item => item.id === 'first_5k');
  assert.equal(first5k?.state, 'earned');
  assert.equal(first5k?.title, 'First 5K');
  assert.equal(first5k?.displayTarget, '5K');
});

test('unit-sensitive lifetime running and cycling display switches without source mutation', () => {
  const activities = [
    run('run100', 0, 100),
    activity({ id: 'ride100', activityType: 'cycling', startTime: baseTime, metrics: { distanceMeters: 100 * M_PER_MI } }),
  ];
  const imperial = evaluateAchievementSystem({ activities, units: 'imperial' });
  const metric = evaluateAchievementSystem({ activities, units: 'metric' });
  assert.equal(imperial.find(item => item.id === 'lifetime_run_100_mi')?.displayTarget, '100 mi');
  assert.equal(metric.find(item => item.id === 'lifetime_run_100_mi')?.displayTarget, '161 km');
  assert.equal(metric.find(item => item.id === 'lifetime_cycle_100_mi')?.displayTarget, '161 km');
  assert.equal(activities[0].metrics.distanceMeters, 100 * M_PER_MI);
});

test('half and full marathon support values follow unit preference while names stay fixed', () => {
  const half = ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === 'first_half_marathon')!;
  const full = ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === 'first_marathon')!;
  assert.equal(half.title, 'First Half Marathon');
  assert.equal(formatAchievementSupportValue(half, 'imperial'), '13.1 mi');
  assert.equal(formatAchievementSupportValue(half, 'metric'), '21.1 km');
  assert.equal(full.title, 'First Marathon');
  assert.equal(formatAchievementSupportValue(full, 'imperial'), '26.2 mi');
  assert.equal(formatAchievementSupportValue(full, 'metric'), '42.2 km');
});

test('scheduled rest and recovery days preserve schedule-based streaks', () => {
  const scheduledSessions = [
    session('2026-08-03', { status: 'completed', completedActivityId: 'mon' }),
    session('2026-08-04', { activityType: 'rest', title: 'Rest Day', priority: 'optional' }),
    session('2026-08-05', { activityType: 'strength', status: 'completed', completedActivityId: 'wed' }),
    session('2026-08-06', { status: 'completed', completedActivityId: 'thu' }),
    session('2026-08-07', { activityType: 'mobility', title: 'Recovery Mobility', priority: 'optional' }),
    session('2026-08-08', { status: 'completed', completedActivityId: 'sat' }),
    session('2026-08-09', { status: 'completed', completedActivityId: 'sun' }),
  ];
  const activities = [
    run('mon', 0, 3, { scheduled: true, scheduledSessionId: 'session_2026-08-03' }),
    activity({ id: 'wed', activityType: 'strength', startTime: baseTime + 2 * DAY_MS, scheduled: true, scheduledSessionId: 'session_2026-08-05' }),
    run('thu', 3, 3, { scheduled: true, scheduledSessionId: 'session_2026-08-06' }),
    run('sat', 5, 3, { scheduled: true, scheduledSessionId: 'session_2026-08-08' }),
    run('sun', 6, 3, { scheduled: true, scheduledSessionId: 'session_2026-08-09' }),
  ];
  const evaluated = evaluateAchievementSystem({ activities, units: 'imperial', scheduledSessions, now: new Date('2026-08-09T18:00:00').getTime() });
  assert.equal(evaluated.find(item => item.id === 'streak_1_week')?.state, 'earned');
});

test('missed required scheduled session interrupts streak progress', () => {
  const scheduledSessions = [
    session('2026-08-03', { status: 'completed', completedActivityId: 'mon' }),
    session('2026-08-04', { status: 'missed' }),
    session('2026-08-05', { status: 'completed', completedActivityId: 'wed' }),
  ];
  const activities = [
    run('mon', 0, 3, { scheduled: true, scheduledSessionId: 'session_2026-08-03' }),
    run('wed', 2, 3, { scheduled: true, scheduledSessionId: 'session_2026-08-05' }),
  ];
  const evaluated = evaluateAchievementSystem({ activities, units: 'imperial', scheduledSessions, now: new Date('2026-08-05T18:00:00').getTime() });
  assert.equal(evaluated.find(item => item.id === 'streak_1_week')?.state, 'locked');
});

test('activity edit, delete, and backdate recalculate lifetime and weekly achievements', () => {
  const oneRun = [run('r1', 0, 10)];
  assert.equal(evaluateAchievementSystem({ activities: oneRun, units: 'imperial' }).find(item => item.id === 'lifetime_run_10_mi')?.state, 'earned');
  assert.equal(evaluateAchievementSystem({ activities: [], units: 'imperial' }).find(item => item.id === 'lifetime_run_10_mi')?.state, 'locked');
  const edited = [run('r1', 0, 9.99)];
  assert.equal(evaluateAchievementSystem({ activities: edited, units: 'imperial' }).find(item => item.id === 'lifetime_run_10_mi')?.state, 'locked');
  const backdated = [run('old', -30, 16)];
  const weekly = evaluateAchievementSystem({ activities: backdated, units: 'imperial' }).find(item => item.id === 'weekly_25k');
  assert.equal(weekly?.state, 'earned');
  assert.equal(weekly?.currentPeriodKey, '2026-06-29');
});

test('HealthKit duplicate of StrideOS-tracked workout is not double counted', () => {
  const tracked = run('tracked', 0, 10, { source: 'tracked', endTime: baseTime + 3600_000 });
  const imported = run('hk', 0, 10, {
    source: 'healthkit',
    endTime: baseTime + 3600_000,
    healthKit: {
      workoutUuid: 'same-workout',
      sourceBundleIdentifier: 'com.apple.health',
      originalStartTime: baseTime,
      originalEndTime: baseTime + 3600_000,
      localCalendarDate: '2026-08-03',
      importedAt: baseTime + 4000,
      routeStatus: 'not_available',
      importedByStrideOS: true,
    },
  });
  const evaluated = evaluateAchievementSystem({ activities: [tracked, imported], units: 'imperial' });
  assert.equal(evaluated.find(item => item.id === 'lifetime_run_10_mi')?.state, 'earned');
  assert.equal(evaluated.find(item => item.id === 'lifetime_run_26_2_mi')?.state, 'locked');
});

test('strength counts and consistency use canonical completed strength activities', () => {
  const strengths = Array.from({ length: 12 }, (_, index) => activity({
    id: `s${index}`,
    activityType: 'strength',
    startTime: baseTime + index * WEEK_MS,
  }));
  const evaluated = evaluateAchievementSystem({ activities: strengths, units: 'imperial' });
  assert.equal(evaluated.find(item => item.id === 'strength_10_sessions')?.state, 'earned');
  assert.equal(evaluated.find(item => item.id === 'strength_12_weeks_consistent')?.state, 'earned');
});

test('recovery family contains exactly seven entries and excludes removed achievement', () => {
  const recovery = ACHIEVEMENT_SYSTEM_REGISTRY.filter(item => item.family === 'recovery');
  assert.equal(recovery.length, 7);
  assert.equal(recovery.some(item => /Modified Appropriately/i.test(item.title)), false);
});

test('readiness and assessment-backed achievements evaluate from canonical stores when supplied', () => {
  const readinessHistory = Array.from({ length: 7 }, (_, index) => ({
    schemaVersion: 1,
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    soreness: 2,
    sleepQuality: 4,
    stress: 2,
    energy: 4,
    motivation: 4,
    restingHeartRate: 60,
    hrv: 60,
    sleepMinutesTotal: 450,
  }));
  const evaluated = evaluateAchievementSystem({
    activities: [],
    units: 'metric',
    readinessHistory,
    assessmentResults: [{ id: 'a1', testKey: 'knee_to_wall', side: 'left', value: 10, unit: 'cm', testedAt: baseTime }],
  });
  assert.equal(evaluated.find(item => item.id === 'recovery_check_in_streak')?.state, 'earned');
  assert.equal(evaluated.find(item => item.id === 'recovery_sleep_consistency')?.state, 'earned');
  assert.equal(evaluated.find(item => item.id === 'first_movement_lab_analysis')?.state, 'earned');
});

test('route overlay uses actual GPS only and preserves no-route unavailable state', () => {
  const noRoute = run('indoor', 0, 3, { indoor: true, metrics: { distanceMeters: 3 * M_PER_MI, distanceSource: 'treadmill_reported' } });
  assert.equal(activityHasShareableRoute(noRoute), false);
  assert.equal(normalizeRouteForOverlay(undefined).hasRoute, false);
  const outdoor = run('outdoor', 0, 3, {
    metrics: {
      distanceMeters: 3 * M_PER_MI,
      routeCoordinates: [
        { latitude: 45.5, longitude: -122.7, timestamp: baseTime },
        { latitude: 45.51, longitude: -122.69, timestamp: baseTime + 1000 },
        { latitude: 45.515, longitude: -122.72, timestamp: baseTime + 2000 },
      ],
    },
  });
  assert.equal(activityHasShareableRoute(outdoor), true);
  const route = normalizeRouteForOverlay(outdoor.metrics.routeCoordinates, { width: 1080, height: 1920 });
  assert.equal(route.hasRoute, true);
  assert.ok(route.points.every(point => point.x >= 0 && point.x <= 1080 && point.y >= 0 && point.y <= 1920));
});

test('sharing is allowed only for earned achievements', () => {
  const evaluated = evaluateAchievementSystem({ activities: [run('r1', 0, 1)], units: 'imperial' });
  assert.equal(achievementShareAllowed(evaluated.find(item => item.id === 'first_run')!), true);
  assert.equal(achievementShareAllowed(evaluated.find(item => item.id === 'first_marathon')!), false);
});
