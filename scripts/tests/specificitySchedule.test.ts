import assert from 'node:assert/strict';
import test from 'node:test';
import { priorDemandingDates, protectNorwegianSchedule } from '../../src/utils/specificitySchedule';
import { generateStrengthWeek } from '../../src/utils/strengthEngine';
import { runScheduledSessionId } from '../../src/utils/scheduledSessionIds';
import type { RichWorkout } from '../../src/types/workout';
import type { CalendarEntry } from '../../src/utils/calendarEngine';
import type { StrengthLogRecord } from '../../src/types/strength';

const workout = { id: 'goal_a_run_slot_1', protocol: 'norwegian_4x4', dayIndex: 1, type: 'norwegian_4x4', richType: 'vo2', title: 'Norwegian 4×4', durationMinutes: 40 } as RichWorkout;
const run: CalendarEntry = { date: '2026-11-17', type: 'run', label: workout.title, color: 'blue', workout, completed: false };
const easyAlternative = () => ({ ...workout, protocol: undefined, richType: 'easy_run', type: 'easy_run', title: 'Easy run', durationMinutes: 30 } as RichWorkout);

test('actual assigned long or hard lower dates hold unstarted 4x4 and preserve its goal-scoped slot', () => {
  const long: CalendarEntry = { date: '2026-11-18', type: 'run', label: 'Long run', color: 'blue', completed: false,
    workout: { ...workout, id: 'long', protocol: undefined, type: 'long_run', title: 'Long run', durationMinutes: 80 } };
  const session = generateStrengthWeek({ programmingVersion: 1, trainingPhase: 'base', progressionLevel: 'advanced', weeklyMileage: 20,
    currentWeek: 2, fatigueScore: 20, recoveryScore: 80, soreness: 1, injuryRisk: false, acwr: 1, weeksToRace: 0, availableTimeMin: 60, strengthHistory: [] }).sessions[0]!;
  session.exercises.forEach(ex => { ex.rpe = 9; });
  const lower: CalendarEntry = { date: '2026-11-18', type: 'strength', label: 'Hard lower', color: 'green', session, completed: false };
  for (const adjacent of [long, lower]) {
    const result = protectNorwegianSchedule({ calendarMap: new Map([[run.date, [run]], [adjacent.date, [adjacent]]]), easyAlternative });
    assert.equal(result.calendarMap.get(run.date)![0]!.workout!.id, workout.id);
    assert.equal((result.calendarMap.get(run.date)![0]!.workout as RichWorkout).protocol, undefined);
    assert.equal(result.replacements.size, 1);
  }
});

test('already-started or exactly linked completed 4x4 is retained with a review note', () => {
  const other: CalendarEntry = { ...run, date: '2026-11-18', label: 'Long run', workout: { ...workout, id: 'long', protocol: undefined, type: 'long_run' } };
  for (const patch of [{ activeWorkoutId: workout.id }, { completedScheduledIds: [runScheduledSessionId(run.date, workout.id, workout.dayIndex)] }]) {
    const result = protectNorwegianSchedule({ calendarMap: new Map([[run.date, [run]], [other.date, [other]]]), easyAlternative, ...patch });
    assert.equal(result.replacements.size, 0);
    assert.equal(result.calendarMap.get(run.date)![0], run);
    assert.match(result.notes[0]!, /retained/);
  }
});

test('Sunday planning also checks actual hard lower work from the preceding Saturday', () => {
  const strength = { timestamp: new Date('2026-11-14T12:00:00').getTime(), exercises: [{ exerciseId: 'hinge_rdl', sets: [{ completed: true, rpe: 8 }] }] } as StrengthLogRecord;
  const dates = priorDemandingDates([strength], [], new Date('2026-11-15T00:00:00'));
  assert.deepEqual(dates, ['2026-11-14']);
  const sunday = { ...run, date: '2026-11-15' };
  const result = protectNorwegianSchedule({ calendarMap: new Map([[sunday.date, [sunday]]]), priorDemandingDates: dates, easyAlternative });
  assert.equal(result.replacements.size, 1);
  strength.timestamp = new Date('2026-11-15T12:00:00').getTime();
  assert.deepEqual(priorDemandingDates([strength], [], new Date('2026-11-15T00:00:00')), ['2026-11-15']);
  strength.exercises[0]!.sets[0]!.rpe = undefined;
  assert.deepEqual(priorDemandingDates([strength], [], new Date('2026-11-15T00:00:00')), []);
});
