import test from 'node:test';
import assert from 'node:assert/strict';
import { endedGoalDescriptors, type GoalLifecyclePlan } from '../goalLifecycle';
import { buildWeekPlan, type EngineInput } from '../trainingEngine';
import { scheduledSessionsForDate } from '../scheduledSessions';
import { generateBeginnerPlan } from '../beginnerPlans';

const base: GoalLifecyclePlan = {
  goalType: 'race_prep', programStartDate: '2026-08-01', races: [], activePresetGoal: null,
  goalBlockId: null, goalTitle: null, goalEndDate: null,
};
const race = { id: 'race1', name: 'Fall 5K', date: '2026-10-31', distance: '5k' as const, priority: 'A' as const };

test('an event stays active through its local day, archives on the following day', () => {
  const plan = { ...base, races: [race] };
  assert.deepEqual(endedGoalDescriptors(plan, null, 'owner', '2026-10-31'), { descriptors: [], primaryKey: null });
  const ended = endedGoalDescriptors(plan, null, 'owner', '2026-11-01');
  assert.equal(ended.descriptors.length, 1);
  assert.equal(ended.primaryKey, 'race:race1');
  assert.equal(ended.descriptors[0].endDate, '2026-10-31');
  assert.equal(ended.descriptors[0].ownerUserId, 'owner');
});

test('a past tune-up does not retire a future A race, and invalid dates are ignored', () => {
  const plan = { ...base, races: [{ ...race, priority: 'tune_up' as const }, { ...race, id: 'primary', date: '2026-12-01' }, { ...race, id: 'bad', date: '2026-02-30' }] };
  const result = endedGoalDescriptors(plan, null, 'owner', '2026-11-01');
  assert.equal(result.descriptors.length, 1);
  assert.equal(result.primaryKey, null);
});

test('undated legacy general goals do not receive an invented expiration', () => {
  assert.equal(endedGoalDescriptors({ ...base, goalType: 'general_running' }, null, 'owner', '2030-01-01').primaryKey, null);
  const ended = endedGoalDescriptors({ ...base, goalType: 'general_strength', goalBlockId: 'strength', goalTitle: 'Build strength', goalEndDate: '2026-10-31' }, null, 'owner', '2026-11-01');
  assert.equal(ended.primaryKey, 'goal:strength');
  assert.equal(ended.descriptors[0].title, 'Build strength');
});

test('historical events preceding the current program keep an event-day archive without an invented block start', () => {
  const result = endedGoalDescriptors({ ...base, programStartDate: '2026-11-01', races: [race] }, null, 'owner', '2026-11-02');
  assert.equal(result.descriptors[0].startDate, race.date);
  assert.equal(result.descriptors[0].endDate, race.date);
});

test('open mode generates no plan even when a stale beginner prescription is supplied', () => {
  const plan = generateBeginnerPlan({ goal: 'couch_to_5k', startingLevel: 'walking', continuousWalkMinutes: 35, continuousRunMinutes: 0,
    recentConsistentWeeks: 4, availableDaysPerWeek: 4, hasCurrentSymptoms: false, crossTrainingExperience: false, startDate: '2026-10-31' }, 'running');
  // The open branch must not consult irrelevant readiness/profile/engine values.
  const input = { trainingMode: 'open', beforeStart: false, macroWeek: { weekNumber: 1 }, activeBeginnerPlan: plan,
    progressionLevel: 'beginner', weeklyMileage: 10, programStartDate: '2026-10-31' } as EngineInput;
  const week = buildWeekPlan(input);
  assert.equal(week.calendarMap.size, 0);
  assert.equal(week.metadata.trainingMode, 'open');
  assert.equal(week.metadata.startsOn, undefined);
  assert.deepEqual(scheduledSessionsForDate(week, plan, '2026-11-02'), []);
});

test('only the active beginner plan expires; retained older presets do not close a new goal', () => {
  const beginner = { id: 'previous', startDate: '2026-08-01', targetDate: '2026-10-31' } as Parameters<typeof endedGoalDescriptors>[1];
  const plan = { ...base, goalType: 'general_running' as const, goalBlockId: 'next', goalEndDate: '2026-12-01' };
  assert.equal(endedGoalDescriptors(plan, beginner, 'owner', '2026-11-01').primaryKey, null);
  assert.throws(() => endedGoalDescriptors(plan, null, 'owner', '2026-02-30'));
});
