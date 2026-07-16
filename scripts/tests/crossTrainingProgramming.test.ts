import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { RichWeek, RichWorkout } from '../../src/types/workout';
import type { TrainingPreferences } from '../../src/types/trainingPreferences';
import { applyCrossTrainingPreferencesToWeek } from '../../src/utils/crossTrainingProgramming';
import { DEFAULT_TRAINING_PREFERENCES } from '../../src/utils/trainingPreferences';

function workout(dayIndex: number, richType: RichWorkout['richType']): RichWorkout {
  return {
    id: `${richType}_${dayIndex}`,
    title: richType,
    description: richType,
    type: richType === 'rest' ? 'rest' : richType,
    zone: richType === 'rest' ? 'recovery' : 'easy',
    durationMinutes: 40,
    energySystem: 'aerobic_power',
    recoveryCost: 10,
    fatigueScore: 10,
    completed: false,
    intensity: richType === 'rest' ? 'rest' : 'easy',
    paceGuidance: { label: 'Easy', description: 'Easy', targetPace: 'Easy' },
    richType,
    dayIndex,
    paceRange: { minSecPerMi: 720, maxSecPerMi: 600 },
    hrZoneTarget: 2,
    rpeRange: [3, 4],
    warmup: {
      label: 'Warmup', duration: '5 min', paceGuide: 'Easy',
      hrZone: 1, rpe: [1, 2], instructions: 'Warm up',
    },
    mainSet: [{
      label: 'Main', duration: '30 min', paceGuide: 'Easy',
      hrZone: 2, rpe: [3, 4], instructions: 'Easy',
    }],
    cooldown: {
      label: 'Cooldown', duration: '5 min', paceGuide: 'Easy',
      hrZone: 1, rpe: [1, 2], instructions: 'Cool down',
    },
    purpose: 'Build aerobic fitness.',
    instructions: ['Run easy.'],
    executionCues: ['Easy.'],
    failureConditions: ['Stop for concerning symptoms.'],
    modifications: [],
    rationale: {
      adaptation: 'Aerobic',
      mechanism: 'Controlled aerobic work.',
      timeframe: 'Weeks',
      scienceBasis: 'Progressive training',
    },
    score: {
      intendedLoad: 30,
      estimatedFatigueCost: 10,
      expectedAdaptation: 20,
      recoveryDemandHours: 24,
      confidenceScore: 80,
      executionDifficulty: 20,
    },
  };
}

function week(): RichWeek {
  return {
    workouts: [
      workout(1, 'easy_run'),
      workout(3, 'threshold'),
      workout(5, 'easy_run'),
      workout(6, 'long_run'),
    ],
    weekScore: {
      totalIntendedLoad: 120,
      intendedFatigueDelta: 10,
      intensityBalance: { easy: 0.75, moderate: 0, hard: 0.25 },
      expectedAdaptations: ['Aerobic'],
    },
    progressionNote: 'Build week.',
    phaseRationale: 'Progressive aerobic work.',
    generatedAt: 1,
  };
}

function preferences(
  use: 'replace_easy_aerobic' | 'additional_training',
  activityType: 'cycling' | 'hiit' = 'cycling',
): TrainingPreferences {
  return {
    ...DEFAULT_TRAINING_PREFERENCES,
    crossTrainingDecision: 'yes',
    crossTrainingFrequencyPerWeek: 1,
    crossTrainingActivities: [{
      activityType,
      preferredDays: [0],
      equipment: [],
      setting: 'either',
      typicalDurationMinutes: 45,
      experienceLevel: 'some_experience',
      use,
    }],
  };
}

test('disabled cross-training preserves the existing generated week object', () => {
  const original = week();
  assert.equal(
    applyCrossTrainingPreferencesToWeek(original, DEFAULT_TRAINING_PREFERENCES, {
      month: 7,
      readinessScore: 80,
    }),
    original,
  );
});

test('lower-impact cross-training can replace easy aerobic work without adding running distance', () => {
  const result = applyCrossTrainingPreferencesToWeek(
    week(),
    preferences('replace_easy_aerobic'),
    { month: 7, readinessScore: 70 },
  );
  const cycling = result.workouts.find(item => item.richType === 'cross_training');
  assert.ok(cycling);
  assert.equal(cycling?.targetDistance, undefined);
  assert.match(cycling?.purpose ?? '', /replaces an easy aerobic session/i);
  assert.match(result.progressionNote, /does not add running mileage/);
});

test('additional aerobic work supplements while HIIT replaces instead of stacking intensity', () => {
  const supplement = applyCrossTrainingPreferencesToWeek(
    week(),
    preferences('additional_training'),
    { month: 7, readinessScore: 80 },
  );
  assert.equal(supplement.workouts.length, 5);
  assert.ok(supplement.workouts.find(item => item.richType === 'cross_training')?.progressionNote
    ?.includes('supplements'));

  const hiit = applyCrossTrainingPreferencesToWeek(
    week(),
    preferences('additional_training', 'hiit'),
    { month: 7, readinessScore: 80 },
  );
  assert.equal(hiit.workouts.length, 4);
  assert.match(
    hiit.workouts.find(item => item.richType === 'cross_training')?.purpose ?? '',
    /replaces an easy aerobic session/i,
  );
});

test('frequency can repeat one preferred activity without duplicate session IDs', () => {
  const repeated = preferences('replace_easy_aerobic');
  repeated.crossTrainingFrequencyPerWeek = 4;
  const result = applyCrossTrainingPreferencesToWeek(
    week(),
    repeated,
    { month: 7, readinessScore: 80 },
  );
  const crossTraining = result.workouts.filter(item => item.richType === 'cross_training');
  assert.equal(crossTraining.length, 4);
  assert.equal(new Set(crossTraining.map(item => item.id)).size, 4);
  assert.equal(new Set(crossTraining.map(item => item.dayIndex)).size, 4);
});
