import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCalendarHistory } from '../calendarHistoryProjection';
import type { CalendarEntry } from '../calendarEngine';

const run: CalendarEntry = { date: '2026-10-31', type: 'run', label: 'Morning run', color: '#111', completed: false, scheduledSessionId: 'run' };
const strength: CalendarEntry = { ...run, type: 'strength', label: 'Evening strength', scheduledSessionId: 'strength' };
const actual: CalendarEntry = { ...run, completed: true, completedActivityId: 'saved-run' };

test('a completed morning run never hides the remaining evening strength session', () => {
  const merged = mergeCalendarHistory([run, strength], [actual]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].completed, true);
  assert.equal(merged[0].completedActivityId, 'saved-run');
  assert.equal(merged[1].scheduledSessionId, 'strength');
  assert.equal(merged[1].completed, false);
  assert.equal(run.completed, false);
});

test('unplanned actuals remain visible alongside the active prescription', () => {
  const walk: CalendarEntry = { ...actual, type: 'walking', label: 'Extra walk', scheduledSessionId: undefined, completedActivityId: 'walk' };
  const merged = mergeCalendarHistory([run, strength], [walk]);
  assert.equal(merged.length, 3);
  assert.equal(merged[2].completedActivityId, 'walk');
  assert.equal(merged[0].completed, false);
});

test('the same completion is displayed once by either stable activity or scheduled-session identity', () => {
  const merged = mergeCalendarHistory([{ ...actual, scheduledSessionId: undefined }], [actual]);
  assert.equal(merged.length, 1);
  assert.equal(mergeCalendarHistory([], [actual]).length, 1);
});
