import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

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
  assert.ok(getAchievementManifestEntry('streak_6_month'));
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
  assert.equal(imperial.find(item => item.id === 'lifetime_run_100_mi')?.displayTarget, '100.0 mi');
  assert.equal(metric.find(item => item.id === 'lifetime_run_100_mi')?.displayTarget, '160.9 km');
  assert.equal(metric.find(item => item.id === 'lifetime_cycle_100_mi')?.displayTarget, '160.9 km');
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
  ];
  const activities = [
    run('mon', 0, 3, { scheduled: true, scheduledSessionId: 'session_2026-08-03' }),
    activity({ id: 'wed', activityType: 'strength', startTime: baseTime + 2 * DAY_MS, scheduled: true, scheduledSessionId: 'session_2026-08-05' }),
  ];
  const evaluated = evaluateAchievementSystem({ activities, units: 'imperial', scheduledSessions, now: new Date('2026-08-05T18:00:00').getTime() });
  assert.equal(evaluated.find(item => item.id === 'streak_3_day')?.state, 'earned');
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
  assert.equal(evaluated.find(item => item.id === 'streak_3_day')?.state, 'locked');
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
  assert.equal(evaluated.find(item => item.id === 'first_movement_lab_assessment')?.state, 'earned');
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
