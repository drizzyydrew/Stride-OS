import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dismissCustomRunForDate,
  restoreCustomRunForDate,
  selectCustomRunForDate,
  type CustomRunSelectionState,
} from '../../src/utils/customRunSelection';

test('Not Today is persistent, reversible, and does not mutate the custom run', () => {
  const run = { id: 'run-1', name: 'Hill Repeats', routeId: 'route-1', completed: false };
  const initial: CustomRunSelectionState = {
    selectedTodayCustomRunId: null,
    selectedTodayDate: null,
    dismissedTodayCustomRunId: null,
  };
  const selected = selectCustomRunForDate(initial, run.id, '2026-07-13');
  const dismissed = dismissCustomRunForDate(selected, '2026-07-13');
  const persisted = JSON.parse(JSON.stringify({ selection: dismissed, runs: [run] }));

  assert.equal(persisted.selection.selectedTodayCustomRunId, null);
  assert.equal(persisted.selection.dismissedTodayCustomRunId, run.id);
  assert.deepEqual(persisted.runs, [run]);

  const restored = restoreCustomRunForDate(persisted.selection, '2026-07-13');
  assert.equal(restored.selectedTodayCustomRunId, run.id);
  assert.equal(restored.dismissedTodayCustomRunId, null);
  assert.equal(run.completed, false);
});
