import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Fragment } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { evaluateProAccess, type ProFeature } from '../../src/utils/pro-access';
import { routeEditCanCommit } from '../../src/utils/routeEditing';
import { routePointAtMeters, snapshotRoute } from '../../src/utils/routeSections';

function moduleAt(file: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, Date,
    require: (id: string) => { if (Object.hasOwn(mocks, id)) return mocks[id]; throw new Error(`Unexpected import ${id}`); } });
  return module.exports;
}

test('premium capabilities deny inactive, cross-owner and unavailable memberships without deleting retained data', () => {
  const active = { billingEnabled: true, billingConfigured: true, owner: 'a', localAccess: true,
    online: true, membershipOwner: 'a', isPro: true, isLoading: false, error: null };
  const features: ProFeature[] = ['custom-routes', 'custom-workouts', 'schedule-changes', 'forecasts', 'movement-lab'];
  for (const feature of features) {
    assert.equal(evaluateProAccess(active, feature).allowed, true);
    for (const patch of [{ isPro: false }, { membershipOwner: 'b' }, { online: false }, { localAccess: false }, { error: 'offline' }]) {
      assert.equal(evaluateProAccess({ ...active, ...patch }, feature).allowed, false, `${feature}: ${JSON.stringify(patch)}`);
    }
  }
});

test('route gate keeps a verified owner draft during refresh, removes expired content and resets on owner changes', () => {
  let owner = 'a';
  const membership: any = { owner: 'a', isPro: true, proExpiresAt: Date.now() + 60_000 };
  let access = { allowed: true, status: 'active', message: '', retry() {} };
  const passive = () => null;
  const api = moduleAt('src/components/subscription/ProFeatureGate.tsx', {
    react: { Fragment }, 'react/jsx-runtime': jsxRuntime, 'react-native': { ScrollView: passive, View: passive },
    'expo-router': { router: { back() {} } },
    '../../hooks/useProAccess': { useProAccess: () => access },
    '../../store/authStore': { useAuthStore: (select: any) => select({ user: { id: owner } }) },
    '../../store/subscriptionStore': { useSubscriptionStore: (select: any) => select(membership) },
    '../../lib/localDataOwner': { captureOwnerLease: () => ({ ownerUserId: owner }) },
    '../../theme/useColors': { useColors: () => ({}) },
    '../layout/ScreenHeader': { default: passive }, './ProAccessNotice': { default: passive },
  });
  const render = () => api.default({ feature: 'custom-workouts', title: 'Custom workouts', children: 'private draft' });
  assert.equal(render().type, Fragment);
  access = { ...access, allowed: false, status: 'checking' };
  assert.equal(render().type, Fragment);
  membership.proExpiresAt = Date.now() - 1;
  assert.notEqual(render().type, Fragment, 'a refresh cannot keep expired playback or drafts accessible');
  owner = 'b'; membership.proExpiresAt = null;
  assert.notEqual(render().type, Fragment, 'an old owner grant cannot authorize the new owner');
  membership.owner = 'b'; access = { ...access, allowed: true, status: 'active' };
  assert.equal(render().key, 'b');
});

function dataControlsHarness(cloudOnly = false) {
  let owner = 'a', generation = 1, shares = 0, writes = 0, cleanup = 0, localDeletes = 0;
  let waitWrite: Promise<void> = Promise.resolve();
  let waitDownload: Promise<void> = Promise.resolve();
  const state = { videos: [{ id: 'v1', uri: 'file:///documents/movement-videos/v1.mp4', title: 'Owned clip', storagePath: cloudOnly ? 'a/v1.mp4' : undefined, createdAt: 1 }],
    sessions: [], analyses: [], readinessAssessments: [], deleteVideo() { localDeletes++; }, removeAnalysis() {}, removeReadinessAssessment() {} };
  const buttons: { label: string; onPress: () => void }[] = [];
  const api = moduleAt('app/(tabs)/movement/data-controls.tsx', {
    react: { useState: (value: any) => [value, () => {}], useRef: (value: any) => ({ current: value }), useEffect: (fn: any) => { fn(); } },
    'react/jsx-runtime': { ...jsxRuntime, jsx: (type: any, props: any) => { if (type === 'Button') buttons.push(props); return jsxRuntime.jsx(type, props); } },
    'react-native': { Alert: { alert() {} }, Share: { share: async () => { shares++; } }, ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    'expo-router': { router: { back() {} } },
    'expo-file-system/legacy': { cacheDirectory: 'file:///cache/', documentDirectory: 'file:///documents/',
      writeAsStringAsync: async () => { writes++; await waitWrite; }, getInfoAsync: async () => ({ exists: !cloudOnly }),
      downloadAsync: async () => { await waitDownload; }, deleteAsync: async () => { cleanup++; } },
    '../../../src/components/layout/ScreenHeader': { __esModule: true, default: 'Header' }, '../../../src/components/ui/Button': { __esModule: true, default: 'Button' },
    '../../../src/theme/useColors': { useColors: () => ({}) },
    '../../../src/store/authStore': { useAuthStore: (select: any) => select({ user: { id: owner }, canAccessLocalData: true }) },
    '../../../src/store/movementStore': { useMovementStore: Object.assign(() => state, { getState: () => state }) },
    '../../../src/lib/localDataOwner': { captureOwnerLease: () => ({ ownerUserId: owner, generation }), ownerLeaseIsCurrent: (lease: any) => lease.ownerUserId === owner && lease.generation === generation },
    '../../../src/lib/mediaPaths': { resolveDocumentUri: (uri: string) => uri },
    '../../../src/lib/supabase': { getSupabaseAvailability: () => cloudOnly ? ({ status: 'available', client: { storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://example.invalid/private-download' }, error: null }) }) } } }) : ({ status: 'unavailable' }) },
    '../../../src/lib/movementVideoStorage': { deleteAnalysisMediaIfStored: async () => {} },
  });
  api.default();
  return { pressExport: () => { const button = buttons.find(item => item.label === 'Export saved records'); assert.ok(button); button.onPress(); },
    pressMedia: () => { const button = buttons.find(item => item.label === 'Export original media'); assert.ok(button); button.onPress(); },
    waitDownload: (promise: Promise<void>) => { waitDownload = promise; },
    waitWrite: (promise: Promise<void>) => { waitWrite = promise; }, changeOwner: () => { owner = 'b'; generation++; },
    counts: () => ({ shares, writes, cleanup, localDeletes }) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('free data export is single-flight and cleans temporary files without mutating owned records', async () => {
  const h = dataControlsHarness();
  h.pressExport(); h.pressExport(); await tick();
  assert.deepEqual(h.counts(), { shares: 1, writes: 1, cleanup: 1, localDeletes: 0 });
});

test('an account switch during export file creation prevents sharing and still cleans the private cache file', async () => {
  const h = dataControlsHarness();
  let release!: () => void;
  h.waitWrite(new Promise<void>(resolve => { release = resolve; }));
  h.pressExport(); await tick(); h.changeOwner(); release(); await tick();
  assert.deepEqual(h.counts(), { shares: 0, writes: 1, cleanup: 1, localDeletes: 0 });
});

function routeSaveHarness() {
  const file = ts.createSourceFile('route-builder.tsx', readFileSync('app/(tabs)/training/route-builder.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'RouteBuilderScreenContent') as ts.FunctionDeclaration;
  const functions = screen.body!.statements.filter(node => ts.isFunctionDeclaration(node)
    && ['authorizeSave', 'saveRoute'].includes(node.name?.text ?? '')).map(node => node.getText(file)).join('\n');
  let allowed = true, checks = 0, commits = 0;
  let generation=1;
  let wait: Promise<void> = Promise.resolve();
  const alive = { current: true }, pending = { current: false };
  const script = ts.transpileModule(`${functions}\nexports.save = authorizeSave;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  vm.runInNewContext(script, { exports, Error, Math,
    saveAlive: alive, savePending: pending,
    ownerLease:{current:{ownerUserId:'a',generation:1}},
    ownerLeaseIsCurrent:(lease:any)=>lease.ownerUserId==='a'&&lease.generation===generation,
    routeEditCanCommit,routePointAtMeters,snapshotRoute,
    editingRoute:null,geometryChanged:false,saveAsNew:false,sections:[],
    useRouteStore:{getState:()=>({routes:[]})},updateRoute(){throw new Error('A new route cannot mutate a saved route');},
    requireProAccess: async () => { checks++; await wait; },
    assertProAccess: () => { if (!allowed) throw new Error('Membership expired'); },
    Alert: { alert() {} }, canSave: true, routeName: '', elevation: null, distanceMiles: 1,
    routeFolder: 'custom', estimatedMin: 10, geometry: [], waypoints: [], distanceMeters: 1609,
    routeSurfaceType: 'unknown', routed: null, routeNotes: '', setShowSave() {}, router: { replace() {} },
    addRoute: () => { commits++; return 'new-route'; },
  });
  return { save: () => exports.save(), expire: () => { allowed = false; }, unmount: () => { alive.current = false; },
    changeOwner:()=>{generation++;},
    wait: (value: Promise<void>) => { wait = value; }, counts: () => ({ checks, commits }) };
}

test('route save rechecks expiry after verification and never commits a retired screen draft', async () => {
  for (const invalidation of ['expiry', 'unmount','owner'] as const) {
    const h = routeSaveHarness(); let release!: () => void;
    h.wait(new Promise<void>(resolve => { release = resolve; }));
    const saving = h.save();
    if (invalidation === 'expiry') h.expire(); else if(invalidation==='owner') h.changeOwner(); else h.unmount();
    release(); await saving;
    assert.deepEqual(h.counts(), { checks: 1, commits: 0 });
  }
  const h = routeSaveHarness(); let release!: () => void;
  h.wait(new Promise<void>(resolve => { release = resolve; }));
  const first = h.save(), duplicate = h.save(); release(); await Promise.all([first, duplicate]);
  assert.deepEqual(h.counts(), { checks: 1, commits: 1 });
});

test('shared runtime access denies a known expired entitlement even before the next SDK refresh', () => {
  const state: any = { owner: 'a', isPro: true, proExpiresAt: Date.now() - 1, isLoading: false, error: null };
  const module = { exports: {} as any };
  const mocks: Record<string, unknown> = {
    'react-native': { Platform: { OS: 'ios' } },
    '../store/authStore': { useAuthStore: { getState: () => ({ user: { id: 'a' }, canAccessLocalData: true }) } },
    '../store/subscriptionStore': { useSubscriptionStore: { getState: () => state } },
    '../utils/pro-access': { evaluateProAccess }, './revenueCat': { billingIsConfigured: () => true },
    './localDataOwner': { captureOwnerLease: () => ({ ownerUserId: 'a' }), ownerLeaseIsCurrent: () => true },
  };
  const output = ts.transpileModule(readFileSync('src/lib/pro-access.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, Date, process: { env: { EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED: 'true' } }, require: (id: string) => mocks[id] });
  assert.equal(module.exports.getProAccess('movement-lab').allowed, false);
  state.proExpiresAt = Date.now() + 60_000;
  assert.equal(module.exports.getProAccess('movement-lab').allowed, true);
  state.proExpiresAt = null;
  assert.equal(module.exports.getProAccess('movement-lab').allowed, true, 'a valid lifetime entitlement has no expiry');
  state.owner = 'b';
  assert.equal(module.exports.getProAccess('movement-lab').allowed, false);
});

test('free cloud-only original export remains owner fenced through the download and cleans temporary media', async () => {
  const h = dataControlsHarness(true); let release!: () => void;
  h.waitDownload(new Promise<void>(resolve => { release = resolve; }));
  h.pressMedia(); await tick(); h.changeOwner(); release(); await tick();
  assert.deepEqual(h.counts(), { shares: 0, writes: 0, cleanup: 1, localDeletes: 0 });
});
