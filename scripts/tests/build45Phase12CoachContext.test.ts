import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBuild45CoachContextSections } from '../../src/utils/coachBuild45Context';
import { buildBudgetedCoachPrompt, COACH_SYSTEM_HARD_MAX } from '../../src/utils/coachPromptBudget';
import type { Activity } from '../../src/types/activity';
import type { TrainingOutlook } from '../../src/utils/trainingOutlook';

const now = Date.UTC(2026, 6, 26);

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: overrides.id ?? 'a1',
    activityType: overrides.activityType ?? 'running',
    source: 'tracked',
    status: 'completed',
    scheduled: false,
    startTime: overrides.startTime ?? now,
    indoor: false,
    shoeId: overrides.shoeId,
    metrics: { durationSeconds: 1800, distanceMeters: 8046.72, ...overrides.metrics },
    trainingLoad: {
      method: 'estimated',
      wholeBody: 40,
      running: 40,
      walking: 0,
      strength: 0,
      crossTraining: 0,
      impactBearing: 40,
      nonImpactAerobic: 0,
      confidence: 'moderate',
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const outlook: TrainingOutlook = {
  status: 'on_track',
  statusLabel: 'On Track',
  loadState: 'stable',
  loadStateLabel: 'Stable',
  message: 'Current training and recovery signals are generally aligned with the plan.',
  recommendation: 'Follow today’s workout as written unless readiness or real-life constraints change.',
  focus: 'Running Economy',
  confidence: 'moderate',
  historyWeeks: 5,
  completedActivities: 12,
  loadTrend: {
    acute: 100,
    chronic: 90,
    ratio: 1.11,
    dimension: 'wholeBody',
    interpretation: 'workload_trend_only',
  },
  dateClaimAllowed: false,
  generatedAt: now,
};

test('Phase 12 Coach context adds compact optional sections at priority 8 or lower importance', () => {
  const sections = buildBuild45CoachContextSections({
    trainingOutlook: outlook,
    decisionSnapshot: {
      decision: 'maintain',
      phase: 'base',
      focus: 'Running Economy',
      rationale: 'Maintain the plan because adherence and readiness support the current focus without adding load.',
      flags: ['stable_load'],
      confidence: 'moderate',
      updatedAt: now,
    },
    shoes: [{
      id: 'shoe1',
      brand: 'Saucony',
      model: 'Ride',
      addedAt: now,
      active: true,
      reminderThresholdMiles: 4,
    }],
    equipment: [{
      id: 'eq1',
      kind: 'hr_strap',
      name: 'Polar H10',
      active: true,
      addedAt: now,
      blePeripheralId: 'peripheral-1',
    }],
    awardedAchievements: [{ id: 'easy_means_easy', awardedAt: now }],
    activities: [activity({ shoeId: 'shoe1' })],
  });

  assert.equal(sections.length, 4);
  assert.ok(sections.every(section => section.priority >= 8));
  assert.ok(sections.every(section => !section.required));
  assert.ok(sections.every(section => section.compact && section.compact.length < section.content.length));
  assert.match(sections.map(section => section.key).join('\n'), /training outlook/);
  assert.match(sections.map(section => section.key).join('\n'), /weekly decision/);
  assert.match(sections.map(section => section.key).join('\n'), /gear context/);
  assert.match(sections.map(section => section.key).join('\n'), /recent achievements/);
});

test('Phase 12 Coach context stays inside the prompt budget with all new sections present', () => {
  const sections = buildBuild45CoachContextSections({
    trainingOutlook: outlook,
    decisionSnapshot: {
      decision: 'progress',
      phase: 'base',
      focus: 'Aerobic Capacity',
      rationale: 'Progress is allowed because recent training is consistent and readiness is stable. Only one lever should increase.',
      flags: [],
      confidence: 'high',
      updatedAt: now,
    },
    shoes: [{
      id: 'shoe1',
      brand: 'Brooks',
      model: 'Ghost',
      addedAt: now,
      active: true,
      reminderThresholdMiles: 300,
    }],
    equipment: [
      { id: 'eq1', kind: 'treadmill', name: 'Home treadmill', active: true, addedAt: now },
      { id: 'eq2', kind: 'power_meter', name: 'Bike power meter', active: true, addedAt: now },
    ],
    awardedAchievements: [
      { id: 'consistency', awardedAt: now },
      { id: 'balanced_training', awardedAt: now - 1 },
    ],
    activities: [activity({ shoeId: 'shoe1', metrics: { durationSeconds: 3600, distanceMeters: 32186.88 } })],
  });

  const prompt = buildBudgetedCoachPrompt({
    question: 'How should I think about this week?',
    sections: [
      {
        key: 'Coaching role',
        priority: 1,
        required: true,
        content: 'Coach using the real plan, safety rules, and actual athlete data.',
      },
      {
        key: 'Required current workout context',
        priority: 4,
        required: true,
        content: 'Current workout context. '.repeat(250),
        compact: 'Current workout context compact.',
      },
      ...sections,
    ],
  });

  assert.ok(prompt.length <= COACH_SYSTEM_HARD_MAX);
  assert.match(prompt, /BUILD 45 TRAINING OUTLOOK/);
  assert.match(prompt, /BUILD 45 WEEKLY DECISION/);
});

test('Phase 12 gear context is evidence-safe and keeps manual fallback visible', () => {
  const [section] = buildBuild45CoachContextSections({
    shoes: [{
      id: 'shoe1',
      brand: 'Nike',
      model: 'Pegasus',
      addedAt: now,
      active: true,
      reminderThresholdMiles: 2,
    }],
    equipment: [{
      id: 'eq1',
      kind: 'trainer',
      name: 'Indoor trainer',
      active: true,
      addedAt: now,
    }],
    activities: [activity({ shoeId: 'shoe1' })],
  });

  assert.match(section.content, /Consider checking wear/);
  assert.match(section.content, /manual fallback/i);
  assert.doesNotMatch(section.content, /unsafe/i);
});
