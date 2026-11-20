import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import { reportablePlyometricExercises } from '../../src/utils/plyometricReporting';
import { normalizePlyometricResponse, type PlyometricResponseFeedback } from '../../src/utils/plyometricFeedback';
import type { StrengthLogRecord } from '../../src/types/strength';

const NOW = Date.now();
const lease = { ownerUserId: 'owner', generation: 1 };
const report: PlyometricResponseFeedback = { version: 1, source: 'athlete_reported', landingControl: 'controlled',
  symptomsDuring: 'none', nextDayResponse: 'usual', nextStep: 'repeat', reportedAt: NOW };
const record: StrengthLogRecord = { id: 'saved-strength', sessionId: 'plan-a', sessionType: 'full_body', goal: 'maintenance',
  week: 2, timestamp: NOW - 3 * 86_400_000, completed: true, plannedDuration: 30, actualDuration: 27,
  exercises: [{ exerciseId: 'plyo_low_pogo', name: 'Low Pogo Hops', equipmentType: 'bodyweight',
    prescription: { sets: 2, reps: '6', targetRpe: 4 }, sets: [{ reps: 6, rpe: 4, completed: true }, { reps: 6, rpe: 4, completed: true }] },
    { exerciseId: 'squat_goblet', name: 'Goblet Squat', sets: [{ reps: 8, weight: 20, weightUnit: 'kg', completed: true }] }],
  overallRpe: 5, notes: 'Original notes', source: 'generated', fatigueBefore: 10, fatigueAfter: 15, fatigueDelta: 5, estimatedLoad: 20 };

async function harness(seed?: StrengthLogRecord) {
  const saved = new Map<string, string>();
  if (seed) saved.set('strength-store', JSON.stringify({ state: { history: [seed], completedSessions: [seed.id] }, version: 0 }));
  const synced: StrengthLogRecord[] = [];
  let current = true; let athlete = 'athlete_default'; let profileHydrated = true;
  let fail = false; let mismatch = false; let retireOnWrite = false; let profileOnRead = false;
  let afterWrite: (() => void) | undefined;
  let waitWrite: Promise<void> | undefined; let enterWrite: (() => void) | undefined;
  const storage = {
    getItem: async (key: string) => saved.get(key) ?? null,
    getItemOnce: async (key: string) => { if (profileOnRead) athlete = 'other-athlete'; return mismatch ? 'unconfirmed bytes' : saved.get(key) ?? null; },
    setItem: async (key: string, value: string) => {
      if (fail) throw Error('disk failed');
      if (waitWrite) { const pending = waitWrite; waitWrite = undefined; enterWrite?.(); await pending; }
      saved.set(key, value);
      if (retireOnWrite) current = false;
      const action = afterWrite; afterWrite = undefined; action?.();
    }, removeItem: async () => {},
  };
  const filename = resolve('src/store/strengthStore.ts'); const nativeRequire = createRequire(filename);
  const mocks: Record<string, unknown> = {
    './persistStorage': { getAppStorage: () => storage, createAppJSONStorage: () => createJSONStorage(() => storage) },
    '@react-native-async-storage/async-storage': {},
    '../utils/strengthEngine': { estimateSessionLoad: () => 1 },
    '../lib/syncService': { syncStrengthLog: async (value: StrengthLogRecord) => { synced.push(value); }, deleteStrengthLog: async () => {} },
    '../lib/externalIntegrations': {}, './activityStore': { useActivityStore: {} }, '../utils/activityMigration': {},
    './profileStore': { useProfileStore: { getState: () => ({ activeAthleteId: athlete }), persist: { hasHydrated: () => profileHydrated } } },
    '../lib/localDataOwner': { captureOwnerLease: () => current ? lease : null, ownerLeaseIsCurrent: (value: typeof lease) => current && value.ownerUserId === lease.ownerUserId && value.generation === 1 },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id), console, Date, setTimeout, clearTimeout }, { filename });
  const runtime = module.exports as typeof import('../../src/store/strengthStore');
  await runtime.useStrengthStore.persist.rehydrate();
  if (!seed) runtime.useStrengthStore.setState({ history: [structuredClone(record)], completedSessions: [record.id] });
  const flush = async () => { for (let index = 0; index < 10; index++) await Promise.resolve(); };
  await flush();
  return { ...runtime, saved, synced, flush,
    fail: () => { fail = true; }, mismatch: () => { mismatch = true; }, retire: () => { retireOnWrite = true; },
    switchProfile: () => { profileOnRead = true; }, setAthlete: (id: string) => { athlete = id; }, unhydrateProfile: () => { profileHydrated = false; },
    afterWrite: (action: () => void) => { afterWrite = action; },
    blockWrite: () => { let release!: () => void; waitWrite = new Promise<void>(resolve => { release = resolve; });
      const entered = new Promise<void>(resolve => { enterWrite = resolve; }); return { entered, release }; },
  };
}

test('jump response requires unique actual completed non-warmup reactive work', () => {
  assert.deepEqual(reportablePlyometricExercises(record).map(item => item.exerciseId), ['plyo_low_pogo']);
  for (const patch of [{ skipped: true }, { timestamp: NOW + 100_000 }, { timestamp: 0 }, { exercises: [] },
    { exercises: [{ ...record.exercises[0]!, skipped: true }] },
    { exercises: [{ ...record.exercises[0]!, sets: [{ reps: 6, completed: false }] }] },
    { exercises: [{ ...record.exercises[0]!, sets: [{ reps: 6, completed: true, isWarmup: true }] }] },
    { exercises: [{ ...record.exercises[0]!, sets: [{ reps: 0, completed: true }] }] },
    { exercises: [record.exercises[0]!, record.exercises[0]!] }]) {
    assert.equal(reportablePlyometricExercises({ ...record, ...patch }).length, 0);
  }
});

test('actual store confirms bytes before publishing and changes only one exercise response', async () => {
  const h = await harness(); const before = JSON.stringify(h.useStrengthStore.getState().history[0]);
  const gate = h.blockWrite(); const saving = h.savePlyometricResponse(record.id, 'plyo_low_pogo', report, lease);
  await gate.entered;
  assert.equal(JSON.stringify(h.useStrengthStore.getState().history[0]), before);
  assert.equal(h.synced.length, 0);
  gate.release(); await saving; await h.flush();
  const updated = h.useStrengthStore.getState().history[0]!;
  assert.deepEqual(updated.exercises[0]!.impactResponse, report);
  const { impactResponse, ...performed } = updated.exercises[0]!;
  assert.equal(JSON.stringify(performed), JSON.stringify(record.exercises[0]));
  assert.equal(JSON.stringify(updated.exercises[1]), JSON.stringify(record.exercises[1]));
  assert.equal(updated.actualDuration, record.actualDuration); assert.equal(updated.estimatedLoad, record.estimatedLoad);
  assert.equal(updated.notes, record.notes);
  assert.equal(JSON.parse(h.saved.get('strength-store')!).state.history[0].exercises[0].impactResponse.landingControl, 'controlled');
  assert.equal((h.synced[0] as StrengthLogRecord & { ownerUserId: string }).ownerUserId, 'owner');
  await h.savePlyometricResponse(record.id, 'plyo_low_pogo', null, lease); await h.flush();
  assert.equal(h.useStrengthStore.getState().history[0]!.exercises[0]!.impactResponse, undefined);
  assert.equal(JSON.stringify(h.useStrengthStore.getState().history[0]), before);
});

test('unknown and adverse responses remain reports rather than becoming inferred positive clearance', async () => {
  const h = await harness();
  const unknown = { ...report, landingControl: 'uncertain' as const, symptomsDuring: 'unknown' as const, nextDayResponse: 'unknown' as const };
  await h.savePlyometricResponse(record.id, 'plyo_low_pogo', unknown, lease); await h.flush();
  assert.deepEqual(h.useStrengthStore.getState().history[0]!.exercises[0]!.impactResponse, unknown);
  const adverse = { ...report, landingControl: 'lost' as const, symptomsDuring: 'present' as const, nextDayResponse: 'worse' as const, nextStep: 'easier' as const };
  await h.savePlyometricResponse(record.id, 'plyo_low_pogo', adverse, lease); await h.flush();
  assert.deepEqual(h.useStrengthStore.getState().history[0]!.exercises[0]!.impactResponse, adverse);
});

for (const mode of ['fail', 'mismatch', 'retire', 'switchProfile'] as const) test(`${mode} never publishes or syncs new jump evidence`, async () => {
  const h = await harness(); h[mode]();
  await assert.rejects(h.savePlyometricResponse(record.id, 'plyo_low_pogo', report, lease), /disk failed|could not be confirmed|changed/);
  assert.equal(h.useStrengthStore.getState().history[0]!.exercises[0]!.impactResponse, undefined);
  assert.equal(h.synced.length, 0);
});

test('unready athlete, wrong owner, ambiguous exercise and premature next-day report are rejected', async () => {
  const h = await harness(); h.setAthlete('other');
  await assert.rejects(h.savePlyometricResponse(record.id, 'plyo_low_pogo', report, lease), /not ready/);
  h.setAthlete('athlete_default'); h.unhydrateProfile();
  await assert.rejects(h.savePlyometricResponse(record.id, 'plyo_low_pogo', report, lease), /not ready/);
  const other = await harness();
  await assert.rejects(other.savePlyometricResponse(record.id, 'plyo_low_pogo', report, { ...lease, ownerUserId: 'someone-else' }), /not ready/);
  await assert.rejects(other.savePlyometricResponse(record.id, 'squat_goblet', report, lease), /cannot accept/);
  other.useStrengthStore.setState({ history: [{ ...record, exercises: [record.exercises[0]!, record.exercises[0]!] }] }); await other.flush();
  await assert.rejects(other.savePlyometricResponse(record.id, 'plyo_low_pogo', report, lease), /cannot accept/);
  const recent = await harness();
  recent.useStrengthStore.setState({ history: [{ ...record, timestamp: NOW - 60_000 }] }); await recent.flush();
  await assert.rejects(recent.savePlyometricResponse(record.id, 'plyo_low_pogo', report, lease), /24 hours/);
  assert.equal(normalizePlyometricResponse({ ...report, nextDayResponse: 'unknown' }, NOW - 60_000, NOW)?.nextDayResponse, 'unknown');
});

test('a concurrent history edit is merged before the report is committed', async () => {
  const h = await harness();
  h.afterWrite(() => h.useStrengthStore.setState({ history: [{ ...h.useStrengthStore.getState().history[0]!, notes: 'Latest independent edit' }] }));
  await h.savePlyometricResponse(record.id, 'plyo_low_pogo', report, lease); await h.flush();
  assert.equal(h.useStrengthStore.getState().history[0]!.notes, 'Latest independent edit');
  assert.deepEqual(h.useStrengthStore.getState().history[0]!.exercises[0]!.impactResponse, report);
  assert.equal(JSON.parse(h.saved.get('strength-store')!).state.history[0].notes, 'Latest independent edit');
  assert.deepEqual(JSON.parse(h.saved.get('strength-store')!).state.history[0].exercises[0].impactResponse, report);
});

test('rehydration normalizes saved reports without inferring missing feedback or changing performed sets', async () => {
  const legacy = structuredClone(record);
  legacy.exercises[0]!.impactResponse = { ...report, nextStep: undefined };
  const h = await harness(legacy);
  assert.equal(h.useStrengthStore.getState().history[0]!.exercises[0]!.impactResponse?.nextStep, 'repeat');
  assert.equal(h.useStrengthStore.getState().history[0]!.exercises[1]!.impactResponse, undefined);
  assert.equal(JSON.stringify(h.useStrengthStore.getState().history[0]!.exercises[0]!.sets), JSON.stringify(record.exercises[0]!.sets));
  const invalid = structuredClone(record);
  invalid.exercises[0]!.impactResponse = { ...report, reportedAt: NOW + 86_400_000 };
  const other = await harness(invalid);
  assert.equal(other.useStrengthStore.getState().history[0]!.exercises[0]!.impactResponse, undefined);
  assert.equal(JSON.stringify(other.useStrengthStore.getState().history[0]!.exercises[0]!.sets), JSON.stringify(record.exercises[0]!.sets));
});
