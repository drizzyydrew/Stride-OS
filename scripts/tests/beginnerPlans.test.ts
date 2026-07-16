import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BeginnerPlanReadinessInput } from '../../src/types/beginnerPlan';
import type { TrainingPreferences } from '../../src/types/trainingPreferences';
import {
  generateBeginnerPlan,
  integrateCrossTrainingIntoWeek,
  recommendBeginnerPlanDuration,
  requiresAcceleratedAcknowledgment,
} from '../../src/utils/beginnerPlans';
import { DEFAULT_TRAINING_PREFERENCES } from '../../src/utils/trainingPreferences';

function input(overrides: Partial<BeginnerPlanReadinessInput> = {}): BeginnerPlanReadinessInput {
  return {
    goal: 'couch_to_5k',
    startingLevel: 'inactive',
    continuousWalkMinutes: 20,
    continuousRunMinutes: 0,
    recentConsistentWeeks: 0,
    availableDaysPerWeek: 4,
    hasCurrentSymptoms: false,
    readinessScore: 70,
    crossTrainingExperience: false,
    startDate: '2026-07-20',
    ...overrides,
  };
}

test('minimum duration adapts to current capacity, consistency, symptoms, and availability', () => {
  const baseline = recommendBeginnerPlanDuration(input());
  const experienced = recommendBeginnerPlanDuration(input({
    startingLevel: 'running',
    continuousWalkMinutes: 60,
    continuousRunMinutes: 40,
    recentConsistentWeeks: 16,
  }));
  const constrained = recommendBeginnerPlanDuration(input({
    goal: 'couch_to_half_marathon',
    availableDaysPerWeek: 2,
    hasCurrentSymptoms: true,
    readinessScore: 40,
  }));
  assert.ok(baseline.recommendedWeeks >= 10);
  assert.ok(experienced.recommendedWeeks < baseline.recommendedWeeks);
  assert.ok(constrained.recommendedWeeks > 26);
  assert.ok(constrained.progressionRequirements.some(item => item.includes('clinical guidance')));
});

test('accelerated target requires explicit acknowledgment and retains the chosen target', () => {
  const accelerated = input({ requestedTargetDate: '2026-09-07' });
  assert.equal(requiresAcceleratedAcknowledgment(accelerated), true);
  assert.throws(() => generateBeginnerPlan(accelerated, 'run_walk'), /acknowledgment/);
  const plan = generateBeginnerPlan(accelerated, 'run_walk', 123);
  assert.equal(plan.acceleratedAcknowledgedAt, 123);
  assert.equal(plan.durationWeeks, 7);
  assert.equal(plan.targetDate, '2026-09-07');
});

test('preset plans use run/walk, regular recovery weeks, strength support, and no hard intensity', () => {
  const plan = generateBeginnerPlan(input(), 'run_walk');
  assert.ok(plan.weeks[0].sessions.some(session => session.kind === 'run_walk'));
  assert.equal(plan.weeks[3].isRecoveryWeek, true);
  assert.ok(plan.weeks.every(week => week.sessions.some(session => session.kind === 'strength')));
  assert.ok(plan.weeks.flatMap(week => week.sessions).every(session =>
    ['recovery', 'easy', 'moderate'].includes(session.intensity)));
  const firstInterval = plan.weeks[0].sessions.find(session => session.kind === 'run_walk');
  assert.ok((firstInterval?.runSeconds ?? 0) > 0);
  assert.ok((firstInterval?.walkSeconds ?? 0) > 0);
});

test('walking-primary plan remains separate from running pace and accepts future run/walk transition', () => {
  const plan = generateBeginnerPlan(input(), 'walking');
  const endurance = plan.weeks.flatMap(week => week.sessions)
    .filter(session => ['walk', 'run_walk', 'easy_run', 'long_session'].includes(session.kind));
  assert.ok(endurance.length > 0);
  assert.ok(endurance.every(session => session.activityType === 'walking'));
});

test('disabled cross-training preserves generated programming exactly', () => {
  const plan = generateBeginnerPlan(input(), 'run_walk');
  const week = plan.weeks[0];
  assert.equal(
    integrateCrossTrainingIntoWeek(week, DEFAULT_TRAINING_PREFERENCES, 7, 80),
    week,
  );
});

test('enabled cross-training supports seasonal substitution and supplementation', () => {
  const plan = generateBeginnerPlan(input(), 'run_walk');
  const preferences: TrainingPreferences = {
    ...DEFAULT_TRAINING_PREFERENCES,
    crossTrainingDecision: 'yes',
    crossTrainingFrequencyPerWeek: 2,
    crossTrainingPurpose: ['lower_impact_substitute', 'variety'],
    crossTrainingActivities: [
      {
        activityType: 'cross_country_skiing',
        preferredDays: [0],
        equipment: ['skis'],
        setting: 'outdoor',
        typicalDurationMinutes: 60,
        experienceLevel: 'experienced',
        use: 'replace_easy_aerobic',
        seasonalMonths: [1, 2],
      },
      {
        activityType: 'swimming',
        preferredDays: [5],
        equipment: ['pool'],
        setting: 'indoor',
        typicalDurationMinutes: 40,
        experienceLevel: 'some_experience',
        use: 'additional_training',
      },
    ],
  };
  const july = integrateCrossTrainingIntoWeek(plan.weeks[0], preferences, 7, 80);
  assert.equal(july.sessions.some(session => session.activityType === 'cross_country_skiing'), false);
  assert.equal(july.sessions.some(session => session.activityType === 'swimming'), true);

  const january = integrateCrossTrainingIntoWeek(plan.weeks[0], preferences, 1, 45);
  const ski = january.sessions.find(session => session.activityType === 'cross_country_skiing');
  assert.ok(ski?.replacesSessionId);
  assert.match(ski?.explanation ?? '', /not running mileage/);
});

test('beginner plans treat frequency as sessions rather than unique activity types', () => {
  const plan = generateBeginnerPlan(input(), 'run_walk');
  const preferences: TrainingPreferences = {
    ...DEFAULT_TRAINING_PREFERENCES,
    crossTrainingDecision: 'yes',
    crossTrainingFrequencyPerWeek: 4,
    crossTrainingActivities: [{
      activityType: 'cycling',
      preferredDays: [0, 2, 4, 6],
      equipment: ['bike'],
      setting: 'either',
      typicalDurationMinutes: 35,
      experienceLevel: 'some_experience',
      use: 'either',
    }],
  };
  const result = integrateCrossTrainingIntoWeek(plan.weeks[0], preferences, 7, 80);
  const crossTraining = result.sessions.filter(session => session.kind === 'cross_training');
  // Five existing sessions leave room for three cross-training integrations:
  // one replacement plus two supplements. The fourth request is safely held
  // rather than stacking two sessions on the same day.
  assert.equal(crossTraining.length, 3);
  assert.equal(new Set(crossTraining.map(session => session.id)).size, 3);
  assert.equal(new Set(result.sessions.map(session => session.dayIndex)).size, result.sessions.length);
});
