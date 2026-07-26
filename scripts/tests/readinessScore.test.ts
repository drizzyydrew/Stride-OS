import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateReadiness,
  normalizeSleepMinutes,
  readinessLabel,
  sleepDurationContribution,
  sleepBaseline,
  STARTER_SLEEP_BASELINE_MINUTES,
  READINESS_WEIGHTS,
  readinessChoiceContribution,
} from '../../src/utils/readinessScore';
import { migrateReadinessState } from '../../src/utils/readinessMigration';
import type { DailyReadiness, ReadinessInputs } from '../../src/types/readiness';

const steady: ReadinessInputs = {
  sleepHours: 7,
  sleepMinutes: 30,
  sleepQuality: 4,
  bodyStatus: 4,
  energy: 4,
  stress: 4,
};

test('readiness labels hold their plain-language boundaries', () => {
  assert.equal(readinessLabel(80), 'Ready to Train');
  assert.equal(readinessLabel(79), 'Mostly Ready');
  assert.equal(readinessLabel(65), 'Mostly Ready');
  assert.equal(readinessLabel(64), 'Take It Easier Today');
  assert.equal(readinessLabel(45), 'Take It Easier Today');
  assert.equal(readinessLabel(44), 'Recovery Recommended');
});

test('sleep conversion rejects negative split fields and remains finite', () => {
  assert.equal(normalizeSleepMinutes(7, 30), 450);
  assert.equal(normalizeSleepMinutes(-7, -30), 0);
  assert.equal(normalizeSleepMinutes(Number.NaN, Infinity), 0);
  assert.equal(normalizeSleepMinutes(14, 59), 899);
  assert.equal(normalizeSleepMinutes(99, 0), 899);
});

test('sleep duration contribution interpolates through conservative reference points', () => {
  assert.equal(sleepDurationContribution(3 * 60), 10);
  assert.equal(sleepDurationContribution(5 * 60), 25);
  assert.equal(sleepDurationContribution(6 * 60), 45);
  assert.equal(sleepDurationContribution(7 * 60), 65);
  assert.equal(sleepDurationContribution(8 * 60), 95);
  assert.equal(sleepDurationContribution(8 * 60 + 30), 100);
  assert.equal(sleepDurationContribution(10 * 60 + 30), 85);
  assert.equal(sleepDurationContribution(Number.NaN), 0);
});

test('subjective word choices map internally to 20 point increments', () => {
  assert.equal(readinessChoiceContribution(1), 20);
  assert.equal(readinessChoiceContribution(2), 40);
  assert.equal(readinessChoiceContribution(3), 60);
  assert.equal(readinessChoiceContribution(4), 80);
  assert.equal(readinessChoiceContribution(5), 100);
  assert.equal(readinessChoiceContribution(Number.NaN), 60);
});

test('readiness weights remain centralized around the release contract', () => {
  assert.deepEqual(READINESS_WEIGHTS, {
    sleepDuration: 0.21,
    sleepQuality: 0.14,
    body: 0.18,
    energy: 0.12,
    stress: 0.10,
    trainingRecovery: 0.25,
  });
});

test('28-day sleep baseline uses valid entries and falls back before minimum history', () => {
  const shortHistory = Array.from({ length: 6 }, (_, index) => ({ date: `2026-07-${String(20 + index).padStart(2, '0')}`, sleepMinutesTotal: 480 }));
  assert.deepEqual(sleepBaseline(shortHistory, '2026-07-26'), {
    minutes: STARTER_SLEEP_BASELINE_MINUTES,
    source: 'starter_fallback',
    validEntryCount: 6,
  });
  const history = Array.from({ length: 29 }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    sleepMinutesTotal: index === 0 ? 0 : 480,
  }));
  assert.deepEqual(sleepBaseline(history, '2026-07-29'), {
    minutes: 480,
    source: 'personal_28_day',
    validEntryCount: 28,
  });
});

test('28-day sleep baseline ignores old sparse entries outside the calendar window', () => {
  const oldEntries = Array.from({ length: 12 }, (_, index) => ({
    date: `2026-05-${String(index + 1).padStart(2, '0')}`,
    sleepMinutesTotal: 540,
  }));
  const currentEntries = Array.from({ length: 6 }, (_, index) => ({
    date: `2026-07-${String(20 + index).padStart(2, '0')}`,
    sleepMinutesTotal: 420,
  }));
  assert.deepEqual(sleepBaseline([...oldEntries, ...currentEntries], '2026-07-26'), {
    minutes: STARTER_SLEEP_BASELINE_MINUTES,
    source: 'starter_fallback',
    validEntryCount: 6,
  });
});

test('readiness calculation uses the caller local date for the sleep baseline window', () => {
  const boundaryHistory = [
    { date: '2026-06-29', sleepMinutesTotal: 480 },
    ...Array.from({ length: 6 }, (_, index) => ({
      date: `2026-07-${String(20 + index).padStart(2, '0')}`,
      sleepMinutesTotal: 480,
    })),
  ];
  assert.deepEqual(sleepBaseline(boundaryHistory, '2026-07-27'), {
    minutes: STARTER_SLEEP_BASELINE_MINUTES,
    source: 'starter_fallback',
    validEntryCount: 6,
  });

  const result = calculateReadiness(steady, boundaryHistory, { referenceDateKey: '2026-07-26' });
  assert.equal(result.details.baselineSource, 'personal_28_day');
  assert.equal(result.details.baselineSleepMinutes, 480);
  assert.equal(result.details.sleepDataConfidence, 'personalized');
});

test('overlapping subjective signals cap the recommendation conservatively', () => {
  const result = calculateReadiness({ ...steady, sleepQuality: 1, bodyStatus: 1, energy: 1 });
  assert.equal(result.details.overlapPenaltyCap, 16);
  assert.ok(result.score >= 45);
  assert.match(result.details.reasons.join(' '), /not reduced multiple times/);
});

test('finite guards keep malformed input and optional training hooks browser-safe', () => {
  const result = calculateReadiness({
    sleepHours: Number.NaN,
    sleepMinutes: Infinity,
    sleepQuality: Number.NaN,
    bodyStatus: Number.NaN,
    energy: Infinity,
    stress: -Infinity,
    optionalFactor: 'Late flight',
  }, [], { recentTrainingLoad: Infinity, priorDayScore: Number.NaN });
  assert.ok(Number.isFinite(result.score));
  assert.ok(Number.isFinite(result.sleepMinutesTotal));
  assert.ok(result.details.reasons.every(reason => typeof reason === 'string'));
});

test('migration preserves legacy score/answers without inventing sleep quality or duration', () => {
  const migrated = migrateReadinessState({
    todayReadiness: {
      date: '2026-07-26', score: 73, sleepQuality: 4, energy: 4, stress: 2,
      soreness: 2, motivation: 4, trainingWillingness: 4,
    },
    history: [],
  });
  const entry = migrated.todayReadiness as DailyReadiness;
  assert.equal(entry.score, 73);
  assert.equal(entry.schemaVersion, 4);
  assert.equal(entry.sleepMinutesTotal, 0);
  assert.equal(entry.sleepHours, 0);
  assert.equal(entry.sleepQuality, 0);
  assert.equal(entry.legacyInputs?.sleepQuality, 4);
  assert.equal(entry.details.sleepContribution, 0);
  assert.equal(entry.details.reasons[0], 'Legacy check-ins are retained without guessed sleep duration.');
});

test('v3 readiness migration flips the old stress direction for current entries', () => {
  const migrated = migrateReadinessState({
    todayReadiness: {
      ...steady,
      schemaVersion: 3,
      date: '2026-07-26',
      score: 80,
      sleepMinutesTotal: 450,
      stress: 1,
      details: {
        label: 'Ready to Train',
        message: 'old',
        reasons: [],
        baselineSleepMinutes: 420,
        baselineSource: 'starter_fallback',
        sleepContribution: 80,
        differenceFromBaselineMinutes: 30,
        sleepDataConfidence: 'limited_history',
        recentTrainingAdjustment: 0,
        priorDayAdjustment: 0,
      },
    },
    history: [],
  });
  assert.equal(migrated.todayReadiness?.schemaVersion, 4);
  assert.equal(migrated.todayReadiness?.stress, 5);
  assert.equal(migrated.todayReadiness?.details.stressContribution, 100);
});
