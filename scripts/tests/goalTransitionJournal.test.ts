import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import { createHydrationSafeStorage } from '../../src/store/hydrationSafeStorage';
import type { GoalArchive } from '../../src/types/goalArchive';
import type { GoalTransition } from '../../src/lib/goalTransitionJournal';

function loadSource<T>(file: string, mocks: Record<string, unknown>): T {
  const filename = resolve(file);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id),
    console, setTimeout, clearTimeout, Date,
  }, { filename });
  return module.exports as T;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const tick = () => new Promise<void>(done => setImmediate(done));
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(done => { release = done; });
  return { promise, release };
}

function transition(id = 'transition-one'): GoalTransition {
  const snapshot: GoalArchive = {
    schemaVersion: 1, id: 'archive-one', sourceKey: 'old-goal', ownerUserId: 'owner', athleteId: 'athlete',
    title: 'Unfinished old focus', kind: 'goal', goalType: 'general_running',
    startDate: '2026-10-01', endDate: '2026-10-31', archivedAt: 100,
    summary: { completedActivities: 1, partialActivities: 1, activeDays: 2, distanceMeters: 5000,
      durationSeconds: 1800, elevationGainMeters: null, trainingLoad: null, activityIds: ['activity'],
      weeks: [], coverage: { distanceActivities: 1, durationActivities: 1 } },
    result: { status: 'unrecorded' },
  };
  // Extra nested fields prove the journal retains whole plans rather than
  // projecting a subset of fields from the current schema.
  Object.assign(snapshot, { macroPlan: { weeks: [{ weekNumber: 1, sessions: [{ notes: 'Retain every old prescription' }] }],
    recoveryMetadata: { originalFocus: 'old-goal' } }, beginnerPlan: { weeks: [{ originalSessions: ['run', 'walk'] }] } });
  return { schemaVersion: 1, id, ownerUserId: 'owner', requestKey: 'replace-focus:one', snapshots: [snapshot], status: 'prepared' };
}

async function harness(saved?: unknown) {
  const values = new Map<string, string>();
  if (saved !== undefined) values.set('goal-transition:owner', typeof saved === 'string' ? saved : JSON.stringify(saved));
  const source = JSON.stringify({ state: { archives: ['existing immutable archive'], plan: 'original plan' } });
  values.set('goal-archives:owner', source);
  values.set('training-plan-store', source);
  const calls: string[] = [];
  const hooks: {
    beforeRead?: () => void | Promise<void>;
    beforeWrite?: () => void | Promise<void>;
    afterWrite?: () => void | Promise<void>;
    wait?: () => Promise<void>;
    readOverride?: () => string | null;
    writeFailure?: boolean;
    silentWrite?: boolean;
  } = {};
  const storage = createHydrationSafeStorage({
    getItem: async key => {
      calls.push(`read:${key}`); await hooks.beforeRead?.();
      if (hooks.readOverride) { const override = hooks.readOverride; delete hooks.readOverride; return override(); }
      return values.get(key) ?? null;
    },
    setItem: async (key, value) => {
      calls.push(`write:${key}`); await hooks.beforeWrite?.();
      if (hooks.writeFailure) throw new Error('disk full');
      if (!hooks.silentWrite) values.set(key, value);
      await hooks.afterWrite?.();
    },
    removeItem: async () => { throw new Error('Journal must never delete data'); },
  }, async () => { await hooks.wait?.(); });
  const ownerValues = new Map<string, string>();
  const owner = new LocalDataOwner({ getItem: async key => ownerValues.get(key) ?? null,
    setItem: async (key, value) => { ownerValues.set(key, value); } });
  await owner.initialize('owner', async () => false);
  await owner.accept('owner');
  const ownership = { ownerLeaseIsCurrent: (lease: Parameters<LocalDataOwner['isCurrent']>[0]) => owner.isCurrent(lease) };
  const decoder = loadSource<typeof import('../../src/lib/goalArchiveSync')>('src/lib/goalArchiveSync.ts', {
    './localDataOwner': ownership,
    './supabase': { getSupabaseAvailability: () => { throw new Error('Journal must not access cloud data'); } },
  });
  const journal = loadSource<typeof import('../../src/lib/goalTransitionJournal')>('src/lib/goalTransitionJournal.ts', {
    './localDataOwner': ownership, './goalArchiveSync': decoder, '../store/persistStorage': { getAppStorage: () => storage },
  });
  return { ...journal, hooks, values, calls, owner, lease: owner.capture()!,
    writes: () => calls.filter(call => call.startsWith('write:')),
    sourceIsIntact: () => {
      assert.equal(values.get('goal-archives:owner'), source);
      assert.equal(values.get('training-plan-store'), source);
      assert.ok(calls.every(call => call.endsWith(':goal-transition:owner')));
    } };
}

test('missing journal reads null; prepared and complete retain full old plans and never publish archives', async () => {
  const h = await harness();
  assert.equal(await h.readGoalTransition(h.lease), null);
  const record = transition();
  await h.saveGoalTransition(record, h.lease);
  assert.deepEqual(clone(await h.readGoalTransition(h.lease)), record);
  await h.saveGoalTransition({ ...record, status: 'complete' }, h.lease);
  assert.deepEqual(clone(await h.readGoalTransition(h.lease)), { ...record, status: 'complete' });
  assert.ok(h.values.has('goal-transition:owner'));
  h.sourceIsIntact();
});

test('locked read retries through guarded storage before any write and preserves the current journal', async () => {
  const original = transition(); const h = await harness(original);
  const locked = gate(); let attempts = 0;
  h.hooks.beforeRead = () => { if (attempts++ === 0) throw new Error('protected data locked'); };
  h.hooks.wait = () => locked.promise;
  const replacement = transition('next');
  const saving = h.saveGoalTransition(replacement, h.lease);
  replacement.snapshots[0].summary.distanceMeters = 1;
  replacement.id = 'caller mutated';
  await tick();
  assert.equal(h.writes().length, 0);
  assert.deepEqual(JSON.parse(h.values.get('goal-transition:owner')!), original);
  locked.release(); await saving;
  const saved = await h.readGoalTransition(h.lease);
  assert.equal(saved?.id, 'next');
  assert.equal(saved?.snapshots[0].summary.distanceMeters, 5000);
  assert.ok(attempts >= 3, 'initial failure, retry, and readback all reach native storage');
  h.sourceIsIntact();
});

test('all reads and writes are serialized, including complete after prepared', async () => {
  const h = await harness(); const writing = gate(); let blocked = false;
  h.hooks.beforeWrite = async () => { if (!blocked) { blocked = true; await writing.promise; } };
  const prepared = h.saveGoalTransition(transition(), h.lease);
  const read = h.readGoalTransition(h.lease);
  const complete = h.saveGoalTransition({ ...transition(), status: 'complete' }, h.lease);
  await tick(); assert.equal(h.writes().length, 1);
  assert.equal(h.calls.filter(call => call.startsWith('read:')).length, 1);
  writing.release(); await prepared;
  assert.equal((await read)?.status, 'prepared');
  await complete; assert.equal((await h.readGoalTransition(h.lease))?.status, 'complete');
  h.sourceIsIntact();
});

test('late old completion is a successful no-op after a newer prepared choice commits', async () => {
  const old = transition(); const h = await harness(old);
  const writing = gate();
  h.hooks.beforeWrite = () => writing.promise;
  const newer = { ...transition('transition-new'), requestKey: 'replace-focus:new' };
  const preparing = h.saveGoalTransition(newer, h.lease);
  const oldCompletion = { ...old, status: 'complete' as const };
  const completing = h.saveGoalTransition(oldCompletion, h.lease);
  // The CAS must use the captured input rather than the caller's mutable object.
  oldCompletion.id = newer.id;
  await tick(); assert.equal(h.writes().length, 1);
  writing.release();
  await Promise.all([preparing, completing]);
  assert.equal(h.writes().length, 1, 'stale completion never overwrites newer prepared intent');
  assert.deepEqual(clone(await h.readGoalTransition(h.lease)), newer);
  h.sourceIsIntact();
});

test('completion without a current journal is a successful no-op', async () => {
  const h = await harness();
  await h.saveGoalTransition({ ...transition(), status: 'complete' }, h.lease);
  assert.equal(h.writes().length, 0);
  assert.equal(await h.readGoalTransition(h.lease), null);
  h.sourceIsIntact();
});

test('write failures and silently dropped writes reject without replacing prior intent; queue recovers', async () => {
  for (const failure of ['writeFailure', 'silentWrite'] as const) {
    const original = transition(); const h = await harness(original);
    h.hooks[failure] = true;
    await assert.rejects(h.saveGoalTransition(transition('next'), h.lease), /disk full|not confirmed/);
    assert.deepEqual(JSON.parse(h.values.get('goal-transition:owner')!), original);
    h.hooks[failure] = false;
    await h.saveGoalTransition(transition('next'), h.lease);
    assert.equal((await h.readGoalTransition(h.lease))?.id, 'next');
    h.sourceIsIntact();
  }
});

test('readback errors and mismatches reject without empty fallback and preserve durable recovery intent', async () => {
  for (const mismatch of [false, true]) {
    const h = await harness(transition());
    h.hooks.afterWrite = () => {
      h.hooks.readOverride = () => { if (mismatch) return null; throw new Error('readback failed'); };
    };
    await assert.rejects(h.saveGoalTransition(transition('next'), h.lease), /not confirmed|readback failed/);
    assert.equal(JSON.parse(h.values.get('goal-transition:owner')!).id, 'next');
    delete h.hooks.afterWrite;
    assert.equal((await h.readGoalTransition(h.lease))?.id, 'next');
    await h.saveGoalTransition({ ...transition('next'), status: 'complete' }, h.lease);
    h.sourceIsIntact();
  }
});

test('save does not resolve before exact native readback completes', async () => {
  const h = await harness(); const confirmation = gate(); let written = false, resolved = false;
  h.hooks.afterWrite = () => { written = true; };
  h.hooks.beforeRead = async () => { if (written) await confirmation.promise; };
  const saving = h.saveGoalTransition(transition(), h.lease).then(() => { resolved = true; });
  await tick();
  assert.equal(resolved, false); assert.ok(h.values.has('goal-transition:owner'));
  confirmation.release(); await saving; assert.equal(resolved, true);
});

test('malformed and foreign journal fields or snapshots reject reads and block overwrites', async () => {
  const malformed: unknown[] = ['not-json', 'null', '[]', {}, { ...transition(), schemaVersion: 2 },
    { ...transition(), ownerUserId: 'other' }, { ...transition(), id: '' }, { ...transition(), requestKey: ' ' },
    { ...transition(), status: 'pending' }, { ...transition(), snapshots: null },
    { ...transition(), snapshots: [{ ...transition().snapshots[0], ownerUserId: 'other' }] },
    { ...transition(), snapshots: [{ ...transition().snapshots[0], summary: {} }] }];
  for (const invalid of malformed) {
    const h = await harness(invalid);
    const original = h.values.get('goal-transition:owner');
    await assert.rejects(h.readGoalTransition(h.lease));
    await assert.rejects(h.saveGoalTransition(transition('next'), h.lease));
    assert.equal(h.writes().length, 0);
    assert.equal(h.values.get('goal-transition:owner'), original);
    h.sourceIsIntact();
  }
});

test('invalid save input rejects before storage access and cannot alter caller snapshots', async () => {
  for (const invalid of [{ ...transition(), status: 'invalid' }, { ...transition(), ownerUserId: 'other' },
    { ...transition(), snapshots: [{ ...transition().snapshots[0], ownerUserId: 'other' }] }]) {
    const h = await harness(); const before = JSON.stringify(invalid);
    await assert.rejects(h.saveGoalTransition(invalid as GoalTransition, h.lease));
    assert.equal(h.calls.length, 0);
    assert.equal(JSON.stringify(invalid), before);
  }
});

test('owner revocation at initial read, write, and verification rejects without later operations', async () => {
  for (const stage of ['read', 'write', 'readback']) {
    const h = await harness(); let reads = 0;
    h.hooks.beforeRead = () => {
      reads++;
      if (stage === 'read' || (stage === 'readback' && reads === 2)) h.owner.block('signed-out');
    };
    h.hooks.beforeWrite = () => { if (stage === 'write') h.owner.block('signed-out'); };
    await assert.rejects(h.saveGoalTransition(transition(), h.lease), /owner changed/);
    if (stage === 'read') assert.equal(h.writes().length, 0);
    if (stage === 'write') assert.equal(reads, 1, 'revoked writes do not start readback');
    if (stage === 'readback') assert.equal(reads, 2);
    h.sourceIsIntact();
  }
  const h = await harness(transition());
  h.hooks.beforeRead = () => h.owner.block('signed-out');
  await assert.rejects(h.readGoalTransition(h.lease), /owner changed/);
});

test('revoked queued operations never start; captured leases cannot be mutated to bypass owner guards', async () => {
  const h = await harness(); const writing = gate();
  h.hooks.beforeWrite = () => writing.promise;
  const lease = { ...h.lease };
  const first = h.saveGoalTransition(transition(), lease);
  const queued = h.readGoalTransition(lease);
  lease.ownerUserId = 'other'; lease.generation++;
  await tick(); h.owner.block('signed-out'); writing.release();
  await Promise.all([assert.rejects(first, /owner changed/), assert.rejects(queued, /owner changed/)]);
  assert.equal(h.writes().length, 1);
  assert.equal(h.calls.filter(call => call.startsWith('read:')).length, 1);
  h.sourceIsIntact();
});
