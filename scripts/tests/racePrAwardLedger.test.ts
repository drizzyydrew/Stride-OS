import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import * as planner from '../../src/utils/racePrAwards';
import { createAccountStorageBarrier } from '../../src/lib/localAccountCleanup';
import type { RacePR } from '../../src/types/athlete';

const NOW = new Date('2026-11-05T16:00:00Z').getTime();
const performance = (id: string, timeSeconds = 1500, recordedAt = NOW): RacePR => ({
  id, distanceKey: '5k', distanceLabel: '5K', distanceMeters: 5000, timeSeconds,
  date: '2026-11-04', official: true, recordedAt,
});
function gate() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
function moduleAt<T>(file: string, mocks: Record<string, unknown>, date: typeof Date = Date): T {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, { exports, Date: date, console, require: (name: string) => {
    if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
    return mocks[name];
  } }, { filename: file });
  return exports as T;
}

async function harness(existing?: Map<string, string>) {
  const raw = existing ?? new Map<string, string>();
  if (!raw.has('achievement-store')) raw.set('achievement-store', JSON.stringify({ version: 1, state: {
    awarded: [{ id: 'pr_longest_run', awardedAt: 42 }],
  } }));
  let failBadge = false; let failLedger = false; let corruptReadback = false;
  let writeGate: Promise<void> | null = null;
  const barrier = createAccountStorageBarrier(); barrier.setMode('open');
  const adapter = barrier.wrap({
    getItem: async (key: string) => raw.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (key === 'achievement-store' ? failBadge : failLedger) throw new Error('Synthetic disk failure');
      if (key.startsWith('race-pr-awards:')) await writeGate;
      raw.set(key, value);
    }, removeItem: async (key: string) => { raw.delete(key); },
  });
  const storage = { ...adapter, getItemOnce: async (key: string) => corruptReadback ? null : await adapter.getItem(key) };
  const { useAchievementStore: awards } = moduleAt<typeof import('../../src/store/achievementStore')>('src/store/achievementStore.ts', {
    zustand: { create }, 'zustand/middleware': { persist }, './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => adapter) },
  });
  if (!awards.persist.hasHydrated()) await new Promise<void>(resolve => {
    const stop = awards.persist.onFinishHydration(() => { stop(); resolve(); });
  });
  const ownerRaw = new Map<string, string>();
  const owner = new LocalDataOwner({ getItem: async key => ownerRaw.get(key) ?? null,
    setItem: async (key, value) => { ownerRaw.set(key, value); } });
  await owner.initialize('owner', async () => true); await owner.accept('owner');
  const state = { activeAthleteId: 'athlete_default', profiles: { athlete_default: { racePRs: [] as RacePR[] } } };
  class Clock extends Date { static now() { return NOW - 1000; } }
  const lib = moduleAt<typeof import('../../src/lib/racePrAwardLedger')>('src/lib/racePrAwardLedger.ts', {
    './localDataOwner': { ownerLeaseIsCurrent: (lease: Parameters<LocalDataOwner['isCurrent']>[0]) => owner.isCurrent(lease) },
    '../store/persistStorage': { getAppStorage: () => storage },
    '../store/achievementStore': { useAchievementStore: awards },
    '../store/profileStore': { useProfileStore: { getState: () => state } }, '../utils/racePrAwards': planner,
  }, Clock);
  const reconcile = (records = state.profiles.athlete_default.racePRs, now = NOW) => {
    state.profiles.athlete_default.racePRs = records;
    return lib.reconcileRacePrAwards(owner.capture()!, records, now);
  };
  return { raw, awards, owner, state, reconcile, key: lib.racePrLedgerKey('owner'), barrier,
    failBadge: (value: boolean) => { failBadge = value; }, failLedger: (value: boolean) => { failLedger = value; },
    corruptReadback: (value: boolean) => { corruptReadback = value; }, waitWrite: (value: Promise<void> | null) => { writeGate = value; } };
}

test('actual persistent ledger and badge store seed history quietly then repeat only new faster PRs', async () => {
  const h = await harness(); const old = performance('old', 1500, NOW - 2000);
  await h.reconcile([old]);
  assert.equal(h.awards.getState().unlockQueue.length, 0);
  assert.equal(h.awards.getState().awarded.filter(award => award.id === 'race_pr_5k').length, 1);
  assert.equal(h.awards.getState().awarded.find(award => award.id === 'pr_longest_run')?.awardedAt, 42);
  const next = performance('new', 1440);
  await h.reconcile([old, next]);
  assert.equal(h.awards.getState().unlockQueue.length, 1);
  assert.equal(h.awards.getState().unlockQueue[0].racePR?.timeSeconds, 1440);
  h.awards.getState().dismissNextUnlock();
  await h.reconcile([old, next]);
  assert.equal(h.awards.getState().unlockQueue.length, 0);
  const restarted = await harness(h.raw);
  await restarted.reconcile([old, next]);
  assert.equal(restarted.awards.getState().unlockQueue.length, 0);
  await restarted.reconcile([old, next, performance('third', 1400)], NOW + 1);
  assert.equal(restarted.awards.getState().unlockQueue.length, 1);
  assert.equal(restarted.awards.getState().awarded.filter(award => award.id === 'race_pr_5k').length, 1);
});

test('first explicit result entered during initial source loading celebrates once after durable writes', async () => {
  const h = await harness();
  await h.reconcile([performance('first')]);
  assert.equal(h.awards.getState().unlockQueue.length, 1);
  assert.ok(h.raw.has(h.key));
  assert.equal(JSON.parse(h.raw.get('achievement-store')!).state.awarded.some((award: { id: string }) => award.id === 'race_pr_5k'), true);
});

test('failed ledger persistence/readback cannot publish a badge or popup and can retry', async () => {
  const h = await harness(); h.failLedger(true);
  await assert.rejects(h.reconcile([performance('first')]), /disk failure/);
  assert.equal(h.awards.getState().awarded.some(award => award.id === 'race_pr_5k'), false);
  assert.equal(h.awards.getState().unlockQueue.length, 0);
  h.failLedger(false); h.corruptReadback(true);
  await assert.rejects(h.reconcile([performance('first')]), /could not be verified/);
  assert.equal(h.awards.getState().unlockQueue.length, 0);
  h.corruptReadback(false);
  await h.reconcile([performance('first')]);
  assert.equal(h.awards.getState().awarded.some(award => award.id === 'race_pr_5k'), true);
});

test('badge-write failure after durable ledger recovers permanent ownership without replaying animation', async () => {
  const h = await harness(); h.failBadge(true);
  await assert.rejects(h.reconcile([performance('first')]), /disk failure/);
  assert.ok(h.raw.has(h.key));
  assert.equal(h.awards.getState().unlockQueue.length, 0);
  h.failBadge(false); await h.reconcile([performance('first')]);
  assert.equal(JSON.parse(h.raw.get('achievement-store')!).state.awarded.some((award: { id: string }) => award.id === 'race_pr_5k'), true);
  assert.equal(h.awards.getState().unlockQueue.length, 0);
});

test('owner invalidation during ledger write prevents notification and ownership publication', async () => {
  const h = await harness(); const waiting = gate(); h.waitWrite(waiting.promise);
  const task = h.reconcile([performance('first')]);
  await new Promise(resolve => setImmediate(resolve));
  await h.owner.signOut(); waiting.resolve(); await task;
  assert.equal(h.awards.getState().unlockQueue.length, 0);
  assert.equal(h.awards.getState().awarded.some(award => award.id === 'race_pr_5k'), false);
});

test('profile changes during persisted write prevent publishing stale PR event', async () => {
  const h = await harness(); const waiting = gate(); h.waitWrite(waiting.promise);
  const task = h.reconcile([performance('first')]);
  await new Promise(resolve => setImmediate(resolve));
  h.state.profiles.athlete_default.racePRs = [];
  waiting.resolve(); await task;
  assert.equal(h.awards.getState().unlockQueue.length, 0);
});

test('secondary athlete, foreign namespace and failed native reads never replace history', async () => {
  const h = await harness(); h.state.activeAthleteId = 'secondary';
  await h.reconcile([performance('first')]); assert.equal(h.raw.has(h.key), false);
  h.state.activeAthleteId = 'athlete_default';
  h.raw.set(h.key, JSON.stringify({ ...planner.nextRacePrLedger(null, [], 'other', NOW).ledger }));
  await assert.rejects(h.reconcile([performance('first')]), /not been reset/);
  assert.equal(h.awards.getState().unlockQueue.length, 0);
  h.raw.delete(h.key); h.barrier.setMode('purging');
  await assert.rejects(h.reconcile([performance('first')]), /fenced/);
  assert.equal(h.raw.has(h.key), false);
});

test('guarded race dismissal cannot consume a later unrelated unlock', async () => {
  const h = await harness(); await h.reconcile([performance('first')]);
  const key = h.awards.getState().unlockQueue[0].racePR!.eventKey;
  h.awards.getState().dismissRacePrUnlock('old-key'); assert.equal(h.awards.getState().unlockQueue.length, 1);
  h.awards.getState().dismissRacePrUnlock(key); assert.equal(h.awards.getState().unlockQueue.length, 0);
  h.awards.getState().recordAwards(['first_run']);
  h.awards.getState().dismissRacePrUnlock(key); assert.equal(h.awards.getState().unlockQueue.length, 1);
});

test('first ownership at a new distance uses award time, not the earlier ledger startup date', async () => {
  const h = await harness(); await h.reconcile([], NOW);
  await h.reconcile([performance('new-distance', 1500, NOW + 10_000)], NOW + 10_000);
  assert.equal(h.awards.getState().awarded.find(award => award.id === 'race_pr_5k')?.awardedAt, NOW + 10_000);
  await h.reconcile([performance('new-distance', 1500, NOW + 10_000)], NOW + 20_000);
  assert.equal(h.awards.getState().awarded.find(award => award.id === 'race_pr_5k')?.awardedAt, NOW + 10_000);
});
