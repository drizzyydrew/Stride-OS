import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';

import {
  BUILD57_ACHIEVEMENT_DEFINITIONS,
  STREAK_ACHIEVEMENTS,
  buildAchievementHubModel,
  calculateStreakAchievements,
} from '../../src/utils/achievements';
import {
  STREAK_HEAT_COLORS,
} from '../../src/achievements/streaks/streakTokens';
import {
  STREAK_MILESTONE_DEFINITIONS,
  streakHeatTierForDays,
} from '../../src/achievements/streaks/streakDefinitions';
import { renderStreakBadgeSvg } from '../../src/achievements/streaks/streakArtwork';
import {
  buildCurrentStreakSummary,
  streakAchievementAccessibilityLabel,
} from '../../src/achievements/streaks/streakUtils';
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

test('streak family uses the approved specialty ladder and boundary thresholds', () => {
  assert.deepEqual(STREAK_ACHIEVEMENTS.map(item => item.badgeText), ['7', '30', '50', '75', '100', '150', '200', '250', '300', '365']);
  assert.deepEqual(STREAK_ACHIEVEMENTS.map(item => item.displayName), [
    '7-Day Streak',
    '30-Day Streak',
    '50-Day Streak',
    '75-Day Streak',
    '100-Day Streak',
    '150-Day Streak',
    '200-Day Streak',
    '250-Day Streak',
    '300-Day Streak',
    '365-Day Streak',
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

test('streak heat tiers map days to the approved color ranges', () => {
  assert.deepEqual(
    [1, 10, 11, 50, 51, 100, 101, 150, 151, 200, 201, 250, 251, 300, 301, 364, 365, 428]
      .map(day => streakHeatTierForDays(day).token),
    [
      'streakHeatGreen',
      'streakHeatGreen',
      'streakHeatYellow',
      'streakHeatYellow',
      'streakHeatOrange',
      'streakHeatOrange',
      'streakHeatRedOrange',
      'streakHeatRedOrange',
      'streakHeatHotPink',
      'streakHeatHotPink',
      'streakHeatViolet',
      'streakHeatViolet',
      'streakHeatBlue',
      'streakHeatBlue',
      'streakHeatBlueWhite',
      'streakHeatBlueWhite',
      'streakHeatWhiteHot',
      'streakHeatWhiteHot',
    ],
  );
});

test('specialty milestones inherit heat range colors', () => {
  assert.deepEqual(
    STREAK_MILESTONE_DEFINITIONS.map(item => [item.thresholdDays, item.heatToken]),
    [
      [7, 'streakHeatGreen'],
      [30, 'streakHeatYellow'],
      [50, 'streakHeatYellow'],
      [75, 'streakHeatOrange'],
      [100, 'streakHeatOrange'],
      [150, 'streakHeatRedOrange'],
      [200, 'streakHeatHotPink'],
      [250, 'streakHeatViolet'],
      [300, 'streakHeatBlue'],
      [365, 'streakHeatWhiteHot'],
    ],
  );
});

test('any completed workout day of at least five minutes counts toward streaks', () => {
  const activities = [
    activity('2026-08-03', { activityType: 'running', metrics: { durationSeconds: 300 } }),
    activity('2026-08-04', { activityType: 'walking', metrics: { durationSeconds: 600 } }),
    activity('2026-08-05', { activityType: 'strength', metrics: { durationSeconds: 1200 } }),
    activity('2026-08-06', { activityType: 'mobility', metrics: { durationSeconds: 900 } }),
    activity('2026-08-07', { activityType: 'cycling', metrics: { durationSeconds: 1800 } }),
  ];

  const streak = calculateStreakAchievements(activities, { now: at('2026-08-07') });
  assert.equal(streak.currentStreakDays, 5);
  assert.equal(streak.currentTier, null);
  assert.equal(streak.nextMilestone?.id, 'streak_1_week');
});

test('empty days break the current streak while later workout days rebuild', () => {
  const activities = [
    activity('2026-08-03'),
    activity('2026-08-04'),
    activity('2026-08-06'),
    activity('2026-08-07'),
  ];
  const streak = calculateStreakAchievements(activities, { now: at('2026-08-07') });
  assert.equal(streak.currentStreakDays, 2);
  assert.equal(streak.currentTier, null);
  assert.equal(streak.achievements.find(item => item.id === 'streak_1_week')?.state, 'locked');
});

test('sub-five-minute workouts do not continue streaks', () => {
  const activities = [
    activity('2026-08-03'),
    activity('2026-08-04', { metrics: { durationSeconds: 299 } }),
    activity('2026-08-05'),
  ];
  const streak = calculateStreakAchievements(activities, { now: at('2026-08-05') });
  assert.equal(streak.currentStreakDays, 1);
  assert.equal(streak.currentTier, null);
});

test('next milestone progress and earned dates use exact crossing dates', () => {
  const range = completedScheduledRange('2026-07-01', 42);
  const streak = calculateStreakAchievements(range.activities, { now: range.now, scheduledSessions: range.sessions });
  assert.equal(streak.currentStreakDays, 42);
  assert.equal(streak.currentTier?.id, 'streak_30_day');
  assert.equal(streak.nextMilestone?.id, 'streak_50_day');
  assert.equal(streak.daysRemaining, 8);
  assert.equal(streak.progressRatio, 0.6);
  assert.equal(streak.achievements.find(item => item.id === 'streak_1_week')?.unlockedAt, at('2026-07-07', 0));
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

test('streak milestones unlock once and current streak continues past 365', () => {
  const range = completedScheduledRange('2026-01-01', 428);
  const existing = [{ id: 'streak_100_day', achievedAt: at('2026-04-10') }];
  const streak = calculateStreakAchievements(range.activities, { now: range.now, scheduledSessions: range.sessions }, existing);
  assert.equal(streak.currentStreakDays, 428);
  assert.equal(streak.currentTier?.id, 'streak_365_day');
  assert.equal(streak.nextMilestone, null);
  assert.equal(streak.daysRemaining, 0);
  assert.equal(streak.achievements.find(item => item.id === 'streak_100_day')?.unlockedAt, at('2026-04-10', 0));
  assert.equal(streakHeatTierForDays(428).token, 'streakHeatWhiteHot');
});

test('streak current widget math never goes negative', () => {
  const below = buildCurrentStreakSummary(142);
  assert.equal(below.nextMilestone?.thresholdDays, 150);
  assert.equal(below.daysRemaining, 8);
  assert.equal(Math.round(below.progressRatio * 100), 84);
  assert.equal(below.accessibilityLabel, 'Current streak, 142 days. Inferno heat tier. 8 days until 150-day milestone.');

  const beyond = buildCurrentStreakSummary(428);
  assert.equal(beyond.nextMilestone, null);
  assert.equal(beyond.daysRemaining, 0);
  assert.equal(beyond.progressRatio, 1);
});

test('streak renderer states preserve alpha, locked hue removal, and opaque parity', () => {
  const definition = STREAK_MILESTONE_DEFINITIONS.find(item => item.thresholdDays === 150)!;
  const transparent = PNG.sync.read(readFileSync(path.resolve(process.cwd(), definition.shareTransparentPngPath)));
  assert.equal(transparent.data[3], 0);
  assert.equal(transparent.data[(transparent.width * 512 + 256) * 4 + 3], 0);

  const transparentSvg = renderStreakBadgeSvg(150, 'share-transparent');
  assert.equal(transparentSvg.includes('fill="transparent" fill-opacity="0"'), true);
  assert.equal(renderStreakBadgeSvg(150, 'share-opaque'), renderStreakBadgeSvg(150, 'unlocked'));

  const lockedSvg = renderStreakBadgeSvg(150, 'locked').toLowerCase();
  const neutral = new Set(['#8e9294', '#d0d2d2', '#444748', '#74787a', '#e8eaea', '#ffffff', '#f4f5f2', '#d7e5ea']);
  const tierHexes = Object.values(STREAK_HEAT_COLORS)
    .flatMap(colors => Object.values(colors).map(value => value.toLowerCase()))
    .filter(hex => !neutral.has(hex));
  for (const hex of tierHexes) assert.equal(lockedSvg.includes(hex), false, `locked streak SVG contains tier hue ${hex}`);
});

test('streak accessibility labels describe state without relying on color', () => {
  assert.equal(streakAchievementAccessibilityLabel(100, 'earned'), '100-day streak achievement. Unlocked.');
  assert.equal(streakAchievementAccessibilityLabel(150, 'locked', 8), '150-day streak achievement. Locked. 8 days remaining.');
  assert.equal(streakAchievementAccessibilityLabel(365, 'earned', 0, 'One Year'), '365-day streak achievement. One Year. Unlocked.');
});

test('hub exposes streak progress, share eligibility, and correct artwork mappings', () => {
  const range = completedScheduledRange('2026-02-01', 7);
  const hub = buildAchievementHubModel(range.activities, [], { now: range.now, scheduledSessions: range.sessions });
  assert.equal(hub.streak.currentTier?.id, 'streak_1_week');
  assert.ok(hub.shareable.some(item => item.id === 'streak_1_week'));
  assert.ok(!hub.shareable.some(item => item.id === 'streak_30_day'));
  assert.ok(BUILD57_ACHIEVEMENT_DEFINITIONS.some(item => item.id === 'streak_365_day' && item.category === 'streak'));

  const manifest = JSON.parse(readFileSync('assets/achievements/streaks/manifest.json', 'utf8')) as Array<Record<string, unknown>>;
  assert.equal(manifest.length, 10);
  assert.deepEqual(manifest.map(item => item.achievementId), STREAK_ACHIEVEMENTS.map(item => item.id));
  assert.ok(manifest.every(item => typeof item.artworkPath === 'string' && typeof item.lockedArtworkPath === 'string'));
  assert.ok(readFileSync('src/components/achievements/AchievementShareCard.tsx', 'utf8').includes('StreakAchievementShareCard'));
  assert.ok(readFileSync('src/components/achievements/AchievementShareCard.tsx', 'utf8').includes('photo_overlay'));
  assert.ok(readFileSync('src/store/achievementStore.ts', 'utf8').includes('filter(item => !existing.has'));
});
