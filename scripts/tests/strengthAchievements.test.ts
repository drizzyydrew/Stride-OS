import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import {
  STRENGTH_ACHIEVEMENT_DEFINITIONS,
  STRENGTH_REGISTRY_DEFINITIONS,
} from '../../src/achievements/strength/strengthDefinitions';
import {
  renderStrengthAchievementBadgeSvg,
  strengthSessionDumbbellFragment,
} from '../../src/achievements/strength/strengthArtwork';
import { STRENGTH_COLORS } from '../../src/achievements/strength/strengthTokens';
import {
  strengthAchievementAccessibilityLabel,
  strengthAchievementDefinitionFromAchievementId,
} from '../../src/achievements/strength/strengthUtils';
import type { Activity } from '../../src/types/activity';
import {
  ACHIEVEMENT_SYSTEM_REGISTRY,
  auditAchievementRegistry,
  evaluateAchievementSystem,
} from '../../src/utils/achievementSystem';
import { evaluateAchievementAwards } from '../../src/utils/achievements';

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
      nonImpactAerobic: 0,
      confidence: 'moderate',
    },
    createdAt: partial.startTime,
    updatedAt: partial.startTime,
    ...partial,
    metrics: { durationSeconds: 1800, ...(partial.metrics ?? {}) },
  };
}

function strength(id: string, day: number, extra: Partial<Activity> = {}): Activity {
  return activity({
    id,
    activityType: 'strength',
    startTime: baseTime + day * DAY_MS,
    ...extra,
  });
}

function run(id: string, day: number): Activity {
  return activity({
    id,
    activityType: 'running',
    startTime: baseTime + day * DAY_MS,
    metrics: { durationSeconds: 1800, distanceMeters: 5000 },
  });
}

test('canonical Strength family contains exactly the approved ten badges without removed concepts', () => {
  assert.deepEqual(STRENGTH_ACHIEVEMENT_DEFINITIONS.map(item => item.title), [
    'First Strength Session',
    '10 Strength Sessions',
    '25 Strength Sessions',
    '50 Strength Sessions',
    '100 Strength Sessions',
    '6 Weeks Consistent Strength',
    '12 Weeks Consistent Strength',
    'Strength + Run Week',
    'First Structured Workout',
    'Prehab & Resilience',
  ]);
  assert.equal(STRENGTH_ACHIEVEMENT_DEFINITIONS.length, 10);
  assert.equal(STRENGTH_REGISTRY_DEFINITIONS.some(item => item.id === 'first_structured_workout'), false);
  assert.equal(ACHIEVEMENT_SYSTEM_REGISTRY.some(item => item.id === 'first_structured_workout' && item.family === 'strength'), false);
  assert.equal(auditAchievementRegistry().duplicateIds.length, 0);
  const forbidden = new Set(['lower_body_durability', 'single_leg_strength_consistency', 'strength_during_race_prep']);
  assert.equal(STRENGTH_ACHIEVEMENT_DEFINITIONS.some(item => forbidden.has(item.id)), false);
});

test('all Strength session badges use one identical canonical dumbbell fragment', () => {
  const ids = [
    'first_strength_session',
    'strength_10_sessions',
    'strength_25_sessions',
    'strength_50_sessions',
    'strength_100_sessions',
  ] as const;
  const fragments = ids.map(id => strengthSessionDumbbellFragment(renderStrengthAchievementBadgeSvg(id, 'unlocked')));
  assert.ok(fragments.every(Boolean));
  assert.equal(new Set(fragments).size, 1);
  assert.equal((renderStrengthAchievementBadgeSvg('strength_100_sessions').match(/canonical-strength-dumbbell/g) ?? []).length, 1);
});

test('Strength session count boundaries unlock at the exact thresholds', () => {
  const nine = Array.from({ length: 9 }, (_, index) => strength(`s${index}`, index));
  const ten = Array.from({ length: 10 }, (_, index) => strength(`s${index}`, index));
  const oneHundred = Array.from({ length: 100 }, (_, index) => strength(`s${index}`, index));

  const below = evaluateAchievementSystem({ activities: nine, units: 'imperial' });
  const exact = evaluateAchievementSystem({ activities: ten, units: 'imperial' });
  const hundred = evaluateAchievementSystem({ activities: oneHundred, units: 'imperial' });

  assert.equal(exact.find(item => item.id === 'first_strength_session')?.state, 'earned');
  assert.equal(below.find(item => item.id === 'strength_10_sessions')?.state, 'locked');
  assert.equal(exact.find(item => item.id === 'strength_10_sessions')?.state, 'earned');
  assert.equal(hundred.find(item => item.id === 'strength_25_sessions')?.state, 'earned');
  assert.equal(hundred.find(item => item.id === 'strength_50_sessions')?.state, 'earned');
  assert.equal(hundred.find(item => item.id === 'strength_100_sessions')?.state, 'earned');
  assert.equal(hundred.find(item => item.id === 'strength_100_sessions')?.remaining, 0);
});

test('Strength progress recalculates after skipped/deleted and edited activities', () => {
  const ten = Array.from({ length: 10 }, (_, index) => strength(`s${index}`, index));
  const withSkipped = ten.map((item, index) => index === 9 ? { ...item, status: 'skipped' as const } : item);
  const edited = ten.map((item, index) => index === 9 ? { ...item, activityType: 'mobility' as const } : item);

  assert.equal(evaluateAchievementSystem({ activities: ten, units: 'imperial' }).find(item => item.id === 'strength_10_sessions')?.state, 'earned');
  assert.equal(evaluateAchievementSystem({ activities: withSkipped, units: 'imperial' }).find(item => item.id === 'strength_10_sessions')?.state, 'locked');
  assert.equal(evaluateAchievementSystem({ activities: edited, units: 'imperial' }).find(item => item.id === 'strength_10_sessions')?.state, 'locked');
});

test('Strength consistency and Strength + Run Week use canonical week grouping', () => {
  const twelveWeeks = Array.from({ length: 12 }, (_, index) => strength(`w${index}`, index * 7));
  const sameWeek = [run('r1', 1), strength('s1', 2)];
  const evaluatedWeeks = evaluateAchievementSystem({ activities: twelveWeeks, units: 'imperial', now: baseTime + 12 * WEEK_MS });
  const evaluatedCombo = evaluateAchievementSystem({ activities: sameWeek, units: 'imperial' });

  assert.equal(evaluatedWeeks.find(item => item.id === 'strength_6_weeks_consistent')?.state, 'earned');
  assert.equal(evaluatedWeeks.find(item => item.id === 'strength_12_weeks_consistent')?.state, 'earned');
  assert.equal(evaluatedCombo.find(item => item.id === 'strength_run_week_completed')?.state, 'earned');
});

test('Structured workout and Prehab & Resilience unlock through existing canonical signals', () => {
  const structured = strength('structured', 0, { scheduledSessionId: 'plan-a' });
  const mobility = activity({
    id: 'prehab',
    activityType: 'mobility',
    startTime: baseTime,
    notes: 'prehab resilience block',
  });
  const awards = evaluateAchievementAwards([structured, mobility], [], baseTime).map(item => item.id);
  assert.equal(awards.includes('first_structured_workout'), true);
  assert.equal(awards.includes('prehab_resilience_block'), true);
});

test('Strength assets exist for all four states with real transparent PNG alpha', () => {
  for (const definition of STRENGTH_ACHIEVEMENT_DEFINITIONS) {
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
      assert.equal(existsSync(path.resolve(process.cwd(), assetPath)), true, `${assetPath} missing`);
    }
    const transparent = PNG.sync.read(readFileSync(path.resolve(process.cwd(), definition.shareTransparentPngPath)));
    const cornerAlpha = transparent.data[3];
    const openInteriorPoints = [
      [512, 185],
      [512, 235],
      [428, 575],
      [596, 575],
      [512, 610],
    ];
    assert.equal(cornerAlpha, 0);
    assert.equal(openInteriorPoints.some(([x, y]) => transparent.data[(transparent.width * y + x) * 4 + 3] === 0), true);
  }
});

test('Strength locked state contains no warm hue and opaque share matches unlocked render', () => {
  const warmHexes = Object.values(STRENGTH_COLORS).map(value => value.toLowerCase());
  for (const definition of STRENGTH_ACHIEVEMENT_DEFINITIONS) {
    const lockedSvg = renderStrengthAchievementBadgeSvg(definition.id, 'locked').toLowerCase();
    for (const hex of warmHexes) {
      assert.equal(lockedSvg.includes(hex), false, `${definition.id} locked render contains ${hex}`);
    }
    assert.equal(
      renderStrengthAchievementBadgeSvg(definition.id, 'share-opaque')
        .replace(/strength-[^"]+-opaque-/g, match => match.replace('-opaque-', '-unlocked-')),
      renderStrengthAchievementBadgeSvg(definition.id, 'unlocked'),
    );
  }
});

test('Strength accessibility labels include locked remaining progress where appropriate', () => {
  const hundred = strengthAchievementDefinitionFromAchievementId('strength_100_sessions');
  const twelve = strengthAchievementDefinitionFromAchievementId('strength_12_weeks_consistent');
  assert.ok(hundred);
  assert.ok(twelve);
  assert.equal(strengthAchievementAccessibilityLabel(hundred, 'locked', 36), '100 Strength Sessions achievement. Locked. 36 sessions remaining.');
  assert.equal(strengthAchievementAccessibilityLabel(twelve, 'locked', 2), '12 Weeks Consistent Strength achievement. Locked. 2 weeks remaining.');
  assert.equal(strengthAchievementAccessibilityLabel(hundred, 'earned'), '100 Strength Sessions achievement. Unlocked.');
});
