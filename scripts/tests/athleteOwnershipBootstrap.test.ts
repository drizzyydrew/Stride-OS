import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { LocalDataOwner, LOCAL_DATA_OWNER_KEY } from '../../src/lib/localDataOwner';
import { createHydrationSafeStorage } from '../../src/store/hydrationSafeStorage';
import { calculateRecoveryScore } from '../../src/utils/calculateRecoveryScore';

// Same source-loader pattern as activityDurableCommit.test.ts. Its helper is
// private to that test file; keep native I/O synthetic and share Promise identity
// with real Zustand by downleveling VM async functions to the host Promise.
function loadSource<T>(file: string, mocks: Record<string, unknown>): T {
  const filename = resolve(file);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2016, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id),
    console, setTimeout, clearTimeout, Date, Promise, URL, process: { env: {} },
  }, { filename });
  return module.exports as T;
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(done => { release = done; });
  return { promise, release };
}
const tick = () => new Promise<void>(done => setImmediate(done));
const KEY = 'athlete-store';
const DAY_MS = 86_400_000;
const encoded = (state: unknown, version = 0) => JSON.stringify({ state, version });

function harness(raw?: string, options: { holdRead?: boolean; failRead?: boolean } = {}) {
  const values = new Map<string, string>([
    ['integrations-store', encoded({ morningReminderMigratedV37: true,
      readinessNotificationSchedule: 'daily', stravaConnected: false, stravaTokenExpiry: null })],
    ['activity-store', encoded({ schemaVersion: 1, activities: [] })],
  ]);
  if (raw !== undefined) values.set(KEY, raw);
  const secure = new Map<string, string>();
  const writes: string[] = [];
  const held = gate();
  const retry = gate();
  const faults = { failRead: options.failRead ?? false };
  const nativeStorage = {
    getItem: async (key: string) => {
      if (key === KEY) {
        if (options.holdRead) await held.promise;
        if (faults.failRead) throw new Error('Synthetic protected-storage failure');
      }
      return values.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => { writes.push(key); values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
    getAllKeys: async () => [...values.keys()],
  };
  const cleanup = loadSource<typeof import('../../src/lib/localAccountCleanup')>('src/lib/localAccountCleanup.ts', {});
  const persistence = loadSource<typeof import('../../src/store/persistStorage')>('src/store/persistStorage.ts', {
    '@react-native-async-storage/async-storage': nativeStorage,
    'react-native': { Platform: { OS: 'ios' } },
    '../lib/localAccountCleanup': cleanup,
    '../lib/accountDeletionControl': {
      initializeAccountDeletionControl: async () => { cleanup.accountStorageBarrier.setMode('open'); },
    },
    './hydrationSafeStorage': {
      createHydrationSafeStorage: (storage: Parameters<typeof createHydrationSafeStorage>[0]) =>
        createHydrationSafeStorage(storage, () => retry.promise),
    },
  });
  const secureStorage = {
    getItem: async (key: string) => secure.get(key) ?? null,
    setItem: async (key: string, value: string) => { secure.set(key, value); },
  };
  const boundary = loadSource<typeof import('../../src/lib/supabase')>('src/lib/supabase.ts', {
    '@react-native-async-storage/async-storage': nativeStorage,
    'react-native': { Platform: { OS: 'ios' }, AppState: {} },
    'expo-secure-store': { getItemAsync: secureStorage.getItem, setItemAsync: secureStorage.setItem },
    '@supabase/supabase-js': {},
    './localDataOwner': { LOCAL_DATA_OWNER_KEY,
      configureLocalDataOwner: (storage: ConstructorParameters<typeof LocalDataOwner>[0]) => new LocalDataOwner(storage) },
  });
  const athlete = loadSource<typeof import('../../src/store/athleteStore')>('src/store/athleteStore.ts', {
    './persistStorage': persistence, '@react-native-async-storage/async-storage': nativeStorage,
  });
  return { store: athlete.useAthleteStore, values, writes, secure, secureStorage, boundary,
    held, retry, faults };
}

async function settled(h: ReturnType<typeof harness>) {
  await tick();
  await tick();
  assert.equal(h.store.persist.hasHydrated(), true, 'actual Zustand hydration must finish');
}

for (const ordering of ['before hydration', 'after hydration'] as const) {
  test(`fresh native storage stays unclaimed-data-free when ownership discovery runs ${ordering}`, async () => {
    const h = harness(undefined, { holdRead: true });
    const owner = h.boundary.localDataOwner;
    if (ordering === 'after hydration') { h.held.release(); await settled(h); }
    assert.equal(await h.boundary.hasRetainedLocalData(), false);
    await owner.initialize(null, h.boundary.hasRetainedLocalData);
    if (ordering === 'before hydration') { h.held.release(); await settled(h); }
    assert.equal(h.values.has(KEY), false, 'hydration must not manufacture a legacy athlete');
    assert.deepEqual(h.writes, []);
    assert.equal(await h.boundary.hasRetainedLocalData(), false);
    await owner.accept('synthetic-new-user', { explicitSignIn: true });
    assert.equal(owner.status, 'ready');
    assert.equal(owner.canAccess, true);
    assert.equal(h.store.getState().fatigueScore, 38);
    assert.equal(h.store.getState().recoveryScore, 72, 'empty hydration preserves initial defaults');
    h.store.getState().setAthleteName('Synthetic Athlete');
    await tick();
    assert.equal(JSON.parse(h.values.get(KEY)!).state.athleteName, 'Synthetic Athlete', 'explicit edits still save');
  });
}

test('valid partial legacy athlete merges defaults, decays, and stays quarantined without a verified owner', async () => {
  const h = harness(encoded({ athleteName: 'Synthetic Legacy', fatigueScore: 80,
    lastFatigueUpdate: Date.now() - 2 * DAY_MS }));
  await settled(h);
  assert.equal(h.store.getState().athleteName, 'Synthetic Legacy');
  assert.equal(h.store.getState().fatigueScore, 65);
  assert.equal(h.store.getState().sleepHours, 7.5, 'omitted legacy fields retain default merging');
  assert.equal(h.store.getState().recoveryScore, calculateRecoveryScore({ sleepHours: 7.5,
    restingHRDelta: 2, fatigueScore: 65, recentEasyLoad: 0 }));
  assert.equal(await h.boundary.hasRetainedLocalData(), true);
  await h.boundary.localDataOwner.initialize(null, h.boundary.hasRetainedLocalData);
  await h.boundary.localDataOwner.accept('synthetic-other-user', { explicitSignIn: true });
  assert.equal(h.boundary.localDataOwner.status, 'unclaimed');
  assert.equal(h.boundary.localDataOwner.canAccess, false);
});

test('a stored default-looking athlete remains protected legacy data', async () => {
  const fresh = harness();
  await settled(fresh);
  const snapshot = fresh.store.persist.getOptions().partialize!(fresh.store.getState());
  const h = harness(encoded(snapshot));
  await settled(h);
  assert.equal(await h.boundary.hasRetainedLocalData(), true);
  await h.boundary.localDataOwner.initialize(null, h.boundary.hasRetainedLocalData);
  await h.boundary.localDataOwner.accept('synthetic-other-user', { explicitSignIn: true });
  assert.equal(h.boundary.localDataOwner.status, 'unclaimed');
  assert.equal(h.boundary.localDataOwner.canAccess, false);
});

test('versionless partial legacy snapshots preserve supported phase and progression values', async () => {
  const h = harness(JSON.stringify({ state: { athleteName: 'Synthetic Legacy',
    trainingPhase: 'peak', progressionLevel: 'advanced', weeklyMileage: 60 } }));
  await settled(h);
  assert.equal(h.store.getState().trainingPhase, 'peak');
  assert.equal(h.store.getState().progressionLevel, 'advanced');
  assert.equal(h.store.getState().goalRace, 'Sub 5 Marathon');
  assert.equal(await h.boundary.hasRetainedLocalData(), true);
});

test('owned athlete keeps passive decay and rejects cross-account adoption', async () => {
  const h = harness(encoded({ athleteName: 'Synthetic Owner', fatigueScore: 60,
    lastFatigueUpdate: Date.now() - DAY_MS }));
  await settled(h);
  assert.equal(h.store.getState().fatigueScore, 54);
  assert.ok(h.writes.includes(KEY), 'restored records still persist recalculation');
  await h.boundary.localDataOwner.initialize('synthetic-owner-A', h.boundary.hasRetainedLocalData);
  await h.boundary.localDataOwner.accept('synthetic-owner-A');
  assert.equal(h.boundary.localDataOwner.canAccess, true);
  await h.boundary.localDataOwner.accept('synthetic-owner-B', { explicitSignIn: true });
  assert.equal(h.boundary.localDataOwner.status, 'owner-conflict');
  assert.equal(h.boundary.localDataOwner.canAccess, false);
  assert.equal(JSON.parse(h.secure.get(LOCAL_DATA_OWNER_KEY)!).ownerUserId, 'synthetic-owner-A');
  assert.equal(JSON.parse(h.values.get(KEY)!).state.athleteName, 'Synthetic Owner');
});

test('an empty persisted object hydrates without manufacturing athlete fields', async () => {
  const raw = encoded({});
  const h = harness(raw);
  await settled(h);
  assert.equal(h.values.get(KEY), raw);
  assert.deepEqual(h.writes, []);
  assert.equal(await h.boundary.hasRetainedLocalData(), true, 'existing raw records are not exempted');
});

for (const [label, raw] of [
  ['invalid JSON', '{not-json'],
  ['null envelope', 'null'],
  ['missing state', JSON.stringify({ version: 0 })],
  ['array state', encoded([])],
  ['wrong scalar type', encoded({ fatigueScore: null })],
  ['unsupported version', encoded({ athleteName: 'Synthetic Future' }, 999)],
  ['action shadowing', encoded({ athleteName: 'Synthetic', setAthleteName: 'oops' })],
  ['unknown fields', encoded({ athleteName: 'Synthetic', futureAthleteData: { retain: true } })],
] as const) {
  test(`${label} fails hydration without overwriting saved athlete bytes`, async () => {
    const h = harness(raw);
    await tick(); await tick();
    assert.equal(h.store.persist.hasHydrated(), false);
    assert.equal(h.values.get(KEY), raw);
    assert.deepEqual(h.writes, []);
    assert.equal(typeof h.store.getState().setAthleteName, 'function');
    h.store.getState().setAthleteName('Synthetic Edit After Rejected Hydration');
    await tick();
    assert.equal(h.values.get(KEY), raw, 'later setters must not overwrite a rejected snapshot');
    assert.deepEqual(h.writes, []);
    let retainedOrUnreadable = true;
    try { retainedOrUnreadable = await h.boundary.hasRetainedLocalData(); } catch { /* Read failure also blocks adoption. */ }
    assert.equal(retainedOrUnreadable, true);
  });
}

test('native storage failure cannot overwrite history; successful retry restores the real snapshot', async () => {
  const raw = encoded({ athleteName: 'Synthetic Protected', fatigueScore: 80,
    lastFatigueUpdate: Date.now() - 2 * DAY_MS });
  const h = harness(raw, { failRead: true });
  await tick();
  assert.equal(h.store.persist.hasHydrated(), false);
  h.store.getState().setSleepHours(1);
  await tick();
  assert.equal(h.values.get(KEY), raw);
  assert.deepEqual(h.writes, [], 'actual hydration-safe storage must drop premature writes');
  h.faults.failRead = false;
  h.retry.release();
  await settled(h);
  assert.equal(h.store.getState().athleteName, 'Synthetic Protected');
  assert.equal(h.store.getState().fatigueScore, 65);
  assert.equal(await h.boundary.hasRetainedLocalData(), true);
});

test('a real edit during the first empty read is saved after successful hydration', async () => {
  const h = harness(undefined, { holdRead: true });
  await tick();
  assert.equal(h.store.persist.hasHydrated(), false);
  h.store.getState().setAthleteName('Synthetic Pending Athlete');
  await tick();
  assert.equal(h.values.has(KEY), false, 'no writes before the initial read resolves');
  h.held.release();
  await settled(h);
  assert.equal(h.store.getState().athleteName, 'Synthetic Pending Athlete');
  assert.equal(JSON.parse(h.values.get(KEY)!).state.athleteName, 'Synthetic Pending Athlete');
  assert.equal(h.writes.filter(key => key === KEY).length, 1);
});

test('a superseding empty hydration preserves and saves the pending real edit once', async () => {
  const h = harness(undefined, { holdRead: true });
  await tick();
  h.store.getState().setAthleteName('Synthetic Overlapping Edit');
  await tick();
  const superseding = h.store.persist.rehydrate();
  await tick();
  assert.equal(h.values.has(KEY), false);
  h.held.release();
  await superseding;
  await settled(h);
  assert.equal(h.store.getState().athleteName, 'Synthetic Overlapping Edit');
  assert.equal(JSON.parse(h.values.get(KEY)!).state.athleteName, 'Synthetic Overlapping Edit');
  assert.equal(h.writes.filter(key => key === KEY).length, 1);
});

test('a superseding hydration restores existing data instead of flushing the pending edit over it', async () => {
  const raw = encoded({ athleteName: 'Synthetic Saved Athlete', fatigueScore: 80,
    lastFatigueUpdate: Date.now() - 2 * DAY_MS });
  const h = harness(raw, { holdRead: true });
  await tick();
  h.store.getState().setAthleteName('Synthetic Superseded Edit');
  await tick();
  const superseding = h.store.persist.rehydrate();
  await tick();
  assert.equal(h.values.get(KEY), raw);
  assert.deepEqual(h.writes, []);
  h.held.release();
  await superseding;
  await settled(h);
  assert.equal(h.store.getState().athleteName, 'Synthetic Saved Athlete');
  assert.equal(h.store.getState().fatigueScore, 65);
  assert.equal(JSON.parse(h.values.get(KEY)!).state.athleteName, 'Synthetic Saved Athlete');
  assert.equal(h.writes.filter(key => key === KEY).length, 1, 'only restored-record decay is saved');
  assert.equal(await h.boundary.hasRetainedLocalData(), true);
});

test('writes resume only after rejected storage is replaced by a supported successfully hydrated record', async () => {
  const raw = encoded({ athleteName: 'Synthetic Future' }, 999);
  const h = harness(raw);
  await tick(); await tick();
  h.store.getState().setAthleteName('Synthetic Blocked Edit');
  await tick();
  assert.equal(h.values.get(KEY), raw);
  h.values.set(KEY, encoded({ athleteName: 'Synthetic Recovered' }));
  await h.store.persist.rehydrate();
  await settled(h);
  assert.equal(h.store.getState().athleteName, 'Synthetic Recovered');
  h.store.getState().setAthleteName('Synthetic Permitted Edit');
  await tick();
  assert.equal(JSON.parse(h.values.get(KEY)!).state.athleteName, 'Synthetic Permitted Edit');
});

test('a later absent rehydration cannot reuse earlier successful-read provenance', async () => {
  const h = harness(encoded({ athleteName: 'Synthetic Previous' }));
  await settled(h);
  h.values.delete(KEY);
  h.writes.length = 0;
  await h.store.persist.rehydrate();
  await settled(h);
  assert.equal(h.values.has(KEY), false);
  assert.deepEqual(h.writes, []);
});
