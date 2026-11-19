import assert from 'node:assert/strict';
import test from 'node:test';
import { saveStrengthFitDraft, strengthEquipmentSelection, strengthSessionMinutes, toggleStrengthEquipment } from '../../src/utils/strengthSessionFit';

test('unknown equipment remains unknown; explicit empty means bodyweight, not an invented gym', () => {
  assert.equal(strengthEquipmentSelection(undefined), undefined);
  assert.equal(strengthEquipmentSelection('machine'), undefined);
  assert.deepEqual(strengthEquipmentSelection([]), ['bodyweight']);
  assert.deepEqual(strengthEquipmentSelection(['dumbbell', 'dumbbell', 'unknown']), ['bodyweight', 'dumbbell']);
});

test('equipment edits preserve the other choices and bodyweight', () => {
  const start = ['bodyweight', 'band', 'dumbbell'];
  assert.deepEqual(toggleStrengthEquipment(start, 'dumbbell', false), ['bodyweight', 'band']);
  assert.deepEqual(toggleStrengthEquipment(start, 'kettlebell', true), ['bodyweight', 'dumbbell', 'kettlebell', 'band']);
  assert.deepEqual(start, ['bodyweight', 'band', 'dumbbell']);
});

test('session time stays optional and rejects unavailable or nonsensical durations', () => {
  for (const invalid of [undefined, null, '45', NaN, Infinity, 0, -1, 121]) assert.equal(strengthSessionMinutes(invalid), undefined);
  assert.equal(strengthSessionMinutes(45), 45);
  assert.equal(strengthSessionMinutes(29.6), 30);
});

test('onboarding draft does not complete until durable save, and write errors remain retryable', async () => {
  const lease = { ownerUserId: 'a', generation: 1 };
  let finish!: () => void;
  let saved = false;
  const draft = { strengthSessionMinutes: 30, strengthEquipment: ['bodyweight', 'band'] };
  const saving = saveStrengthFitDraft(draft, { ready: () => true, capture: () => lease, isCurrent: () => true,
    write: async value => { assert.deepEqual(value, draft); await new Promise<void>(resolve => { finish = resolve; }); },
  }).then(() => { saved = true; });
  await Promise.resolve(); assert.equal(saved, false);
  finish(); await saving; assert.equal(saved, true);
  await assert.rejects(saveStrengthFitDraft(draft, { ready: () => true, capture: () => lease, isCurrent: () => true,
    write: async () => { throw new Error('storage'); } }), /storage/);
  assert.deepEqual(draft, { strengthSessionMinutes: 30, strengthEquipment: ['bodyweight', 'band'] });
});

test('unready or retired owners cannot save a draft or report a late save complete', async () => {
  const lease = { ownerUserId: 'a', generation: 1 };
  let writes = 0;
  for (const ready of [true, false]) await assert.rejects(saveStrengthFitDraft({}, { ready: () => ready,
    capture: () => ready ? null : lease, isCurrent: () => true, write: () => { writes++; } }));
  assert.equal(writes, 0);
  let current = true;
  await assert.rejects(saveStrengthFitDraft({}, { ready: () => true, capture: () => lease,
    isCurrent: () => current, write: () => { writes++; current = false; } }), /account changed/);
  assert.equal(writes, 1);
});
