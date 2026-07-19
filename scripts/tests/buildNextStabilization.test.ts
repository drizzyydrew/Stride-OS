import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import { generateBeginnerPlan } from '../../src/utils/beginnerPlans';
import {
  buildRunWalkPrescription,
  calendarEntriesFromScheduledSessions,
  dedupePrimarySessions,
  runWalkMainSetText,
  sessionsFromBeginnerPlanForDate,
} from '../../src/utils/scheduledSessions';
import { formatYMDForDisplay, parseDisplayDateToYMD } from '../../src/utils/dateFormatting';
import { sanitizeCoachDisplayText } from '../../src/utils/coachDisplay';
import { buildWeekPlan } from '../../src/utils/trainingEngine';
import { sundayOf, toYMD } from '../../src/utils/calendarEngine';

test('scheduled-session adapter produces complete executable run/walk prescription', () => {
  const plan = generateBeginnerPlan({
    goal: 'couch_to_5k',
    startingLevel: 'inactive',
    continuousWalkMinutes: 20,
    continuousRunMinutes: 0,
    recentConsistentWeeks: 0,
    availableDaysPerWeek: 4,
    hasCurrentSymptoms: false,
    readinessScore: 70,
    crossTrainingExperience: false,
    startDate: '2026-07-19',
  }, 'run_walk');
  const sessions = sessionsFromBeginnerPlanForDate(plan, '2026-07-20', new Date('2026-07-20T12:00:00'));
  const runWalk = sessions.find(session => session.activityType === 'run_walk');
  assert.ok(runWalk);
  assert.equal(runWalk?.scheduledSessionId.includes(plan.id), true);
  assert.ok(runWalk?.runWalk);
  assert.equal(runWalk?.warmup, '5-minute easy walk');
  assert.match(runWalk?.mainSet ?? '', /rounds:/i);
  assert.match(runWalk?.target ?? '', /sec run/);
  assert.ok(runWalk?.richWorkout?.intervals);
  assert.equal(runWalk?.status, 'today');
});

test('run/walk duration math includes warm-up and cooldown', () => {
  const prescription = buildRunWalkPrescription({
    id: 'rw',
    dayIndex: 1,
    kind: 'run_walk',
    activityType: 'running',
    durationMinutes: 28,
    intensity: 'easy',
    purpose: 'Build consistency.',
    explanation: 'Build consistency.',
    runSeconds: 90,
    walkSeconds: 90,
    repeats: 6,
  });
  assert.equal(prescription?.totalMinutes, 28);
  assert.equal(runWalkMainSetText(prescription!), '6 rounds: 90 seconds running / 90 seconds walking');
});

test('dedupePrimarySessions prevents duplicate primary beginner runs on one day', () => {
  const base = {
    scheduledSessionId: 'a',
    date: '2026-07-18',
    originalDate: '2026-07-18',
    activityType: 'run' as const,
    subtype: 'easy_run',
    title: 'Easy Run',
    purpose: 'Easy',
    priority: 'primary' as const,
    durationMinutes: 30,
    target: 'Zone 2',
    status: 'today' as const,
  };
  const kept = dedupePrimarySessions([
    base,
    { ...base, scheduledSessionId: 'b', activityType: 'run_walk' as const, title: 'Run/Walk' },
    { ...base, scheduledSessionId: 'c', activityType: 'strength' as const, title: 'Strength', priority: 'supporting' as const },
  ]);
  assert.deepEqual(kept.map(session => session.scheduledSessionId), ['a', 'c']);
});

test('Calendar entries inherit session IDs, designation, target, and safe missed timing', () => {
  const plan = generateBeginnerPlan({
    goal: 'couch_to_10k',
    startingLevel: 'walking',
    continuousWalkMinutes: 35,
    continuousRunMinutes: 0,
    recentConsistentWeeks: 2,
    availableDaysPerWeek: 4,
    hasCurrentSymptoms: false,
    readinessScore: 75,
    crossTrainingExperience: false,
    startDate: '2026-07-18',
  }, 'run_walk');
  const entries = calendarEntriesFromScheduledSessions(
    sessionsFromBeginnerPlanForDate(plan, '2026-07-19', new Date(Date.UTC(2026, 6, 19, 12))),
  );
  assert.ok(entries[0].scheduledSessionId);
  assert.equal(entries[0].status, 'today');
  assert.equal(entries[0].missed, false);
  assert.ok(entries[0].target?.includes('sec'));
});

test('active beginner preset plan becomes the week-plan calendar authority', () => {
  const today = new Date();
  const startDate = toYMD(sundayOf(today));
  const plan = generateBeginnerPlan({
    goal: 'couch_to_marathon',
    startingLevel: 'inactive',
    continuousWalkMinutes: 30,
    continuousRunMinutes: 0,
    recentConsistentWeeks: 0,
    availableDaysPerWeek: 4,
    hasCurrentSymptoms: false,
    readinessScore: 72,
    crossTrainingExperience: false,
    startDate,
  }, 'run_walk');
  const firstWeek = plan.weeks[0]!;
  const firstSession = firstWeek.sessions[0]!;
  plan.weeks[0] = {
    ...firstWeek,
    sessions: [{ ...firstSession, dayIndex: 1 }],
  };

  const weekPlan = buildWeekPlan({
    goalRace: 'Marathon',
    weeklyMileage: 0,
    fatigueScore: 30,
    recoveryScore: 80,
    currentWeek: 1,
    trainingPhase: 'foundation',
    progressionLevel: 'beginner',
    goalType: 'general_running',
    macroWeek: {
      weekNumber: 1,
      startDate: toYMD(sundayOf(today)),
      phase: 'foundation',
      isDeload: false,
      isTaper: false,
      isRaceWeek: false,
      focus: 'Build a beginner foundation.',
    },
    beforeStart: false,
    programStartDate: startDate,
    races: [],
    activeBeginnerPlan: plan,
    calibration: null,
    fatigueSensitivity: 1,
    recoveryResponsiveness: 1,
    returningFromInjury: false,
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    runDays: ['Mon', 'Wed', 'Sat'],
    liftDays: ['Tue'],
    trainingStyle: 'base_only',
    primaryGoal: '5k',
    hasCurrentInjury: false,
    strengthLevel: 'beginner',
    soreness: null,
    motivation: null,
    acwr: 1,
    recentIntensityDist: { easy: 0.8, moderate: 0.1, hard: 0.1 },
    recentHardSessions: 0,
    adherenceRate: 1,
    consistencyScore: 70,
    longRunConsistency: 0,
    completedWorkoutKeys: [],
    completedStrengthKeys: [],
    strengthHistory: [],
  });

  const weekEntries = [...weekPlan.calendarMap.values()].flat();
  const runWalkEntries = weekEntries.filter(entry => entry.type === 'run_walk');
  assert.ok(runWalkEntries.length > 0);
  assert.equal(runWalkEntries[0].label, 'Run/Walk Intervals');
  assert.ok((runWalkEntries[0].workout as { intervals?: unknown } | undefined)?.intervals);
  assert.equal(weekEntries.filter(entry => entry.type === 'run' || entry.type === 'run_walk').length, runWalkEntries.length);
});

test('fresh activity store migration does not seed demo history', () => {
  const source = fs.readFileSync('src/store/activityStore.ts', 'utf8');
  assert.match(source, /activities:\s*\[\]/);
  assert.doesNotMatch(source, /Downhill skiing|fake|demo activity|sample user history/i);
});

test('date display is MM-DD-YYYY while storage stays ISO', () => {
  assert.equal(formatYMDForDisplay('2026-10-18'), '10-18-2026');
  assert.equal(parseDisplayDateToYMD('10-18-2026'), '2026-10-18');
});

test('Coach display sanitizer removes raw markdown syntax and emoji', () => {
  assert.equal(
    sanitizeCoachDisplayText('🏃 - **Run 90 seconds, walk 90 seconds**\n`check`'),
    '• Run 90 seconds, walk 90 seconds\ncheck',
  );
});

test('Movement Lab marker editor allows full-image normalized movement and blocks parent termination', () => {
  const source = fs.readFileSync('src/components/movement/LandmarkEditor.tsx', 'utf8');
  assert.match(source, /normalizedMarkerFromDrag/);
  assert.match(source, /clampMarkerCoordinate/);
  assert.match(source, /onPanResponderTerminationRequest:\s*\(\) => false/);
  assert.doesNotMatch(source, /maxDrag|dragRadius|radiusLimit/i);
});

test('bottom tabs remain exactly six visible destinations with modest larger icons', () => {
  const source = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');
  const visible = [...source.matchAll(/<Tabs\.Screen\s+name="(dashboard|calendar|training|strength|coach|more)"/g)].map(match => match[1]);
  assert.deepEqual(visible, ['dashboard', 'calendar', 'training', 'strength', 'coach', 'more']);
  assert.match(source, /TAB_ICON_SIZE\s*=\s*25/);
  assert.match(source, /TAB_LABEL_FONT_SIZE\s*=\s*10/);
  assert.match(source, /href:\s*null/);
});
