import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createAccountStorageBarrier, runLocalAccountCleanup, type CleanupDependencies } from '../../src/lib/localAccountCleanup';
import { accountCleanupKeys } from '../../src/lib/localAccountCleanupManifest';
import { ACCOUNT_DATA_KEYS, ACCOUNT_SECURE_KEYS } from '../../src/lib/localAccountCleanupManifest';

function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('bootstrap holds hydration and writes until the control record is readable', async () => {
  const barrier = createAccountStorageBarrier();
  const values = new Map([['activity-store', 'real history']]);
  let reads = 0;
  const storage = barrier.wrap({ getItem: async key => { reads++; return values.get(key) ?? null; },
    setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } });
  const read = storage.getItem('activity-store');
  await tick(); assert.equal(reads, 0);
  barrier.setMode('error');
  await tick(); assert.equal(reads, 0, 'failed control read must not hydrate empty defaults');
  barrier.setMode('open');
  assert.equal(await read, 'real history');
  await storage.setItem('activity-store', 'updated');
  assert.equal(values.get('activity-store'), 'updated');
});

test('purging discards an already awaited old hydration result', async () => {
  const barrier = createAccountStorageBarrier(); barrier.setMode('open');
  const waiting = gate();
  const storage = barrier.wrap({ getItem: async () => { await waiting.promise; return 'old history'; },
    setItem: async () => undefined, removeItem: async () => undefined });
  const reading = storage.getItem('activity-store'); await tick();
  barrier.setMode('purging'); waiting.release();
  assert.equal(await reading, null);
});

test('fence drains the native write already started and rejects deferred and later writes before purge', async () => {
  const barrier = createAccountStorageBarrier(); barrier.setMode('open');
  const waiting = gate(); const values = new Map<string, string>();
  let writes = 0;
  const storage = barrier.wrap({ getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { writes++; await waiting.promise; values.set(key, value); },
    removeItem: async key => { values.delete(key); } });
  const first = storage.setItem('activity-store', 'in-flight');
  const deferred = assert.rejects(storage.setItem('activity-store', 'stale queued'), /fenced/);
  await tick(); barrier.setMode('purging');
  let drained = false; const draining = barrier.drain().then(() => { drained = true; });
  await tick(); assert.equal(drained, false);
  waiting.release(); await first; await deferred; await draining;
  values.delete('activity-store');
  await assert.rejects(storage.setItem('activity-store', 'late restore'), /fenced/);
  assert.equal(writes, 1); assert.equal(values.has('activity-store'), false);
});

test('pending retains readable history while inhibiting saves, and foreign scoped records prevent purge', async () => {
  const barrier = createAccountStorageBarrier(); barrier.setMode('pending');
  const storage = barrier.wrap({ getItem: async () => 'saved', setItem: async () => { throw new Error('must not write'); }, removeItem: async () => undefined });
  assert.equal(await storage.getItem('training-plan-store'), 'saved');
  await assert.rejects(storage.setItem('training-plan-store', '{}'), /fenced/);
  assert.throws(() => accountCleanupKeys(['activity-store', 'goal-archives:another-owner'], 'owner'), /Another owner/);
  assert.deepEqual(accountCleanupKeys(['activity-store', 'goal-archives:owner', 'unrelated-preference'], 'owner'), ['activity-store', 'goal-archives:owner']);
});

function cleanupHarness() {
  const values = new Map([['activity-store', 'history'], ['goal-archives:owner', 'archive'], ['unrelated-preference', 'retain']]);
  const calls: string[] = []; let owner = 'owner', failMedia = false;
  const deps: CleanupDependencies = {
    assertOwner: async expected => { if (expected !== owner) throw new Error('owner changed'); },
    persistPurging: async () => { calls.push('journal-purging'); }, fence: async () => { calls.push('fence'); },
    quiesce: async () => { calls.push('quiesce'); }, drain: async () => { calls.push('drain'); },
    keys: async () => [...values.keys()], removeKey: async key => { calls.push(`remove:${key}`); values.delete(key); }, readKey: async key => values.get(key) ?? null,
    removeCredentials: async () => { calls.push('credentials'); }, verifyCredentials: async () => { calls.push('verify-credentials'); },
    removeMedia: async () => { calls.push('media'); if (failMedia) throw new Error('media unavailable'); }, verifyMedia: async () => { calls.push('verify-media'); },
    persistVerified: async () => { calls.push('journal-verified'); },
  };
  return { values, calls, deps, changeOwner: () => { owner = 'other'; }, failMedia: (value: boolean) => { failMedia = value; } };
}
const completed = { ownerUserId: 'owner', requestId: 'receipt', serverCompleted: true };
test('no verified server completion means no fence, credential deletion, media removal or history changes', async () => {
  const h = cleanupHarness();
  await assert.rejects(runLocalAccountCleanup({ ...completed, serverCompleted: false }, h.deps), /Verified server completion/);
  assert.deepEqual(h.calls, []); assert.equal(h.values.get('activity-store'), 'history');
});
test('cleanup journals and fences before removing scoped data; owner release is not permitted in this runtime', async () => {
  const h = cleanupHarness(); await runLocalAccountCleanup(completed, h.deps);
  assert.deepEqual(h.calls.slice(0, 4), ['journal-purging', 'fence', 'quiesce', 'drain']);
  assert.equal(h.calls.at(-1), 'journal-verified');
  assert.deepEqual([...h.values], [['unrelated-preference', 'retain']]);
});
test('interruption before media confirmation leaves cleanup unfinished and safely rerunnable', async () => {
  const h = cleanupHarness(); h.failMedia(true);
  await assert.rejects(runLocalAccountCleanup(completed, h.deps), /media unavailable/);
  assert.equal(h.calls.includes('journal-verified'), false);
  h.failMedia(false); await runLocalAccountCleanup(completed, h.deps);
  assert.equal(h.calls.at(-1), 'journal-verified');
});
test('owner change while draining prevents any account records from being removed', async () => {
  const h = cleanupHarness(); h.deps.drain = async () => { h.changeOwner(); };
  await assert.rejects(runLocalAccountCleanup(completed, h.deps), /owner changed/);
  assert.equal(h.values.get('activity-store'), 'history');
  assert.equal(h.calls.includes('credentials'), false);
});
test('silently dropped key removal is detected before credentials or completion', async () => {
  const h = cleanupHarness(); h.deps.removeKey = async () => undefined;
  await assert.rejects(runLocalAccountCleanup(completed, h.deps), /not yet confirmed/);
  assert.equal(h.calls.includes('credentials'), false); assert.equal(h.calls.includes('journal-verified'), false);
});

test('the explicit manifest covers actual persisted store and recovery keys, preserving only known benign theme state', () => {
  const manifest = new Set<string>(ACCOUNT_DATA_KEYS);
  for (const file of readdirSync('src/store').filter(name => name.endsWith('.ts'))) {
    const source = readFileSync(`src/store/${file}`, 'utf8');
    if (!source.includes('persist(')) continue;
    for (const match of source.matchAll(/\bname:\s*'([^']+)'/g)) {
      const key = match[1];
      if ((key.includes('-store') || key.startsWith('active-') || key === 'hydration-planner-inputs') && key !== 'theme-store') {
        assert.equal(manifest.has(key), true, `${file}: ${key} must have an explicit cleanup policy`);
      }
    }
  }
  for (const file of ['runEndRetryQueue', 'runCompletionJournal', 'outdoorEndJournal']) {
    const key = readFileSync(`src/lib/${file}.ts`, 'utf8').match(/export const [A-Z_]+ = '([^']+)'/)?.[1];
    assert.ok(key); assert.equal(manifest.has(key), true);
  }
  const strava = readFileSync('src/lib/strava.ts', 'utf8');
  for (const match of strava.matchAll(/const STORE_[A-Z_]+\s*=\s*'([^']+)'/g)) assert.equal((ACCOUNT_SECURE_KEYS as readonly string[]).includes(match[1]), true);
  assert.deepEqual(accountCleanupKeys(['theme-store', 'settings-store', 'strideos-weather-cache-v1'], 'owner'), ['settings-store', 'strideos-weather-cache-v1']);
  assert.throws(() => accountCleanupKeys(['new-personal-store'], 'owner'), /unclassified/);
});
