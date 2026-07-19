import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { generateBeginnerPlan } from '../../src/utils/beginnerPlans';
import {
  buildRunWalkPrescription,
  dedupePrimarySessions,
  sessionsFromBeginnerPlanForDate,
} from '../../src/utils/scheduledSessions';
import type { BeginnerPlanReadinessInput } from '../../src/types/beginnerPlan';
import { addDays, parseYMD, toYMD } from '../../src/utils/calendarEngine';

function beginnerInput(goal: BeginnerPlanReadinessInput['goal']): BeginnerPlanReadinessInput {
  return {
    goal,
    startingLevel: 'inactive',
    continuousWalkMinutes: 25,
    continuousRunMinutes: 0,
    recentConsistentWeeks: 0,
    availableDaysPerWeek: 4,
    hasCurrentSymptoms: false,
    readinessScore: 76,
    crossTrainingExperience: false,
    startDate: '2026-07-19',
  };
}

function firstScheduledDate(plan: ReturnType<typeof generateBeginnerPlan>): string {
  const firstDayIndex = Math.min(...plan.weeks[0].sessions.map(session => session.dayIndex));
  return toYMD(addDays(parseYMD(plan.startDate), firstDayIndex));
}

test('every preset goal produces dated scheduled sessions with stable scheduled-session IDs', () => {
  for (const goal of ['couch_to_5k', 'couch_to_10k', 'couch_to_half_marathon', 'couch_to_marathon'] as const) {
    const plan = generateBeginnerPlan(beginnerInput(goal), 'run_walk', 123);
    const date = firstScheduledDate(plan);
    const sessions = sessionsFromBeginnerPlanForDate(plan, date, new Date(`${date}T12:00:00`));
    assert.ok(sessions.length > 0, `${goal} should project at least one first-day session`);
    assert.ok(sessions.every(session => session.scheduledSessionId.startsWith(`${plan.id}:`)));
    assert.ok(sessions.every(session => session.date === date));
    assert.ok(sessions.every(session => session.originalDate === date));
  }
});

test('run-walk prescription is exact, executable, and totals from warm-up, rounds, run, walk, and cooldown', () => {
  const plan = generateBeginnerPlan(beginnerInput('couch_to_5k'), 'run_walk', 123);
  const runWalk = plan.weeks[0].sessions.find(session => session.kind === 'run_walk');
  assert.ok(runWalk);
  const prescription = buildRunWalkPrescription(runWalk!);
  assert.ok(prescription);
  assert.equal(prescription!.warmupMinutes, 5);
  assert.equal(prescription!.cooldownMinutes, 5);
  assert.ok(prescription!.runSeconds > 0);
  assert.ok(prescription!.walkSeconds > 0);
  assert.ok(prescription!.rounds >= 3);
  assert.equal(
    prescription!.totalMinutes,
    prescription!.warmupMinutes + prescription!.cooldownMinutes
      + Math.round((prescription!.rounds * (prescription!.runSeconds + prescription!.walkSeconds)) / 60),
  );
  assert.equal(prescription!.hrZone, 'Zone 2 or below');
  assert.equal(prescription!.rpe, '3-4');
  assert.match(prescription!.voicePrompts.join(' '), /Begin running/);
});

test('beginner schedule dedupes duplicate same-day primary endurance sessions', () => {
  const plan = generateBeginnerPlan(beginnerInput('couch_to_5k'), 'run_walk', 123);
  const date = firstScheduledDate(plan);
  const session = sessionsFromBeginnerPlanForDate(plan, date, new Date(`${date}T12:00:00`))[0]!;
  const deduped = dedupePrimarySessions([session, { ...session, scheduledSessionId: `${session.scheduledSessionId}:duplicate` }]);
  assert.equal(deduped.length, 1);
});

test('Today, Calendar, Running, Strength, and AI Coach read the scheduled-session resolver', () => {
  const dashboard = readFileSync('app/(tabs)/dashboard/index.tsx', 'utf8');
  const calendar = readFileSync('app/(tabs)/calendar/index.tsx', 'utf8');
  const running = readFileSync('app/(tabs)/training/index.tsx', 'utf8');
  const strength = readFileSync('app/(tabs)/strength/index.tsx', 'utf8');
  const coach = readFileSync('app/(tabs)/coach/index.tsx', 'utf8');
  const weekPlan = readFileSync('src/utils/trainingEngine.ts', 'utf8');

  assert.match(dashboard, /useScheduledSessions\(weekPlan\)/);
  assert.match(calendar, /useScheduledSessions\(weekPlan\)/);
  assert.match(running, /useScheduledSessions\(weekPlan\)/);
  assert.match(coach, /useScheduledSessions\(weekPlan\)/);
  assert.match(strength, /weekPlan\.calendarMap/);
  assert.match(weekPlan, /calendarEntriesFromScheduledSessions/);
});

test('current local day is never marked missed before the day ends', () => {
  const plan = generateBeginnerPlan(beginnerInput('couch_to_5k'), 'run_walk', 123);
  const date = firstScheduledDate(plan);
  const sessions = sessionsFromBeginnerPlanForDate(plan, date, new Date(`${date}T07:00:00`));
  assert.ok(sessions.length > 0);
  assert.ok(sessions.every(session => session.status === 'today'));
});
