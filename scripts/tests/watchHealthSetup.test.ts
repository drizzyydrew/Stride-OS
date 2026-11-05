import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path: string) => readFileSync(path, 'utf8');

test('production Watch Health setup queue waits for idle, persists, deduplicates and expires requests', { skip: process.platform !== 'darwin' }, () => {
  const suite = `StrideOS.test.healthSetup.${process.pid}`;
  const swift = `${read('targets/StrideOSWatch/StrideWatchHealthSetup.swift')}
let defaults = UserDefaults(suiteName: "${suite}")!
defaults.removePersistentDomain(forName: "${suite}")
defer { defaults.removePersistentDomain(forName: "${suite}") }
let now: TimeInterval = 1800000000
let queue = StrideWatchHealthSetup(defaults: defaults)
assert(!queue.hasPendingRequest)
assert(queue.beginIfIdle(canPresent: true, now: now) == nil)
assert(!queue.enqueue(id: "", requestedAt: now, now: now))
assert(!queue.enqueue(id: "future", requestedAt: now + 301, now: now))
assert(!queue.enqueue(id: "nan", requestedAt: .nan, now: now))
assert(!queue.enqueue(id: "stale", requestedAt: now - 8 * 86400, now: now))
assert(queue.enqueue(id: "one", requestedAt: now, now: now))
assert(queue.beginIfIdle(canPresent: false, now: now) == nil)
assert(queue.hasPendingRequest)
// Reconstructing after app termination must preserve only the explicit request.
let restarted = StrideWatchHealthSetup(defaults: defaults)
assert(restarted.beginIfIdle(canPresent: false, now: now) == nil)
assert(restarted.beginIfIdle(canPresent: true, now: now) == "one")
assert(restarted.beginIfIdle(canPresent: true, now: now) == nil)
assert(!restarted.enqueue(id: "one", requestedAt: now, now: now))
assert(restarted.enqueue(id: "two", requestedAt: now + 2, now: now + 2))
assert(!restarted.enqueue(id: "delayed-older", requestedAt: now + 1, now: now + 2))
// Completing a stale callback must not clear the in-flight or newer request.
restarted.complete(id: "wrong")
assert(restarted.inFlightId == "one")
restarted.complete(id: "one")
assert(restarted.hasPendingRequest)
assert(!restarted.enqueue(id: "one", requestedAt: now, now: now))
assert(restarted.beginIfIdle(canPresent: true, now: now + 2) == "two")
// Denying read permission is still a processed sheet and must not prompt again.
restarted.complete(id: "two")
assert(!restarted.hasPendingRequest)
let afterDenial = StrideWatchHealthSetup(defaults: defaults)
assert(!afterDenial.enqueue(id: "two", requestedAt: now, now: now))
assert(!afterDenial.enqueue(id: "older-after-restart", requestedAt: now + 1, now: now + 3))
assert(afterDenial.enqueue(id: "later", requestedAt: now + 3, now: now + 3))
assert(afterDenial.beginIfIdle(canPresent: true, now: now + 8 * 86400) == nil)
assert(!afterDenial.hasPendingRequest)
print("Health setup queue scenarios passed")
`;
  const result = spawnSync('swift', ['-'], { input: swift, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /Health setup queue scenarios passed/);
});

function loadModule(native: Record<string, unknown> | null) {
  const exports: Record<string, any> = {};
  const compiled = ts.transpileModule(read('modules/stride-watch-connectivity/src/index.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: (name: string) => name === 'react-native' ? { Platform: { OS: 'ios' } }
      : name === 'expo-modules-core' ? { requireNativeModule: () => {
        if (!native) throw new Error('Unavailable');
        return native;
      } } : {},
  });
  return exports;
}

test('Watch Health setup wrapper distinguishes delivery receipt from missing module or failure', async () => {
  let calls = 0;
  for (const [native, expected] of [
    [null, 'unavailable'],
    [{}, 'unavailable'],
    [{ requestHealthSetup: async () => false }, 'unavailable'],
    [{ requestHealthSetup: async () => { calls += 1; return true; } }, 'queued'],
    [{ requestHealthSetup: async () => { throw new Error('unreachable'); } }, 'failed'],
  ] as const) {
    assert.equal(await loadModule(native).requestStrideWatchHealthSetup(), expected);
  }
  assert.equal(calls, 1);
});

test('Health setup cannot auto-launch Watch, replace workout context or start beneath the permission sheet', () => {
  const bridge = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');
  const setup = bridge.slice(bridge.indexOf('AsyncFunction("requestHealthSetup")'), bridge.indexOf('AsyncFunction("startPhoneCadence")'));
  assert.match(setup, /sendCommand\("setupHealthPermissions"/);
  assert.doesNotMatch(setup, /launchWatchAppIfNeeded|startWatchApp|updateApplicationContext/);
  const context = bridge.slice(bridge.indexOf('private func shouldPublishAsLatestContext'), bridge.indexOf('private func recordError'));
  assert.doesNotMatch(context, /setupHealthPermissions/);
  const watch = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const start = watch.slice(watch.indexOf('func startWorkout('), watch.indexOf('func selectWorkoutKind'));
  assert.ok(start.indexOf('healthSetup.inFlightId == nil') < start.indexOf('armStartWatchdog()'));
  assert.match(start, /return "health_setup_in_progress"/);
  assert.match(watch, /case "setupHealthPermissions":[\s\S]*?healthSetup.enqueue/);
  const app = read('targets/StrideOSWatch/StrideOSWatchApp.swift');
  assert.match(app, /#if DEBUG\s+StrideWatchDiagnostics\(\)/);
  assert.match(app, /#else\s+if let error = workout.lastError/);
  assert.doesNotMatch(app, /Enable Workout Metrics/);
});
