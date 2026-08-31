import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import {
  RECOVERY_ACHIEVEMENT_DEFINITIONS,
} from '../../src/achievements/recovery/recoveryDefinitions';
import { renderRecoveryAchievementBadgeSvg } from '../../src/achievements/recovery/recoveryArtwork';
import { RECOVERY_COLORS } from '../../src/achievements/recovery/recoveryTokens';
import {
  recoveryAchievementAccessibilityLabel,
  recoveryAchievementDefinitionFromAchievementId,
} from '../../src/achievements/recovery/recoveryUtils';
import type { Activity } from '../../src/types/activity';
import type { DailyReadiness } from '../../src/types/readiness';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';
import {
  ACHIEVEMENT_SYSTEM_REGISTRY,
  achievementActivityMetricPreview,
  auditAchievementRegistry,
  evaluateAchievementSystem,
} from '../../src/utils/achievementSystem';
import { evaluateAchievementAwards } from '../../src/utils/achievements';

const DAY_MS = 24 * 60 * 60 * 1000;
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
      wholeBody: 12,
      running: partial.activityType === 'running' ? 12 : 0,
      walking: partial.activityType === 'walking' ? 12 : 0,
      strength: partial.activityType === 'strength' ? 12 : 0,
      crossTraining: 0,
      impactBearing: ['running', 'walking'].includes(partial.activityType) ? 12 : 0,
      nonImpactAerobic: partial.activityType === 'mobility' ? 8 : 0,
      confidence: 'moderate',
    },
    createdAt: partial.startTime,
    updatedAt: partial.startTime,
    ...partial,
    metrics: { durationSeconds: 1800, ...(partial.metrics ?? {}) },
  };
}

function readiness(date: string, sleepMinutesTotal = 480): DailyReadiness {
  return {
    schemaVersion: 4,
    date,
    score: 78,
    sleepHours: Math.floor(sleepMinutesTotal / 60),
    sleepMinutes: sleepMinutesTotal % 60,
    sleepQuality: 4,
    bodyStatus: 4,
    energy: 4,
    stress: 4,
    sleepMinutesTotal,
    details: {},
  } as DailyReadiness;
}

function restSession(date: string): ScheduledSession {
  return {
    scheduledSessionId: `rest-${date}`,
    date,
    originalDate: date,
    activityType: 'rest',
    subtype: 'rest',
    title: 'Smart Rest Day',
    purpose: 'Planned recovery and adaptation',
    priority: 'primary',
    durationMinutes: 0,
    target: 'Respect the plan',
    status: 'completed',
  } as ScheduledSession;
}

function readPng(assetPath: string): PNG {
  return PNG.sync.read(readFileSync(path.resolve(process.cwd(), assetPath)));
}

function alphaAt(png: PNG, x: number, y: number): number {
  return png.data[(png.width * y + x) * 4 + 3];
}

test('Recovery / Readiness registry contains exactly seven canonical badges', () => {
  assert.deepEqual(RECOVERY_ACHIEVEMENT_DEFINITIONS.map(item => item.title), [
    'Recovery Week Completed',
    'Sleep Consistency Achieved',
    'Smart Rest Day',
    'Readiness Respected',
    'Symptoms Reported Early',
    'Check-In Streak',
    'Returned Gradually',
  ]);
  assert.equal(RECOVERY_ACHIEVEMENT_DEFINITIONS.length, 7);
  assert.equal(new Set(RECOVERY_ACHIEVEMENT_DEFINITIONS.map(item => item.id)).size, 7);
  assert.equal(RECOVERY_ACHIEVEMENT_DEFINITIONS.some(item => /modified appropriately/i.test(item.title)), false);
  assert.equal(ACHIEVEMENT_SYSTEM_REGISTRY.filter(item => item.family === 'recovery').length, 7);
  assert.equal(auditAchievementRegistry().duplicateIds.length, 0);
});

test('Recovery runtime logic unlocks each approved achievement from canonical signals', () => {
  const activities = [
    activity({ id: 'mobility', activityType: 'mobility', subtype: 'recovery', startTime: baseTime }),
    activity({ id: 'modified', activityType: 'running', completionClassification: 'modified', startTime: baseTime + DAY_MS }),
    activity({ id: 'symptoms', activityType: 'running', symptoms: ['tight calf'], startTime: baseTime + 2 * DAY_MS }),
    activity({ id: 'before-gap', activityType: 'running', startTime: baseTime - 10 * DAY_MS, rpe: 3 }),
    activity({ id: 'after-gap', activityType: 'running', startTime: baseTime, rpe: 4 }),
  ];
  const readinessHistory = Array.from({ length: 7 }, (_, index) => readiness(`2026-08-${String(index + 3).padStart(2, '0')}`));
  const evaluated = evaluateAchievementSystem({
    activities,
    units: 'imperial',
    scheduledSessions: [restSession('2026-08-03')],
    readinessHistory,
  });
  const earned = new Set(evaluated.filter(item => item.family === 'recovery' && item.state === 'earned').map(item => item.id));
  for (const definition of RECOVERY_ACHIEVEMENT_DEFINITIONS) {
    assert.equal(earned.has(definition.id), true, `${definition.id} did not unlock`);
  }
});

test('Recovery legacy awards emit canonical IDs and avoid duplicate check-in counting', () => {
  const duplicateCheckIns = [
    '2026-08-03',
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
  ];
  const below = evaluateAchievementAwards([], [], {
    now: baseTime,
    checkInDates: duplicateCheckIns,
  }).map(item => item.id);
  const exact = evaluateAchievementAwards([], [], {
    now: baseTime,
    checkInDates: [...duplicateCheckIns, '2026-08-09'],
  }).map(item => item.id);

  assert.equal(below.includes('recovery_check_in_streak'), false);
  assert.equal(exact.includes('recovery_check_in_streak'), true);
  assert.equal(evaluateAchievementAwards([activity({ id: 'm', activityType: 'mobility', startTime: baseTime })], [], baseTime).some(item => item.id === 'recovery_week_completed'), true);
});

test('Recovery locked progress uses real progress only where applicable', () => {
  const binary = evaluateAchievementSystem({ activities: [], units: 'imperial' }).find(item => item.id === 'recovery_smart_rest_day')!;
  const checkIns = evaluateAchievementSystem({
    activities: [],
    units: 'imperial',
    checkInDates: ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06'],
  }).find(item => item.id === 'recovery_check_in_streak')!;

  assert.equal(binary.state, 'locked');
  assert.equal(binary.displayRemaining, 'Respect a planned rest day.');
  assert.equal(binary.displayRemaining.includes('%'), false);
  assert.equal(checkIns.displayRemaining, '4 / 7 check-ins. 3 check-ins remaining.');
  assert.equal(checkIns.remaining, 3);
});

test('Recovery assets exist for all four states with real transparent PNG alpha', () => {
  for (const definition of RECOVERY_ACHIEVEMENT_DEFINITIONS) {
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
    const transparent = readPng(definition.shareTransparentPngPath);
    const openInteriorPoints = [
      [512, 180],
      [512, 220],
      [420, 585],
      [604, 585],
      [512, 612],
    ];
    assert.equal(alphaAt(transparent, 0, 0), 0);
    assert.equal(openInteriorPoints.some(([x, y]) => alphaAt(transparent, x, y) === 0), true);
  }
});

test('Recovery renderer states preserve one geometry, remove hue when locked, and keep opaque parity', () => {
  for (const definition of RECOVERY_ACHIEVEMENT_DEFINITIONS) {
    const unlocked = renderRecoveryAchievementBadgeSvg(definition.id, 'unlocked');
    const locked = renderRecoveryAchievementBadgeSvg(definition.id, 'locked').toLowerCase();
    const transparent = renderRecoveryAchievementBadgeSvg(definition.id, 'share-transparent');
    for (const word of definition.titleLines.join(' ').split(' ')) {
      assert.equal(unlocked.includes(word), true);
    }
    assert.equal(transparent.includes('fill="transparent" fill-opacity="0"'), true);
    assert.equal(renderRecoveryAchievementBadgeSvg(definition.id, 'share-opaque'), unlocked);
    for (const hex of Object.values(RECOVERY_COLORS).map(value => value.toLowerCase())) {
      assert.equal(locked.includes(hex), false, `${definition.id} locked render contains recovery hue ${hex}`);
    }
  }
});

test('Recovery accessibility and share previews avoid sensitive health details by default', () => {
  const symptoms = recoveryAchievementDefinitionFromAchievementId('recovery_symptoms_reported_early');
  const checkIn = recoveryAchievementDefinitionFromAchievementId('recovery_check_in_streak');
  assert.ok(symptoms);
  assert.ok(checkIn);
  assert.equal(recoveryAchievementAccessibilityLabel(symptoms, 'locked'), 'Symptoms Reported Early achievement. Locked.');
  assert.equal(recoveryAchievementAccessibilityLabel(checkIn, 'locked', 3), 'Check-In Streak achievement. Locked. 3 check-ins remaining.');

  const preview = achievementActivityMetricPreview(activity({
    id: 'private',
    activityType: 'running',
    startTime: baseTime,
    notes: 'private symptom note',
    symptoms: ['sharp calf pain'],
    metrics: { durationSeconds: 1200, distanceMeters: 3200 },
  }), 'imperial').join(' ');
  assert.equal(/private symptom note|sharp calf pain/i.test(preview), false);
});
