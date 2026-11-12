import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as calibration from '../../src/utils/calibrationEngine';
import * as weights from '../../src/utils/profilePower';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import { saveOnboardingIdentity, saveProfileIdentity } from '../../src/lib/profileIdentityEditing';
import { profileIdentityLabel } from '../../src/utils/profileIdentity';

const draft = { firstName: 'Private', lastName: 'Person', username: 'my.alias', showName: false, showUsername: true };
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Load the actual production profile store with real Zustand persist and a
 * controllable storage adapter; no duplicate save implementation in this test. */
async function harness(active = 'athlete_default', existing?: Map<string, string>) {
  const raw = existing ?? new Map<string, string>();
  if (!raw.has('profile-store')) raw.set('profile-store', JSON.stringify({ version: 1, state: {
    profiles: Object.fromEntries(['athlete_default', 'second'].map(id => [id,
      calibration.createDefaultProfile({ athleteId: id, name: 'Original Name', vo2Estimate: 40 })])),
    activeAthleteId: active,
  } }));
  let nextWrite: Promise<void> | null = null;
  const storage = createJSONStorage(() => ({
    getItem: async (key: string) => raw.get(key) ?? null,
    setItem: async (key: string, value: string) => { if (nextWrite) await nextWrite; raw.set(key, value); },
    removeItem: async (key: string) => { raw.delete(key); },
  }));
  const module = { exports: {} as any };
  const mocks: Record<string, unknown> = {
    zustand: { create }, 'zustand/middleware': { persist },
    './persistStorage': { createAppJSONStorage: () => storage },
    '../utils/calibrationEngine': calibration, '../utils/profilePower': weights,
  };
  runInNewContext(ts.transpileModule(readFileSync('src/store/profileStore.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (id: string) => {
    assert.ok(mocks[id], `Unmocked store import: ${id}`); return mocks[id];
  } });
  const store = module.exports.useProfileStore;
  if (!store.persist.hasHydrated()) await new Promise<void>(resolve => {
    const unsubscribe = store.persist.onFinishHydration(() => { unsubscribe(); resolve(); });
  });
  const ownerRaw = new Map<string, string>();
  const owner = new LocalDataOwner({ getItem: async key => ownerRaw.get(key) ?? null,
    setItem: async (key, value) => { ownerRaw.set(key, value); } });
  await owner.initialize('owner-a', async () => true); await owner.accept('owner-a');
  const lease = owner.capture();
  const mirrors: string[] = [];
  const adapter = {
    ownerIsCurrent: () => owner.isCurrent(lease),
    activeProfile: () => store.getState().getActiveProfile(),
    writeProfile: (id: string, patch: object) => store.getState().updateProfile(id, patch),
    writeLegacyNames: [(name: string) => { mirrors.push(name); }],
  };
  return { store, raw, owner, mirrors, adapter, target: store.getState().getActiveProfile(),
    waitForWrite: (value: Promise<void> | null) => { nextWrite = value; } };
}

test('editor save stays pending until real persisted profile write completes, then survives rehydration', async () => {
  const h = await harness();
  const gate = deferred(); h.waitForWrite(gate.promise);
  let finished = false;
  const saving = saveProfileIdentity(draft, h.target, h.adapter).then(value => { finished = true; return value; });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.deepEqual(h.mirrors, [], 'compatibility writes cannot precede durable profile choices');
  assert.equal(JSON.parse(h.raw.get('profile-store')!).state.profiles.athlete_default.showName, undefined);
  gate.resolve();
  assert.equal((await saving).status, 'saved');
  assert.deepEqual(h.mirrors, ['Private Person']);
  const relaunched = await harness('athlete_default', h.raw);
  assert.equal(profileIdentityLabel(relaunched.target), '@my.alias');
  assert.equal(relaunched.target.firstName, 'Private');
});

test('failed persistence never reports success or writes legacy mirrors; draft can be retried', async () => {
  const h = await harness();
  const gate = deferred(); h.waitForWrite(gate.promise);
  const saving = saveProfileIdentity(draft, h.target, h.adapter);
  gate.reject(new Error('Disk unavailable'));
  const result = await saving;
  assert.equal(result.status, 'storage-failed');
  assert.match(result.message, /retry/);
  assert.deepEqual(h.mirrors, []);
  assert.equal(JSON.parse(h.raw.get('profile-store')!).state.profiles.athlete_default.showName, undefined);
  assert.equal(draft.firstName, 'Private');
  h.waitForWrite(null);
  assert.equal((await saveProfileIdentity(draft, h.target, h.adapter)).status, 'saved');
});

test('owner sign-out during a pending write prevents mirrors and success after it finishes', async () => {
  const h = await harness();
  const gate = deferred(); h.waitForWrite(gate.promise);
  const saving = saveProfileIdentity(draft, h.target, h.adapter);
  await h.owner.signOut(); gate.resolve();
  assert.equal((await saving).status, 'account-changed');
  assert.deepEqual(h.mirrors, []);
});

test('switching active athletes during a pending write prevents subsequent compatibility writes', async () => {
  const h = await harness();
  const gate = deferred(); h.waitForWrite(gate.promise);
  const saving = saveProfileIdentity(draft, h.target, h.adapter);
  h.store.getState().setActiveAthlete('second'); gate.resolve();
  assert.equal((await saving).status, 'account-changed');
  assert.deepEqual(h.mirrors, []);
  assert.equal(h.store.getState().profiles.second.name, 'Original Name');
});

test('editing a secondary athlete persists only that identity and never updates default mirrors', async () => {
  const h = await harness('second');
  assert.equal((await saveProfileIdentity(draft, h.target, h.adapter)).status, 'saved');
  assert.deepEqual(h.mirrors, []);
  const saved = JSON.parse(h.raw.get('profile-store')!).state.profiles;
  assert.equal(profileIdentityLabel(saved.second), '@my.alias');
  assert.equal(saved.athlete_default.name, 'Original Name');
});

test('mirror failure is reported separately after durable profile choices, without later writes', async () => {
  const h = await harness();
  let laterWrites = 0;
  const result = await saveProfileIdentity(draft, h.target, { ...h.adapter,
    writeLegacyNames: [async () => { throw new Error('Legacy write failed'); }, () => { laterWrites++; }],
  });
  assert.equal(result.status, 'mirror-failed');
  assert.equal(laterWrites, 0);
  assert.equal(profileIdentityLabel(JSON.parse(h.raw.get('profile-store')!).state.profiles.athlete_default), '@my.alias');
});

test('owner invalidation during a compatibility write prevents the next mirror and final success', async () => {
  const h = await harness();
  const gate = deferred();
  let started!: () => void;
  const firstStarted = new Promise<void>(resolve => { started = resolve; });
  let laterWrites = 0;
  const saving = saveProfileIdentity(draft, h.target, { ...h.adapter,
    writeLegacyNames: [async () => { started(); await gate.promise; }, () => { laterWrites++; }],
  });
  await firstStarted;
  await h.owner.signOut(); gate.resolve();
  assert.equal((await saving).status, 'account-changed');
  assert.equal(laterWrites, 0);
});


test('onboarding reset completes for an existing secondary athlete without seeding, switching or changing default identity', async () => {
  const h = await harness('second');
  const before = JSON.stringify(h.store.getState().profiles.athlete_default);
  let seeds = 0;
  const result = await saveOnboardingIdentity(draft, 'second', { ...h.adapter,
    activeAthleteId: () => h.store.getState().activeAthleteId,
    seedDefault: () => { seeds++; },
  });
  assert.equal(result.status, 'saved');
  assert.equal(seeds, 0);
  assert.equal(h.store.getState().activeAthleteId, 'second');
  assert.equal(JSON.stringify(h.store.getState().profiles.athlete_default), before);
  assert.deepEqual(h.mirrors, []);
});

test('onboarding cannot seed a missing secondary athlete or seed after owner invalidation', async () => {
  const h = await harness('second');
  let seeds = 0;
  const adapter = { ...h.adapter, activeAthleteId: () => 'missing', activeProfile: () => undefined,
    seedDefault: () => { seeds++; } };
  assert.equal((await saveOnboardingIdentity(draft, 'missing', adapter)).status, 'account-changed');
  h.owner.block('signed-out');
  assert.equal((await saveOnboardingIdentity(draft, 'athlete_default', { ...adapter, activeAthleteId: () => 'athlete_default' })).status, 'account-changed');
  assert.equal(seeds, 0);
});

test('fresh onboarding can seed and save the original profile after the owner boundary is ready', async () => {
  const h = await harness();
  await h.store.setState({ profiles: {} });
  let seeds = 0;
  const result = await saveOnboardingIdentity(draft, 'athlete_default', { ...h.adapter,
    activeAthleteId: () => h.store.getState().activeAthleteId,
    seedDefault: () => { seeds++; h.store.getState().initDefaultProfile('Athlete', 40); },
  });
  assert.equal(result.status, 'saved');
  assert.equal(seeds, 1);
  assert.equal(profileIdentityLabel(h.store.getState().getActiveProfile()), '@my.alias');
});

test('replacing a same-id profile during onboarding persistence cannot finish against the replacement', async () => {
  const h = await harness();
  const gate = deferred(); h.waitForWrite(gate.promise);
  const saving = saveOnboardingIdentity(draft, 'athlete_default', { ...h.adapter,
    activeAthleteId: () => h.store.getState().activeAthleteId, seedDefault: () => {},
  });
  await new Promise(resolve => setImmediate(resolve));
  h.store.setState({ profiles: { ...h.store.getState().profiles,
    athlete_default: { ...h.target, createdAt: h.target.createdAt + 1 } } });
  gate.resolve();
  assert.equal((await saving).status, 'account-changed');
  assert.deepEqual(h.mirrors, []);
});
