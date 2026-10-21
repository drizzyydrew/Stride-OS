import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import type { Activity } from '../../src/types/activity';
import { resolveActivityDetail } from '../../src/utils/activityResolution';

const nativeRequire = createRequire(import.meta.url);
const loader = Module as unknown as { _load: (name: string, ...args: unknown[]) => unknown };
const original = loader._load;
let resolveHref: (href: any) => string;
let getStateFromPath: (path: string, config: any) => any;
// The installed path parser only needs this native module for config validation.
// Keep its actual URL encoder/parser and both actual hooks, not a copied codec.
loader._load = function (name, ...args) {
  return name === '../react-navigation/native' ? { validatePathConfig() {} } : original.call(this, name, ...args);
};
try {
  resolveHref = nativeRequire('expo-router/build/link/href').resolveHref;
  getStateFromPath = nativeRequire('expo-router/build/fork/getStateFromPath').getStateFromPath;
} finally { loader._load = original; }

function hook(path: string, context: unknown, mocks: Record<string, unknown>) {
  const filename = nativeRequire.resolve(path);
  const module = { exports: {} as any };
  vm.runInNewContext(readFileSync(filename, 'utf8'), { module, exports: module.exports,
    require: (name: string) => name === 'react' ? { use: () => context } : mocks[name] ?? nativeRequire(name),
  }, { filename });
  return module.exports;
}

function transport(id: string, edit = false) {
  const href = resolveHref({ pathname: edit ? '/activity/manual' : '/activity/[activityId]', params: { activityId: id } });
  const state = getStateFromPath(href, { screens: { activity: { path: edit ? 'activity/manual' : 'activity/:activityId' } } });
  const route = state.routes[0];
  const local = hook('expo-router/build/hooks/useLocalSearchParams', route.params, {
    '../Route': { LocalRouteParamsContext: {} }, '../link/preview/PreviewRouteContext': { usePreviewInfo: () => ({}) },
  }).useLocalSearchParams();
  const raw = hook('expo-router/build/react-navigation/core/useRoute', route, {
    './NavigationProvider': { NavigationRouteContext: {} },
  }).useRoute();
  return { href, local: local.activityId as string, raw: raw.params.activityId as string };
}

function activity(id: string) { return { id, activityType: 'running', metrics: {} } as Activity; }

test('installed router preserves opaque recording IDs only through parsed route params, including edit queries', () => {
  for (const id of ['activity_workout_run_adhoc%3Asynthetic', 'activity_%253Asynthetic', 'activity_%2Fsynthetic',
    'activity_%25synthetic', 'activity_%invalid', 'activity_plain', 'activity_raw:synthetic', 'healthkit_watch_1111-2222']) {
    for (const edit of [false, true]) {
      const roundTrip = transport(id, edit);
      assert.equal(roundTrip.raw, id, `${id} ${edit ? 'edit query' : 'detail path'}`);
      const result = resolveActivityDetail([activity(id)], roundTrip.raw, 'ready');
      assert.equal(result.status, 'resolved');
      if (result.status === 'resolved') assert.equal(result.activity.id, id);
    }
  }
  const id = 'activity_workout_run_adhoc%3Asynthetic';
  assert.notEqual(transport(id).local, id, 'Reproduce the installed hook double-decoding defect');
  assert.equal(resolveActivityDetail([activity(id)], transport(id).local, 'ready').status, 'unavailable');
});

test('literal percent and colon IDs remain distinct instead of opening the wrong exact activity', () => {
  const encoded = activity('activity_workout_run_adhoc%3Asynthetic');
  const literal = activity('activity_workout_run_adhoc:synthetic');
  const rows = [literal, encoded];
  for (const target of rows) {
    const result = resolveActivityDetail(rows, transport(target.id).raw, 'ready');
    assert.equal(result.status, 'resolved');
    if (result.status === 'resolved') assert.equal(result.activity, target);
  }
  const old = resolveActivityDetail(rows, transport(encoded.id).local, 'ready');
  assert.equal(old.status, 'resolved');
  if (old.status === 'resolved') assert.equal(old.activity, literal, 'The old hook can open a different row, not just an empty screen');
});

test('recovery-returned canonical IDs survive replacement navigation without modifying stored history', () => {
  const recovered = activity('activity_workout_run_adhoc%3Asynthetic');
  const before = JSON.stringify(recovered);
  const params = transport(recovered.id).raw;
  assert.equal(resolveActivityDetail([recovered], params, 'ready').status, 'resolved');
  assert.equal(JSON.stringify(recovered), before);
  for (const path of ['app/(tabs)/activity/[activityId].tsx', 'app/(tabs)/activity/manual.tsx']) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /useRoute\(\)\.params/);
    assert.doesNotMatch(source, /useLocalSearchParams/);
  }
});
