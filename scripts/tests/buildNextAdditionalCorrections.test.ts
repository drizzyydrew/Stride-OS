import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  US_AQI_BANDS,
  aqiVoiceOverLabel,
  getAqiBand,
  getAqiScalePosition,
} from '../../src/utils/aqi';
import { calculateActivityLoad } from '../../src/utils/activityLoad';
import { deleteActivityAndRecalculate } from '../../src/utils/activityDeletion';
import {
  NORWEGIAN_4X4_TEMPLATE,
  isEligibleForNorwegian4x4,
} from '../../src/utils/advancedIntervals';
import {
  activeScheduledSessionsForDate,
  dedupePrimarySessions,
  getScheduledRunForDate,
  getScheduledStrengthForDate,
  getSessionById,
  type ScheduledSession,
} from '../../src/utils/scheduledSessions';
import type { Activity } from '../../src/types/activity';

const read = (path: string) => readFileSync(path, 'utf8');

function baseSession(overrides: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    scheduledSessionId: 'session-run',
    date: '2026-07-20',
    originalDate: '2026-07-20',
    activityType: 'run_walk',
    subtype: 'run_walk',
    title: 'Run/Walk Intervals',
    purpose: 'Build aerobic consistency.',
    priority: 'primary',
    durationMinutes: 28,
    target: '28 min - 90 sec run / 90 sec walk',
    status: 'today',
    ...overrides,
  };
}

function activity(id: string, wholeBody: number, scheduledSessionId?: string, routeId?: string): Activity {
  return {
    id,
    activityType: 'running',
    source: 'tracked',
    status: 'completed',
    scheduled: Boolean(scheduledSessionId),
    scheduledSessionId,
    startTime: Date.parse('2026-07-20T08:00:00'),
    endTime: Date.parse('2026-07-20T08:30:00'),
    rpe: 5,
    indoor: false,
    metrics: { durationSeconds: 1800, routeId },
    trainingLoad: {
      ...calculateActivityLoad({ activityType: 'running', durationMinutes: 30, rpe: 5 }),
      wholeBody,
      running: wholeBody,
      impactBearing: wholeBody,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

test('bottom tab labels and icons use one uniform visual contract', () => {
  const tabs = read('app/(tabs)/_layout.tsx');
  const visibleSection = tabs.slice(tabs.indexOf('<Tabs.Screen'), tabs.indexOf('<Tabs.Screen name="index"'));

  assert.equal((visibleSection.match(/<Tabs\.Screen/g) ?? []).length, 6);
  assert.match(tabs, /TAB_ICON_SIZE\s*=\s*25/);
  assert.match(tabs, /TAB_LABEL_FONT_SIZE\s*=\s*10/);
  assert.match(tabs, /TAB_LABEL_LINE_HEIGHT\s*=\s*12/);
  assert.match(tabs, /fontWeight:\s*'700'/);
  assert.match(tabs, /includeFontPadding:\s*false/);
  assert.match(tabs, /minimumFontScale=\{0\.85\}/);
  assert.match(tabs, /minWidth:\s*0/);
});

test('Today weather card separates information and refresh controls and expands AQI education', () => {
  const today = read('app/(tabs)/dashboard/index.tsx');

  assert.match(today, /accessibilityLabel="Refresh weather"/);
  assert.match(today, /accessibilityLabel="Weather and AQI information"/);
  assert.match(today, /style=\{\[styles\.weatherAction/);
  assert.match(today, /style=\{styles\.weatherInfoRow\}/);
  assert.match(today, /US_AQI_BANDS\.map/);
  assert.match(today, /Current AQI/);
  assert.doesNotMatch(today, /AQI scale legend/i);
});

test('AQI ranges match official U.S. categories and expose non-color VoiceOver labels', () => {
  assert.deepEqual(
    US_AQI_BANDS.map(band => [band.min, band.max, band.category]),
    [
      [0, 50, 'Good'],
      [51, 100, 'Moderate'],
      [101, 150, 'Unhealthy for Sensitive Groups'],
      [151, 200, 'Unhealthy'],
      [201, 300, 'Very Unhealthy'],
      [301, 500, 'Hazardous'],
    ],
  );
  assert.equal(getAqiBand(125).category, 'Unhealthy for Sensitive Groups');
  assert.equal(getAqiBand(250).category, 'Very Unhealthy');
  assert.equal(getAqiScalePosition(250), 0.5);
  assert.match(aqiVoiceOverLabel(175), /AQI 175, Unhealthy, range 151 to 200/);
});

test('Today plan renders one centered primary action and no redundant adjacent Strength button', () => {
  const today = read('app/(tabs)/dashboard/index.tsx');
  assert.match(today, /actionLabelForScheduledSession\(primarySession\)/);
  assert.match(today, /styles\.workoutBtnPrimary/);
  assert.doesNotMatch(today, /hasStrengthToday/);
  assert.doesNotMatch(today, />Strength<\/Text>/);
});

test('Calendar selection projects one scheduled-session ID into Today and active workout resolvers without deleting plan data', () => {
  const todayRun = baseSession();
  const todayStrength = baseSession({
    scheduledSessionId: 'session-strength',
    activityType: 'strength',
    subtype: 'foundation_strength',
    title: 'Runner Foundation Strength A',
    purpose: 'Support running.',
    priority: 'supporting',
    durationMinutes: 30,
    target: '30 min - 5 exercises',
  });
  const futureRun = baseSession({
    scheduledSessionId: 'future-run',
    date: '2026-07-23',
    originalDate: '2026-07-23',
    title: 'Easy Aerobic Run',
    activityType: 'run',
    subtype: 'easy_run',
    durationMinutes: 30,
  });

  const selected = activeScheduledSessionsForDate(
    [todayRun, todayStrength],
    [todayRun, todayStrength, futureRun],
    '2026-07-20',
    'future-run',
  );

  assert.equal(selected[0].scheduledSessionId, 'future-run');
  assert.equal(selected[0].date, '2026-07-20');
  assert.equal(selected[0].originalDate, '2026-07-23');
  assert.equal(getSessionById([todayRun, todayStrength, futureRun], 'future-run')?.title, 'Easy Aerobic Run');
  assert.equal(getScheduledRunForDate(selected)?.scheduledSessionId, 'future-run');
  assert.equal(getScheduledStrengthForDate(selected)?.scheduledSessionId, 'session-strength');
});

test('Calendar unselection removes only the active selection, not the planned session', () => {
  const todayRun = baseSession();
  const active = activeScheduledSessionsForDate(
    [todayRun],
    [todayRun],
    '2026-07-20',
    undefined,
    ['session-run'],
  );
  assert.equal(active.length, 0);
  assert.equal(todayRun.scheduledSessionId, 'session-run');
});

test('Running and Strength screens resolve scheduled sessions from the shared hook', () => {
  const running = read('app/(tabs)/training/index.tsx');
  const strength = read('app/(tabs)/strength/index.tsx');

  assert.match(running, /activeScheduled\.activeTodayRun/);
  assert.match(running, /scheduledSessionId:\s*todayPlannedSession\?\.scheduledSessionId/);
  assert.match(strength, /scheduled\.weekSessions/);
  assert.match(strength, /scheduledSessionId/);
});

test('Activity deletion removes only the completed activity and recalculates load', () => {
  const a = activity('a', 100, 'session-run', 'route-a');
  const b = activity('b', 50, undefined, 'route-shared');
  const c = activity('c', 70, undefined, 'route-shared');
  const result = deleteActivityAndRecalculate([a, b, c], 'a');

  assert.equal(result.removed?.id, 'a');
  assert.deepEqual(result.activities.map(item => item.id), ['b', 'c']);
  assert.equal(result.linkedScheduledSessionId, 'session-run');
  assert.equal(result.exclusiveRouteId, 'route-a');
  assert.equal(result.wholeBodyLoad, 120);

  const sharedRouteDeletion = deleteActivityAndRecalculate([b, c], 'b');
  assert.equal(sharedRouteDeletion.exclusiveRouteId, null);
});

test('Activity UI supports swipe and long-press deletion with explicit confirmation', () => {
  const source = read('app/(tabs)/activity/index.tsx');
  assert.match(source, /Swipeable/);
  assert.match(source, /onLongPress=\{\(\) => confirmDeleteActivity/);
  assert.match(source, /Delete this activity\?/);
  assert.match(source, /Delete Activity/);
  assert.match(source, /removeActivity\(activity\.id\)/);
});

test('beginner periodization never keeps two primary running sessions on one day', () => {
  const runWalk = baseSession({ scheduledSessionId: 'run-walk', activityType: 'run_walk', title: 'Run/Walk Intervals' });
  const easyRun = baseSession({ scheduledSessionId: 'easy-run', activityType: 'run', title: 'Easy Aerobic Run' });
  const strength = baseSession({ scheduledSessionId: 'strength', activityType: 'strength', title: 'Runner Foundation Strength A', priority: 'supporting' });

  const deduped = dedupePrimarySessions([runWalk, easyRun, strength]);
  assert.deepEqual(deduped.map(session => session.scheduledSessionId), ['run-walk', 'strength']);
});

test('Norwegian 4x4 template is advanced-only and not automatically assigned during beginner foundation', () => {
  assert.equal(NORWEGIAN_4X4_TEMPLATE.automaticSchedulingEnabled, false);
  assert.equal(NORWEGIAN_4X4_TEMPLATE.workIntervals, 4);
  assert.equal(NORWEGIAN_4X4_TEMPLATE.workDurationMinutes, 4);
  assert.equal(NORWEGIAN_4X4_TEMPLATE.recoveryDurationMinutes, 3);
  assert.equal(
    isEligibleForNorwegian4x4({
      progressionLevel: 'beginner',
      trainingPhase: 'foundation',
      recentConsistentWeeks: 20,
      weeklyRunningMinutes: 300,
      toleratedLowerIntensityIntervals: true,
      hasNearbyHardSession: false,
      readinessScore: 90,
      hasCurrentSymptoms: false,
      beginnerFoundationPlanActive: true,
      featureFlagEnabled: true,
    }),
    false,
  );
  assert.equal(
    isEligibleForNorwegian4x4({
      progressionLevel: 'advanced',
      trainingPhase: 'build',
      recentConsistentWeeks: 10,
      weeklyRunningMinutes: 220,
      toleratedLowerIntensityIntervals: true,
      hasNearbyHardSession: false,
      readinessScore: 82,
      hasCurrentSymptoms: false,
      beginnerFoundationPlanActive: false,
      featureFlagEnabled: true,
    }),
    true,
  );
});
