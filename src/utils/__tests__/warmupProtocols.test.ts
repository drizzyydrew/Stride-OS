import assert from 'node:assert/strict';
import { test } from 'node:test';

import { warmupForSession, warmupKindForCategory } from '../warmupProtocols';

test('mobility sessions get no added warm-up volume', () => {
  const protocol = warmupForSession('mobility');
  assert.equal(protocol.items.length, 0);
  assert.equal(protocol.durationMinutes, 0);
});

test('active recovery sessions get no added warm-up volume', () => {
  const protocol = warmupForSession('active_recovery');
  assert.equal(protocol.items.length, 0);
  assert.equal(protocol.durationMinutes, 0);
});

test('treadmill warm-up differs from easy-run warm-up', () => {
  const treadmill = warmupForSession('treadmill_run');
  const easy = warmupForSession('easy_run');
  assert.notDeepEqual(treadmill, easy);
  assert.ok(treadmill.title.toLowerCase().includes('treadmill'));
});

test('interval run warm-up is longer/more structured than easy run', () => {
  const interval = warmupForSession('interval_run');
  const easy = warmupForSession('easy_run');
  assert.ok(interval.durationMinutes > easy.durationMinutes);
  assert.ok(interval.items.length > easy.items.length);
});

test('every non-none warm-up kind returns a positive duration and at least one item', () => {
  const kinds: Parameters<typeof warmupForSession>[0][] = [
    'easy_run', 'interval_run', 'long_run', 'run_walk', 'treadmill_run',
    'strength_upper', 'strength_lower', 'strength_full_body', 'strength_heavy_barbell',
    'strength_runner', 'strength_general', 'indoor_cycling', 'outdoor_cycling',
  ];
  for (const kind of kinds) {
    const protocol = warmupForSession(kind);
    assert.ok(protocol.durationMinutes > 0, `${kind} should have a positive duration`);
    assert.ok(protocol.items.length > 0, `${kind} should have at least one item`);
  }
});

test('heavy barbell warm-up is progressive and longer than a general strength warm-up', () => {
  const heavy = warmupForSession('strength_heavy_barbell');
  const general = warmupForSession('strength_general');
  assert.ok(heavy.durationMinutes > general.durationMinutes);
});

test('unknown kind falls back to none rather than throwing', () => {
  // Defensive runtime path — a caller that bypasses the type system (e.g. a
  // value from warmupKindForCategory's `other` branch used incorrectly)
  // should never throw or return undefined.
  const protocol = warmupForSession('not_a_real_kind' as unknown as Parameters<typeof warmupForSession>[0]);
  assert.equal(protocol.items.length, 0);
});

// ─── warmupKindForCategory ──────────────────────────────────────────────────

test('warmupKindForCategory routes mobility and active recovery to none', () => {
  assert.equal(warmupKindForCategory('mobility'), 'mobility');
  assert.equal(warmupKindForCategory('active_recovery'), 'active_recovery');
  assert.equal(warmupKindForCategory('rest'), 'active_recovery');
});

test('warmupKindForCategory differentiates run subtypes', () => {
  assert.equal(warmupKindForCategory('run', 'treadmill'), 'treadmill_run');
  assert.equal(warmupKindForCategory('run', 'long'), 'long_run');
  assert.equal(warmupKindForCategory('run', 'intervals'), 'interval_run');
  assert.equal(warmupKindForCategory('run'), 'easy_run');
});

test('warmupKindForCategory differentiates strength subtypes', () => {
  assert.equal(warmupKindForCategory('strength', 'upper_body'), 'strength_upper');
  assert.equal(warmupKindForCategory('strength', 'lower_body'), 'strength_lower');
  assert.equal(warmupKindForCategory('strength', 'gym_barbell'), 'strength_heavy_barbell');
  assert.equal(warmupKindForCategory('strength', 'runner_strength'), 'strength_runner');
  assert.equal(warmupKindForCategory('strength'), 'strength_general');
});

test('warmupKindForCategory falls back to other for unrecognized categories', () => {
  assert.equal(warmupKindForCategory('something_else'), 'other');
});
