import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { lightColors } from '../../src/theme/colors';
import {
  composeDistanceHundredths,
  decomposeDistanceHundredths,
  formatPairedTrackDistance,
  kmToMiles,
  milesToKm,
} from '../../src/utils/units';
import {
  formatPrescriptionWithSets,
  validatePrescriptionForCategory,
} from '../../src/utils/prescriptionFormat';
import { SESSION_TEMPLATES, generateStrengthWeek } from '../../src/utils/strengthEngine';
import { buildPerformanceForecast, buildTrainingOutlook } from '../../src/utils/trainingOutlook';
import { evaluateAchievementAwards, HEALTHY_ACHIEVEMENTS } from '../../src/utils/achievements';
import type { StrengthEngineInput } from '../../src/types/strength';

function luminance(hex: string): number {
  const raw = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(index => parseInt(raw.slice(index, index + 2), 16) / 255);
  const channel = (value: number) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function strengthInput(overrides: Partial<StrengthEngineInput> = {}): StrengthEngineInput {
  return {
    trainingPhase: 'foundation',
    progressionLevel: 'beginner',
    weeklyMileage: 10,
    currentWeek: 1,
    fatigueScore: 30,
    recoveryScore: 80,
    soreness: null,
    injuryRisk: false,
    acwr: 1,
    weeksToRace: 24,
    availableTimeMin: 45,
    strengthHistory: [],
    ...overrides,
  };
}

test('light semantic color tokens meet key WCAG contrast thresholds', () => {
  const light = lightColors;
  const normalPairs = [
    ['textPrimary on background', light.textPrimary, light.backgroundPrimary],
    ['textSecondary on secondary background', light.textSecondary, light.backgroundSecondary],
    ['textMuted on secondary background', light.textMuted, light.backgroundSecondary],
    ['accent on secondary background', light.accentPrimary, light.backgroundSecondary],
    ['warning on secondary background', light.warning, light.backgroundSecondary],
    ['error on secondary background', light.critical, light.backgroundSecondary],
  ] as const;
  for (const [label, foreground, background] of normalPairs) {
    assert.ok(contrast(foreground, background) >= 4.5, label);
  }
  assert.ok(contrast(light.surfaceSelected, light.textMuted) >= 3, 'selected surface boundary contrast');
  assert.ok(contrast(light.textOnAccent, light.accentPrimary) >= 4.5, 'text on accent contrast');
});

test('Today more-options controls expose button and accordion accessibility contracts', () => {
  const source = readFileSync('app/(tabs)/dashboard/index.tsx', 'utf8');
  assert.match(source, /More Options/);
  assert.match(source, /ellipsis-horizontal-circle-outline/);
  assert.match(source, /accessibilityState=\{\{ expanded: moreOptionsOpen \}\}/);
  for (const label of ['Adjust Today', 'Adjust the Plan', 'Get Help']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /optionDisclosureButton/);
  assert.match(source, /accessibilityRole="button"/);
});

test('manual activity logging supports backdating and explicit plan refresh', () => {
  const source = readFileSync('app/(tabs)/activity/manual.tsx', 'utf8');
  assert.match(source, /label="Activity Date"/);
  assert.doesNotMatch(source, /label="Start time"/);
  assert.doesNotMatch(source, /TIME ZONE/);
  assert.match(source, /dateOnlyToLocalTimestamp/);
  assert.match(source, /startTime,/);
  assert.match(source, /Refresh Training Plan/);
  assert.match(source, /manual_refresh/);
});

test('training path copy no longer presents adaptive goal paths as preset plans', () => {
  const source = readFileSync('app/(tabs)/activity/plans.tsx', 'utf8');
  assert.match(source, /TRAINING PATHS/);
  assert.match(source, /Choose a Training Goal/);
  assert.match(source, /Start This Training Path/);
  assert.doesNotMatch(source, /PRESET TRAINING PLANS|Use This Preset Plan|ACTIVE PRESET GOAL PLAN/);
});

test('paired interval units and hundredths distance composition are deterministic', () => {
  assert.equal(formatPairedTrackDistance(200, 'imperial'), '0.12 mi (200 m)');
  assert.equal(formatPairedTrackDistance(400, 'metric'), '400 m (0.25 mi)');
  assert.equal(formatPairedTrackDistance(1000, 'imperial'), '0.62 mi (1 km)');
  assert.equal(composeDistanceHundredths(3, 1, 2), 3.12);
  assert.deepEqual(decomposeDistanceHundredths(3.12), { whole: 3, tenths: 1, hundredths: 2 });
  const miles = 3.12;
  const km = milesToKm(miles);
  assert.ok(km !== null);
  const roundTrip = kmToMiles(km);
  assert.ok(roundTrip !== null);
  assert.ok(Math.abs(roundTrip - miles) < 1e-10);
});

test('Performance Forecast avoids precise dates with limited history and updates after plan changes', () => {
  const limitedOutlook = buildTrainingOutlook({
    activities: [],
    currentWeek: 1,
    trainingPhase: 'foundation',
    focus: 'Aerobic Foundation',
    weeksToRace: 20,
    readinessScore: 78,
    now: Date.parse('2026-07-29T12:00:00Z'),
  });
  const limited = buildPerformanceForecast(limitedOutlook, { weeksToRace: 20, trainingPhase: 'foundation' });
  assert.equal(limited.confidence, 'limited');
  assert.equal(limited.metrics.find(metric => metric.key === 'peak_window')?.state, 'Insufficient History');
  assert.doesNotMatch(limited.metrics.find(metric => metric.key === 'peak_window')?.summary ?? '', /\b[A-Z][a-z]{2}\s+\d{1,2}\b/);

  const changed = buildPerformanceForecast(
    {
      ...limitedOutlook,
      confidence: 'strong',
      dateClaimAllowed: true,
      completedActivities: 20,
      historyWeeks: 8,
      loadState: 'stable',
      status: 'on_track',
    },
    { weeksToRace: 8, trainingPhase: 'build', decisionSnapshot: { decision: 'regress', generatedAt: Date.now(), reason: 'test' } as never },
  );
  assert.equal(changed.metrics.find(metric => metric.key === 'peak_window')?.state, 'Updated After Plan Change');
});

test('Performance Forecast has tappable info controls on Today', () => {
  const dashboard = readFileSync('app/(tabs)/dashboard/index.tsx', 'utf8');
  assert.match(dashboard, /PERFORMANCE FORECAST/);
  assert.match(dashboard, /metricInfoButton/);
  assert.match(dashboard, /accessibilityLabel=\{`About \$\{metric\.label\}`\}/);
  assert.match(dashboard, /contributing data, confidence, and limitations/);
});

test('shoe catalog stores optional local image metadata and exposes replace/remove affordances', () => {
  const store = readFileSync('src/store/gearStore.ts', 'utf8');
  const gear = readFileSync('app/(tabs)/more/gear.tsx', 'utf8');
  assert.match(store, /imageUri\?: string/);
  assert.match(store, /imageSource\?: 'camera' \| 'library' \| 'local'/);
  assert.match(gear, /launchCameraAsync/);
  assert.match(gear, /launchImageLibraryAsync/);
  assert.match(gear, /removeShoeImage/);
  assert.match(gear, /shoeCarousel/);
});

test('Healthy Progress taxonomy is noncompetitive, deduplicated, and supports evidence IDs', () => {
  const titles = HEALTHY_ACHIEVEMENTS.map(item => item.title);
  assert.deepEqual(titles, [
    'Consistency Wins',
    'Long Run Builder',
    'Recovery Master',
    'Smart Progression',
    'Strong Strides',
    'Foundation Builder',
    'Strength Supports Running',
    'Listened to Your Body',
    'Back on Track',
    'Deload Done Right',
    'Balanced Training',
    'Quality Earned',
    'Easy Means Easy',
  ]);
  for (const definition of HEALTHY_ACHIEVEMENTS) {
    assert.doesNotMatch(`${definition.title} ${definition.description}`, /rank|top|percentile|punish|shame|injury prevention/i);
    assert.ok(definition.criteria.length > 12);
  }
  const now = Date.parse('2026-07-29T12:00:00Z');
  const awards = evaluateAchievementAwards([
    {
      id: 'easy',
      startTime: now - 1 * 86_400_000,
      activityType: 'running',
      status: 'completed',
      subtype: 'easy',
      rpe: 3,
      scheduledSessionId: 'session_easy',
      metrics: { durationSeconds: 50 * 60 },
      trainingLoad: { running: 20, walking: 0, crossTraining: 0, strength: 0, wholeBody: 20 },
    },
    {
      id: 'strength',
      startTime: now - 2 * 86_400_000,
      activityType: 'strength',
      status: 'completed',
      metrics: { durationSeconds: 30 * 60 },
      trainingLoad: { running: 0, walking: 0, crossTraining: 0, strength: 20, wholeBody: 20 },
    },
  ] as never, ['easy_means_easy'], now);
  assert.equal(awards.filter(award => award.id === 'easy_means_easy').length, 1);
  assert.equal(awards.find(award => award.id === 'long_run_builder')?.supportingActivityIds[0], 'easy');
  assert.equal(awards.find(award => award.id === 'long_run_builder')?.supportingSessionIds[0], 'session_easy');
});

test('static stretch prescription validation rejects reps, tempo, and load progression', () => {
  const invalid = validatePrescriptionForCategory(
    'static_stretch',
    { kind: 'reps_tempo', repsMin: 10, repsMax: 15, tempo: '3:1:1' },
    { loadTarget: 'Hold at bodyweight', tempo: '3:1:1', exerciseName: 'Half-Kneeling Hip Flexor Stretch' },
  );
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.length >= 3);

  const valid = validatePrescriptionForCategory(
    'static_stretch',
    { kind: 'duration', secondsMin: 30, perSide: true },
    { loadTarget: 'Gentle stretch, no pain', exerciseName: 'Half-Kneeling Hip Flexor Stretch' },
  );
  assert.equal(valid.valid, true);
  assert.equal(formatPrescriptionWithSets(2, { kind: 'duration', secondsMin: 30, perSide: true }), '2 × 30s per side');
});

test('Half-Kneeling Hip Flexor Stretch generates as timed static work in prehab', () => {
  assert.deepEqual(SESSION_TEMPLATES.prehab.repSchemes?.mobility_hip_flexor, { kind: 'duration', secondsMin: 30, perSide: true });
  const week = generateStrengthWeek(strengthInput());
  const hipFlexor = week.sessions.flatMap(session => session.exercises).find(exercise => exercise.exerciseId === 'mobility_hip_flexor');
  assert.ok(hipFlexor);
  assert.equal(hipFlexor.repScheme?.kind, 'duration');
  assert.equal(hipFlexor.loadTarget, 'Gentle stretch, no pain');
  assert.equal(hipFlexor.tempo, 'Gentle static hold');
});

test('Running active screen uses scroll flow and opens canonical workout details', () => {
  const active = readFileSync('app/(tabs)/training/index.tsx', 'utf8');
  const detail = readFileSync('app/(tabs)/training/workout-detail.tsx', 'utf8');
  assert.match(active, /activeIdleContent/);
  assert.match(active, /View Workout Details/);
  assert.match(active, /scheduledSessionId: todayPlannedSession\?\.scheduledSessionId/);
  assert.match(detail, /useScheduledSessions/);
  assert.match(detail, /scheduledSessionId/);
  assert.match(detail, /session\.runWalk/);
  assert.match(detail, /talk test/);
});
