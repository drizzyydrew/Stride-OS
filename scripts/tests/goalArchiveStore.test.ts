import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import type { GoalArchive } from '../../src/types/goalArchive';

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
const plain = <T,>(value: T): T => clone(value); // Normalize VM prototypes for strict equality.
const archive = (id = 'first', ownerUserId = 'owner'): GoalArchive => ({
  schemaVersion: 1, id, sourceKey: `goal:${id}`, ownerUserId, athleteId: 'athlete',
  title: 'Original title', kind: 'goal', goalType: 'general_running', startDate: '2026-10-01',
  endDate: '2026-10-31', archivedAt: 100,
  summary: { completedActivities: 3, partialActivities: 0, activeDays: 3, distanceMeters: 10000,
    durationSeconds: 3600, elevationGainMeters: null, trainingLoad: null, activityIds: ['run'], weeks: [],
    coverage: { distanceActivities: 3, durationActivities: 3 } }, result: { status: 'unrecorded' },
});
const tick = () => new Promise<void>(done => setImmediate(done));
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(done => { release = done; });
  return { promise, release };
}

async function harness(options: { local?: string | GoalArchive[]; cloud?: unknown; offline?: boolean } = {}) {
  const values = new Map<string, string>();
  if (options.local !== undefined) values.set('goal-archives:owner', typeof options.local === 'string' ? options.local : JSON.stringify(options.local));
  const hooks: {
    storage?: (stage: string, key: string) => Promise<void> | void;
    cloud?: (stage: string) => Promise<void> | void;
    wait?: () => Promise<void>;
    readOverride?: () => string | null;
    writeFailure?: boolean;
    silentWrite?: boolean;
    offline: boolean;
    userId?: string;
    sessionId?: string;
    rpcFailureAt?: number;
    readFailureAt?: number;
    noopRpc?: boolean;
  } = { offline: options.offline ?? false };
  const reads: string[] = [], writes: string[] = [], calls: string[] = [], headers: string[] = [];
  const nativeStorage = {
    getItem: async (key: string) => {
      reads.push(key);
      await hooks.storage?.('read', key);
      if (hooks.readOverride) { const override = hooks.readOverride; delete hooks.readOverride; return override(); }
      return values.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      await hooks.storage?.('write', key);
      if (hooks.writeFailure) throw new Error('disk full');
      writes.push(key);
      if (!hooks.silentWrite) values.set(key, value);
      await hooks.storage?.('after-write', key);
    },
    removeItem: async () => { throw new Error('No archive removal is authorized'); },
  };
  const ownerStorage = new Map<string, string>();
  const owner = new LocalDataOwner({ getItem: async key => ownerStorage.get(key) ?? null,
    setItem: async (key, value) => { ownerStorage.set(key, value); } });
  await owner.initialize('owner', async () => false);
  await owner.accept('owner');
  const ownership = { ownerLeaseIsCurrent: (lease: Parameters<LocalDataOwner['isCurrent']>[0], cloud = false) => owner.isCurrent(lease, cloud) };
  const hydration = loadSource<typeof import('../../src/store/hydrationSafeStorage')>('src/store/hydrationSafeStorage.ts', {});
  const adapter = hydration.createHydrationSafeStorage(nativeStorage, async () => { await hooks.wait?.(); });
  let cloudValue: unknown = clone(options.cloud ?? []);
  let cloudReads = 0, rpcCalls = 0;
  const onCloud = async (stage: string) => {
    calls.push(stage);
    await hooks.cloud?.(stage);
    if (hooks.offline) throw new Error('offline');
  };
  const client = {
    auth: {
      getSession: async () => { await onCloud('session'); return { data: { session: {
        user: { id: hooks.sessionId ?? 'owner' }, access_token: 'synthetic-test-token' } }, error: null }; },
      getUser: async (token: string) => { assert.equal(token, 'synthetic-test-token'); await onCloud('user');
        return { data: { user: { id: hooks.userId ?? 'owner' } }, error: null }; },
    },
    from: (table: string) => {
      assert.equal(table, 'profiles');
      const query = {
        select: (column: string) => { assert.equal(column, 'goal_archives'); return query; },
        eq: (column: string, value: string) => { assert.equal(column, 'id'); assert.equal(value, 'owner'); return query; },
        setHeader: (name: string, value: string) => { assert.equal(name, 'Authorization'); headers.push(value); return query; },
        maybeSingle: async () => {
          cloudReads++;
          await onCloud(`cloud-read:${cloudReads}`);
          if (hooks.readFailureAt === cloudReads) return { data: null, error: new Error('read failed') };
          return { data: cloudValue === null ? null : { goal_archives: clone(cloudValue) }, error: null };
        },
      };
      return query;
    },
    rpc: (name: string, args: { archive: GoalArchive }) => {
      assert.equal(name, 'merge_stride_goal_archive');
      // Deployed SQL accepts these two sources only; no schema/RPC changes.
      assert.ok(args.archive.result.source === undefined || ['race_record', 'user'].includes(args.archive.result.source), 'deployed RPC source allowlist');
      return { setHeader: async (header: string, value: string) => {
        assert.equal(header, 'Authorization'); headers.push(value); rpcCalls++;
        await onCloud(`rpc:${rpcCalls}`);
        if (hooks.rpcFailureAt === rpcCalls) return { error: new Error('merge failed') };
        if (!hooks.noopRpc) cloudValue = sync.mergeGoalArchives(cloudValue as GoalArchive[], [clone(args.archive)]);
        return { error: null };
      } };
    },
  };
  const sync = loadSource<typeof import('../../src/lib/goalArchiveSync')>('src/lib/goalArchiveSync.ts', {
    './localDataOwner': ownership, './supabase': { getSupabaseAvailability: () => ({ status: 'available', client }) },
  });
  const makeStore = () => loadSource<typeof import('../../src/store/goalArchiveStore')>('src/store/goalArchiveStore.ts', {
    '../lib/localDataOwner': ownership, '../lib/goalArchiveSync': sync, './persistStorage': { getAppStorage: () => adapter },
  }).useGoalArchiveStore;
  const store = makeStore();
  return { store, makeStore, sync, owner, hooks, values, reads, writes, calls, headers,
    lease: () => owner.capture()!, local: () => JSON.parse(values.get('goal-archives:owner') ?? '[]') as GoalArchive[],
    cloud: () => plain(cloudValue) as GoalArchive[], setCloud: (value: unknown) => { cloudValue = value; },
    get rpcCalls() { return rpcCalls; }, get cloudReads() { return cloudReads; } };
}

test('requires explicit owner load; offline load is locally ready and never writes a blank cloud fallback', async () => {
  const h = await harness({ local: [archive()], offline: true });
  await assert.rejects(h.store.getState().addArchive(archive('second'), h.lease()), /Load this owner/);
  await assert.rejects(h.store.getState().sync(h.lease()), /Load this owner/);
  assert.equal(h.writes.length, 0);
  await h.store.getState().load(h.lease());
  assert.equal(h.store.getState().status, 'ready');
  assert.equal(h.store.getState().syncStatus, 'error');
  assert.equal(h.store.getState().archives.length, 1);
  assert.equal(h.writes.length, 0);
  await h.store.getState().addArchive(archive('second'), h.lease());
  assert.deepEqual(h.local().map(a => a.id), ['first', 'second']);
  assert.ok(h.reads.every(key => key === 'goal-archives:owner'));
  assert.ok(h.writes.every(key => key === 'goal-archives:owner'));
});

test('protected storage must become readable before queued commits; source objects are copied', async () => {
  const h = await harness({ local: [archive()], offline: true });
  const locked = gate(); let failures = 1;
  h.hooks.storage = stage => { if (stage === 'read' && failures-- > 0) throw new Error('device locked'); };
  h.hooks.wait = () => locked.promise;
  const loading = h.store.getState().load(h.lease());
  const incoming = archive('second');
  const saving = h.store.getState().addArchive(incoming, h.lease());
  incoming.summary.distanceMeters = 999;
  await tick();
  assert.equal(h.writes.length, 0);
  assert.equal(h.store.getState().status, 'loading');
  locked.release();
  await Promise.all([loading, saving]);
  assert.equal(h.local()[1].summary.distanceMeters, 10000);
});

test('cloud immutable body wins restore conflicts, latest result survives, all local/cloud ids survive restart', async () => {
  const local = archive(); local.title = 'Conflicting local title'; local.summary.distanceMeters = 1;
  local.result = { status: 'finished', timeSeconds: 1234, source: 'user', updatedAt: 200 };
  const cloud = archive(); cloud.result = { status: 'did_not_finish', source: 'user', updatedAt: 100 };
  const h = await harness({ local: [local, archive('local-only')], cloud: [cloud, archive('cloud-only')] });
  await h.store.getState().load(h.lease());
  assert.equal(h.store.getState().status, 'ready');
  assert.equal(h.store.getState().syncStatus, 'local');
  assert.equal(h.rpcCalls, 0);
  assert.equal(h.local()[0].title, 'Original title');
  assert.equal(h.local()[0].summary.distanceMeters, 10000);
  assert.deepEqual(h.local()[0].result, local.result);
  assert.equal(h.local().length, 3);
  await h.store.getState().sync(h.lease());
  assert.equal(h.rpcCalls, 2);
  assert.equal(h.store.getState().syncStatus, 'synced');
  assert.deepEqual(h.cloud(), h.local());
  const restarted = h.makeStore();
  await restarted.getState().load(h.lease());
  assert.deepEqual(plain(restarted.getState().archives), h.local());
  assert.ok(h.headers.every(header => header === 'Bearer synthetic-test-token'));
});

test('serial adds/results retain snapshots and independent ids, stale/tied result updates cannot win', async () => {
  const h = await harness({ offline: true });
  await h.store.getState().load(h.lease());
  const source = archive();
  await Promise.all([
    h.store.getState().addArchive(source, h.lease()),
    h.store.getState().addArchive(archive('second'), h.lease()),
    h.store.getState().saveResult('first', { status: 'finished', timeSeconds: 1200, updatedAt: 500 }, h.lease()),
  ]);
  const duplicate = archive(); duplicate.title = 'Replacement'; duplicate.summary.distanceMeters = 1;
  duplicate.result = { status: 'did_not_start', updatedAt: 400 };
  await h.store.getState().addArchive(duplicate, h.lease());
  await h.store.getState().saveResult('first', { status: 'did_not_finish', updatedAt: 500 }, h.lease());
  assert.equal(h.local().length, 2);
  assert.equal(h.local()[0].title, 'Original title');
  assert.equal(h.local()[0].summary.distanceMeters, 10000);
  assert.equal(h.local()[0].result.status, 'finished');
  await h.store.getState().saveResult('first', { status: 'unrecorded' }, h.lease());
  assert.deepEqual(h.local()[0].summary, source.summary);
  assert.equal(h.local()[0].result.status, 'unrecorded');
  assert.equal(h.local()[0].result.source, 'user');
  assert.ok(h.local()[0].result.updatedAt! > 500);
});

test('failed or silently dropped local writes never publish a successful archive; retry commits', async () => {
  for (const failure of ['writeFailure', 'silentWrite'] as const) {
    const h = await harness({ offline: true });
    await h.store.getState().load(h.lease());
    h.hooks[failure] = true;
    await assert.rejects(h.store.getState().addArchive(archive(), h.lease()), /disk full|not confirmed/);
    assert.equal(h.store.getState().archives.length, 0);
    assert.equal(h.local().length, 0);
    h.hooks[failure] = false;
    await h.store.getState().addArchive(archive(), h.lease());
    assert.equal(h.store.getState().archives.length, 1);
  }
});

test('readback failure retains prior publication, retry recovers durable original and preserves its summary', async () => {
  for (const mismatch of [false, true]) {
    const h = await harness({ offline: true });
    await h.store.getState().load(h.lease());
    h.hooks.storage = stage => {
      if (stage === 'after-write') {
        h.hooks.readOverride = () => { if (mismatch) return '[]'; throw new Error('readback unavailable'); };
      }
    };
    await assert.rejects(h.store.getState().addArchive(archive(), h.lease()), /readback unavailable|not confirmed/);
    assert.equal(h.store.getState().archives.length, 0);
    assert.equal(h.local().length, 1);
    delete h.hooks.storage;
    const retry = archive(); retry.summary.distanceMeters = 1;
    await h.store.getState().addArchive(retry, h.lease());
    assert.equal(h.store.getState().archives[0].summary.distanceMeters, 10000);
    assert.equal(h.local().length, 1);
  }
});

test('malformed or foreign local history blocks all rewriting; malformed cloud retains local readiness', async () => {
  for (const local of ['not-json', '{}', JSON.stringify([archive('foreign', 'other')]), JSON.stringify([archive(), archive()])]) {
    const h = await harness({ local });
    await assert.rejects(h.store.getState().load(h.lease()));
    assert.equal(h.store.getState().status, 'error');
    await assert.rejects(h.store.getState().addArchive(archive('new'), h.lease()));
    assert.equal(h.writes.length, 0);
    assert.equal(h.calls.length, 0);
  }
  const malformedSummary = archive(); delete (malformedSummary.summary as Partial<GoalArchive['summary']>).distanceMeters;
  for (const cloud of [{}, [malformedSummary], [archive('foreign', 'other')], [archive(), archive()]]) {
    const h = await harness({ local: [archive()], cloud });
    await h.store.getState().load(h.lease());
    assert.equal(h.store.getState().status, 'ready');
    assert.equal(h.store.getState().syncStatus, 'error');
    assert.equal(h.writes.length, 0);
    await assert.rejects(h.store.getState().sync(h.lease()));
    assert.equal(h.rpcCalls, 0);
    assert.equal(h.local().length, 1);
  }
});

test('failed restore prevents any cloud merge; offline local additions survive a successful retry', async () => {
  const h = await harness({ cloud: [archive('cloud-only')], offline: true });
  await h.store.getState().load(h.lease());
  await h.store.getState().addArchive(archive(), h.lease());
  await assert.rejects(h.store.getState().sync(h.lease()));
  assert.equal(h.rpcCalls, 0);
  assert.equal(h.local().length, 1);
  assert.equal(h.store.getState().syncStatus, 'error');
  h.hooks.offline = false;
  await h.store.getState().sync(h.lease());
  assert.equal(h.cloud().length, 2);
  assert.deepEqual(h.cloud(), h.local());
  assert.equal(h.store.getState().syncStatus, 'synced');
});

test('partial cloud merges and failed canonical readback remain retryable with every local id intact', async () => {
  for (const failure of ['partial', 'readback', 'noop'] as const) {
    const h = await harness({ local: [archive(), archive('second')], offline: true });
    await h.store.getState().load(h.lease());
    h.hooks.offline = false;
    if (failure === 'partial') h.hooks.rpcFailureAt = 2;
    if (failure === 'readback') h.hooks.readFailureAt = 2;
    if (failure === 'noop') h.hooks.noopRpc = true;
    await assert.rejects(h.store.getState().sync(h.lease()));
    assert.equal(h.store.getState().syncStatus, 'error');
    assert.equal(h.local().length, 2);
    assert.equal(h.store.getState().archives.length, 2);
    delete h.hooks.rpcFailureAt; delete h.hooks.readFailureAt; delete h.hooks.noopRpc;
    await h.store.getState().sync(h.lease());
    assert.deepEqual(h.cloud(), h.local());
    assert.equal(h.store.getState().syncStatus, 'synced');
  }
});

test('missing profile restores empty; invalid results and foreign inserts do not write', async () => {
  const h = await harness(); h.setCloud(null);
  await h.store.getState().load(h.lease());
  assert.equal(h.store.getState().status, 'ready');
  assert.equal(h.store.getState().archives.length, 0);
  assert.equal(h.writes.length, 0);
  await assert.rejects(h.store.getState().addArchive(archive('foreign', 'other'), h.lease()));
  await h.store.getState().addArchive(archive(), h.lease());
  const writes = h.writes.length;
  for (const result of [{ status: 'finished', timeSeconds: -1 }, { status: 'did_not_finish', timeSeconds: 2 },
    { status: 'finished', updatedAt: 'yesterday' }, { status: 'unrecorded', source: 'unknown' }]) {
    await assert.rejects(h.store.getState().saveResult('first', result as GoalArchive['result'], h.lease()));
  }
  await assert.rejects(h.store.getState().saveResult('missing', { status: 'finished' }, h.lease()));
  assert.equal(h.writes.length, writes);
});

test('session and verified user mismatches fail before querying any profile', async () => {
  for (const mismatch of ['sessionId', 'userId'] as const) {
    const h = await harness({ local: [archive()] });
    h.hooks[mismatch] = 'other';
    await h.store.getState().load(h.lease());
    assert.equal(h.store.getState().status, 'ready');
    assert.equal(h.store.getState().syncStatus, 'error');
    assert.equal(h.cloudReads, 0);
    await assert.rejects(h.store.getState().sync(h.lease()), /owner could not be verified/);
    assert.equal(h.rpcCalls, 0);
    assert.equal(h.writes.length, 0);
  }
});

test('lease invalidation at each cloud await stops further queries, durable writes, and success publication', async () => {
  for (const stage of ['session', 'user', 'cloud-read:1', 'rpc:1', 'cloud-read:2']) {
    const h = await harness({ local: [archive()], offline: true });
    const lease = h.lease();
    await h.store.getState().load(lease);
    h.hooks.offline = false;
    h.hooks.cloud = current => { if (current === stage) h.owner.block('signed-out'); };
    await assert.rejects(h.store.getState().sync(lease), /owner changed/);
    assert.equal(h.calls.at(-1), stage);
    assert.equal(h.writes.length, 0);
    assert.notEqual(h.store.getState().syncStatus, 'synced');
    assert.equal(h.store.getState().archives.length, 1);
  }
});

test('lease invalidation during initial read, queued wait, local read, write, and readback never publishes a commit', async () => {
  for (const stage of ['initial', 'read', 'write', 'readback', 'queued']) {
    const h = await harness({ offline: true }); const lease = h.lease();
    if (stage === 'initial') {
      h.hooks.storage = () => h.owner.block('signed-out');
      await assert.rejects(h.store.getState().load(lease), /owner changed/);
      assert.notEqual(h.store.getState().status, 'ready');
    } else {
      await h.store.getState().load(lease);
      let reads = 0;
      h.hooks.storage = current => {
        if (current === 'read') reads++;
        if ((stage === 'read' && current === 'read') || (stage === 'write' && current === 'write')
          || (stage === 'readback' && current === 'read' && reads === 2)) h.owner.block('signed-out');
      };
      if (stage === 'queued') {
        const writing = gate();
        h.hooks.storage = async current => { if (current === 'write') await writing.promise; };
        const first = h.store.getState().addArchive(archive(), lease);
        const second = h.store.getState().addArchive(archive('second'), lease);
        await tick(); h.owner.block('signed-out'); writing.release();
        await Promise.all([assert.rejects(first, /owner changed/), assert.rejects(second, /owner changed/)]);
        assert.equal(h.writes.length, 1, 'the queued stale second write never starts');
      } else await assert.rejects(h.store.getState().addArchive(archive(), lease), /owner changed/);
      assert.equal(h.store.getState().archives.length, 0);
    }
    assert.ok(h.writes.every(key => key === 'goal-archives:owner'));
  }
});

test('offline snapshot conflicts sync against cloud original while retaining the newer local explicit result', async () => {
  const original = archive();
  original.result = { status: 'did_not_start', source: 'user', updatedAt: 100 };
  const local = archive(); local.summary.distanceMeters = 2; local.title = 'Wrong baseline';
  local.result = { status: 'finished', source: 'user', updatedAt: 200, timeSeconds: 800 };
  const h = await harness({ local: [local], cloud: [original], offline: true });
  await h.store.getState().load(h.lease());
  h.hooks.offline = false;
  await h.store.getState().sync(h.lease());
  assert.deepEqual(h.local()[0].summary, original.summary);
  assert.equal(h.local()[0].title, original.title);
  assert.deepEqual(h.local()[0].result, local.result);
  assert.deepEqual(h.cloud(), h.local());
  assert.equal(h.rpcCalls, 1);
});

test('cloud success followed by local write/readback failure cannot publish synced; retry finishes canonical commit', async () => {
  for (const failure of ['write', 'readback']) {
    const h = await harness({ local: [archive()], offline: true });
    await h.store.getState().load(h.lease());
    h.hooks.offline = false;
    if (failure === 'write') h.hooks.writeFailure = true;
    else h.hooks.storage = stage => {
      if (stage === 'after-write') h.hooks.readOverride = () => { throw new Error('readback unavailable'); };
    };
    await assert.rejects(h.store.getState().sync(h.lease()), /disk full|readback unavailable/);
    assert.equal(h.store.getState().syncStatus, 'error');
    assert.equal(h.store.getState().archives.length, 1);
    assert.equal(h.cloud().length, 1);
    h.hooks.writeFailure = false; delete h.hooks.storage;
    await h.store.getState().sync(h.lease());
    assert.equal(h.rpcCalls, 1, 'retry does not needlessly upload a confirmed unchanged cloud record');
    assert.equal(h.store.getState().syncStatus, 'synced');
  }
});

test('local commits remain unpublished until native readback resolves; saveResult retries after a rejected write', async () => {
  const h = await harness({ local: [archive()], offline: true });
  await h.store.getState().load(h.lease());
  h.hooks.writeFailure = true;
  await assert.rejects(h.store.getState().saveResult('first', { status: 'finished', timeSeconds: 1200 }, h.lease()), /disk full/);
  assert.equal(h.store.getState().archives[0].result.status, 'unrecorded');
  h.hooks.writeFailure = false;
  const confirmation = gate(); let written = false;
  h.hooks.storage = async stage => {
    if (stage === 'after-write') written = true;
    if (stage === 'read' && written) await confirmation.promise;
  };
  const saving = h.store.getState().saveResult('first', { status: 'finished', timeSeconds: 1200 }, h.lease());
  await tick();
  assert.equal(h.local()[0].result.status, 'finished');
  assert.equal(h.store.getState().archives[0].result.status, 'unrecorded');
  confirmation.release(); await saving;
  assert.equal(h.store.getState().archives[0].result.status, 'finished');
});

test('cloud restore cannot publish readiness after a lease change at any authenticated request', async () => {
  for (const stage of ['session', 'user', 'cloud-read:1']) {
    const h = await harness({ cloud: [archive()] }); const lease = h.lease();
    h.hooks.cloud = current => { if (current === stage) h.owner.block('signed-out'); };
    await assert.rejects(h.store.getState().load(lease), /owner changed/);
    assert.equal(h.store.getState().archives.length, 0);
    assert.notEqual(h.store.getState().status, 'ready');
    assert.equal(h.writes.length, 0);
    assert.equal(h.calls.at(-1), stage);
  }
});


test('linked Activity pointer uses deployed SQL-compatible wire source and restores locally without copying finish data', async () => {
  const snapshot = archive();
  snapshot.result = { status: 'unrecorded', source: 'activity_link', linkedActivityId: 'saved-run', updatedAt: 200 };
  const before = JSON.stringify(snapshot);
  const h = await harness({ local: [snapshot], cloud: [] });
  await h.store.getState().load(h.lease());
  await h.store.getState().sync(h.lease());
  assert.equal(h.cloud()[0].result.source, 'race_record');
  assert.equal(h.cloud()[0].result.linkedActivityId, 'saved-run');
  assert.equal(h.cloud()[0].result.timeSeconds, undefined);
  assert.equal(h.local()[0].result.source, 'activity_link');
  assert.equal(h.local()[0].result.linkedActivityId, 'saved-run');
  assert.equal(JSON.stringify(snapshot), before);
  const restarted = h.makeStore();
  await restarted.getState().load(h.lease());
  assert.equal(restarted.getState().archives[0].result.source, 'activity_link');
  assert.equal(restarted.getState().archives[0].result.timeSeconds, undefined);
  const migration = readFileSync('supabase/migrations/20261031210327_owner_scoped_goal_archives.sql', 'utf8');
  assert.match(migration, /not in \('race_record', 'user'\)/);
});

test('malformed encoded linked pointers cannot enter local state as copied or finished race records', async () => {
  const h = await harness();
  for (const result of [{ status: 'finished', source: 'race_record', linkedActivityId: 'run', timeSeconds: 1200 },
    { status: 'unrecorded', source: 'race_record', linkedActivityId: '' },
    { status: 'did_not_finish', source: 'race_record', linkedActivityId: 'run' }]) {
    assert.throws(() => h.sync.decodeGoalArchives([{ ...archive(), result }], 'owner'), /Invalid goal archive result/);
  }
});
