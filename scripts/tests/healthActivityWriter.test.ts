import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import type { Activity } from '../../src/types/activity';

const activity = { id: 'race', workoutInstanceId: 'adhoc:synthetic-health-recording', source: 'tracked', status: 'completed',
  activityType: 'running', startTime: 1, endTime: 5400001, metrics: { durationSeconds: 5400 } } as Activity;
function harness() {
  let current = true;
  let enabled = true;
  let fail = false;
  let queries = 0;
  let written = 0;
  let queryAction = () => {};
  let recent: unknown[] = [];
  const lease = { ownerUserId: 'athlete', generation: 1 };
  const mocks: Record<string, unknown> = {
    react: { useEffect: (effect: () => void) => effect() },
    '../../lib/healthKit': {
      getHealthKitWorkoutHistory: async () => { queries += 1; queryAction(); if (fail) throw new Error('Health read failed'); return recent; },
      writeActivityToHealth: async () => { written += 1; },
    },
    '../../lib/localDataOwner': { captureOwnerLease: () => current ? lease : null, ownerLeaseIsCurrent: (value: unknown) => current && value === lease },
    '../../store/integrationsStore': { useIntegrationsStore: { getState: () => ({ healthKitEnabled: enabled }) } },
    '../../store/activityStore': { useActivityStore: {
      getState: () => ({ activities: [activity] }), subscribe: () => () => {},
      persist: { hasHydrated: () => true },
    } },
  };
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  const file = '../../src/components/sync/HealthActivityWriter';
  delete require.cache[require.resolve(file)];
  loader._load = function (id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
  let writer: typeof import('../../src/components/sync/HealthActivityWriter');
  try { writer = require(file); } finally { loader._load = original; }
  return { writer, get written() { return written; }, get queries() { return queries; },
    failRead: () => { fail = true; }, disable: () => { enabled = false; },
    switchDuringRead: () => { queryAction = () => { current = false; }; },
    disableDuringRead: () => { queryAction = () => { enabled = false; }; },
    exactMatch: () => { recent = [{ uuid: 'health-race', sourceBundleIdentifier: 'watch',
      workoutInstanceId: activity.workoutInstanceId, activityType: 'running', startTime: 1, endTime: 5400001, durationSeconds: 5400 }]; },
  };
}

test('a failed Health lookup defers the write instead of treating failure as absence', async () => {
  const h = harness(); h.failRead();
  await assert.rejects(h.writer.writeUnlessAlreadyInHealth(activity), /Health read failed/);
  assert.equal(h.written, 0);
});

test('an exact Health recording is never written again; a successful absent lookup can write', async () => {
  const exists = harness(); exists.exactMatch();
  await exists.writer.writeUnlessAlreadyInHealth(activity);
  assert.equal(exists.written, 0);
  const missing = harness();
  await missing.writer.writeUnlessAlreadyInHealth(activity);
  assert.equal(missing.written, 1);
});

test('account change or disabling sync while reading prevents a Health write', async () => {
  for (const prepare of ['switchDuringRead', 'disableDuringRead', 'disable'] as const) {
    const h = harness(); h[prepare]();
    await h.writer.writeUnlessAlreadyInHealth(activity);
    assert.equal(h.written, 0, prepare);
  }
});

test('startup does not silently resurrect Health-only history or write existing activities', async () => {
  const h = harness();
  h.writer.default();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.queries, 0);
  assert.equal(h.written, 0);
});
