import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  BUILD57_ACHIEVEMENT_DEFINITIONS,
  STREAK_ACHIEVEMENTS,
  buildAchievementHubModel,
  calculateStreakAchievements,
} from '../../src/utils/achievements';
import type { Activity } from '../../src/types/activity';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';

function at(date: string, hour = 12): number {
  const [year = 2026, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(year, month - 1, day, hour).getTime();
}

function add(date: string, days: number): string {
  const next = new Date(at(date, 0));
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function activity(date: string, overrides: Partial<Activity> = {}): Activity {
  const startTime = at(date);
  return {
    id: overrides.id ?? `activity-${date}`,
    activityType: overrides.activityType ?? 'running',
    source: 'training_plan',
    status: overrides.status ?? 'completed',
    completionClassification: overrides.completionClassification ?? (overrides.status === 'skipped' ? 'skipped' : 'completed_as_prescribed'),
    scheduled: true,
    scheduledSessionId: overrides.scheduledSessionId ?? `session-${date}`,
    startTime,
    endTime: startTime + 1_800_000,
    indoor: false,
    metrics: { durationSeconds: 1800, ...(overrides.metrics ?? {}) },
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
    createdAt: startTime,
    updatedAt: startTime,
    ...overrides,
  };
}

function session(date: string, overrides: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    scheduledSessionId: overrides.scheduledSessionId ?? `session-${date}`,
    date,
    originalDate: date,
    activityType: overrides.activityType ?? 'run',
    subtype: overrides.subtype ?? 'easy_run',
    title: overrides.title ?? 'Easy Run',
    purpose: overrides.purpose ?? 'Planned aerobic work',
    priority: overrides.priority ?? 'primary',
    durationMinutes: overrides.durationMinutes ?? 30,
    target: overrides.target ?? '30 min easy',
    status: overrides.status ?? 'completed',
    completedActivityId: overrides.completedActivityId ?? `activity-${date}`,
    ...overrides,
  };
}

function completedScheduledRange(startDate: string, days: number) {
  const sessions: ScheduledSession[] = [];
  const activities: Activity[] = [];
  for (let index = 0; index < days; index += 1) {
    const date = add(startDate, index);
    sessions.push(session(date));
    activities.push(activity(date));
  }
  return { sessions, activities, now: at(add(startDate, days - 1)) };
}

test('streak family uses exactly the requested seven tiers and boundary thresholds', () => {
  assert.deepEqual(STREAK_ACHIEVEMENTS.map(item => item.badgeText), ['3', '7', '30', '50', '60', '90', '6M']);
  assert.deepEqual(STREAK_ACHIEVEMENTS.map(item => item.displayName), [
    '3-Day Streak',
    '1-Week Streak',
    '30-Day Streak',
    '50-Day Streak',
    '60-Day Streak',
    '90-Day Streak',
    '6-Month Streak',
  ]);

  for (const tier of STREAK_ACHIEVEMENTS) {
    const almost = completedScheduledRange('2026-01-01', tier.thresholdDays - 1);
    assert.equal(
      calculateStreakAchievements(almost.activities, { now: almost.now, scheduledSessions: almost.sessions }).achievements.find(item => item.id === tier.id)?.complete,
      false,
      `${tier.id} should remain locked one day before the threshold`,
    );

    const exact = completedScheduledRange('2026-01-01', tier.thresholdDays);
    assert.equal(
      calculateStreakAchievements(exact.activities, { now: exact.now, scheduledSessions: exact.sessions }).achievements.find(item => item.id === tier.id)?.complete,
      true,
      `${tier.id} should unlock exactly at the threshold`,
    );
  }
});

test('scheduled rest and recovery days preserve streaks without requiring daily exercise', () => {
  const dates = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
  const sessions = [
    session(dates[0]!),
    session(dates[1]!, { activityType: 'rest', subtype: 'rest', title: 'Rest Day', purpose: 'Scheduled rest', completedActivityId: undefined }),
    session(dates[2]!, { activityType: 'strength', subtype: 'strength', title: 'Strength' }),
    session(dates[3]!, { activityType: 'mobility', subtype: 'recovery', title: 'Recovery Mobility', purpose: 'Scheduled recovery', priority: 'optional', completedActivityId: undefined }),
    session(dates[4]!),
  ];
  const activities = [
    activity(dates[0]!),
    activity(dates[2]!, { activityType: 'strength' }),
    activity(dates[4]!),
  ];

  const streak = calculateStreakAchievements(activities, { now: at(dates[4]!), scheduledSessions: sessions });
  assert.equal(streak.currentStreakDays, 5);
  assert.equal(streak.currentTier?.id, 'streak_3_day');
  assert.equal(streak.nextMilestone?.id, 'streak_1_week');
});

test('missed required workouts break the current streak while later adherence can rebuild', () => {
  const sessions = [
    session('2026-08-03'),
    session('2026-08-04'),
    session('2026-08-05', { status: 'missed', completedActivityId: undefined }),
    session('2026-08-06'),
    session('2026-08-07'),
  ];
  const activities = [
    activity('2026-08-03'),
    activity('2026-08-04'),
    activity('2026-08-06'),
    activity('2026-08-07'),
  ];
  const streak = calculateStreakAchievements(activities, { now: at('2026-08-07'), scheduledSessions: sessions });
  assert.equal(streak.currentStreakDays, 2);
  assert.equal(streak.currentTier, null);
  assert.equal(streak.achievements.find(item => item.id === 'streak_3_day')?.state, 'locked');
});

test('confirmed adaptations and body-listening completion classifications preserve streaks', () => {
  const sessions = [
    session('2026-08-03'),
    session('2026-08-04', {
      activityType: 'rest',
      subtype: 'adapted_rest',
      title: 'Adapted Rest',
      purpose: 'Coach-driven recovery modification',
      status: 'replaced',
      completedActivityId: undefined,
      adaptationReason: 'Replaced with rest after the athlete confirmed the change.',
    }),
    session('2026-08-05'),
  ];
  const activities = [
    activity('2026-08-03', { completionClassification: 'modified' }),
    activity('2026-08-05', { completionClassification: 'equivalent_substitute' }),
  ];
  const streak = calculateStreakAchievements(activities, { now: at('2026-08-05'), scheduledSessions: sessions });
  assert.equal(streak.currentStreakDays, 3);
  assert.equal(streak.currentTier?.id, 'streak_3_day');
});

test('next milestone progress and earned dates use exact crossing dates', () => {
  const range = completedScheduledRange('2026-07-01', 42);
  const streak = calculateStreakAchievements(range.activities, { now: range.now, scheduledSessions: range.sessions });
  assert.equal(streak.currentStreakDays, 42);
  assert.equal(streak.currentTier?.id, 'streak_30_day');
  assert.equal(streak.nextMilestone?.id, 'streak_50_day');
  assert.equal(streak.daysRemaining, 8);
  assert.equal(streak.progressRatio, 0.6);
  assert.equal(streak.achievements.find(item => item.id === 'streak_3_day')?.unlockedAt, at('2026-07-03', 0));
});

test('historical recalculation preserves already earned streak tiers after a later break', () => {
  const first = completedScheduledRange('2026-01-01', 7);
  const sessions = [
    ...first.sessions,
    session('2026-01-08', { status: 'missed', completedActivityId: undefined }),
    session('2026-01-09'),
    session('2026-01-10'),
  ];
  const activities = [
    ...first.activities,
    activity('2026-01-09'),
    activity('2026-01-10'),
  ];
  const streak = calculateStreakAchievements(activities, { now: at('2026-01-10'), scheduledSessions: sessions });
  assert.equal(streak.currentStreakDays, 2);
  assert.equal(streak.achievements.find(item => item.id === 'streak_1_week')?.complete, true);
  assert.equal(streak.achievements.find(item => item.id === 'streak_30_day')?.complete, false);
});

test('hub exposes streak progress, share eligibility, and correct artwork mappings', () => {
  const range = completedScheduledRange('2026-02-01', 3);
  const hub = buildAchievementHubModel(range.activities, [], { now: range.now, scheduledSessions: range.sessions });
  assert.equal(hub.streak.currentTier?.id, 'streak_3_day');
  assert.ok(hub.shareable.some(item => item.id === 'streak_3_day'));
  assert.ok(!hub.shareable.some(item => item.id === 'streak_1_week'));
  assert.ok(BUILD57_ACHIEVEMENT_DEFINITIONS.some(item => item.id === 'streak_6_month' && item.category === 'streak'));

  const manifest = JSON.parse(readFileSync('assets/achievements/streak/manifest.json', 'utf8')) as Array<Record<string, unknown>>;
  assert.equal(manifest.length, 7);
  assert.deepEqual(manifest.map(item => item.achievementId), STREAK_ACHIEVEMENTS.map(item => item.id));
  assert.ok(manifest.every(item => typeof item.artworkPath === 'string' && typeof item.lockedArtworkPath === 'string'));
  assert.ok(readFileSync('src/components/achievements/AchievementShareCard.tsx', 'utf8').includes('StreakAchievementShareCard'));
  assert.ok(readFileSync('src/components/achievements/AchievementShareCard.tsx', 'utf8').includes('photo_overlay'));
  assert.ok(readFileSync('src/store/achievementStore.ts', 'utf8').includes('filter(item => !existing.has'));
});
