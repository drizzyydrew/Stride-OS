import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as telemetry from '../../src/utils/outdoorTelemetry';

function harness() {
  let now = 100_000;
  let live: any;
  let effectDependencies: unknown[] | undefined;
  let cleanup: (() => void) | undefined;
  const listeners = new Map<string, Set<(event: any) => void>>();
  const timers = new Map<number, { callback: () => void; period: number }>();
  const saved: { id: string; samples: Partial<telemetry.OutdoorTelemetry> }[] = [];
  const cadenceStarts: string[] = [], cadenceStops: string[] = [];
  let maximumExistingCache = 0;
  let nextTimer = 0;
  const callbackRef = { current: undefined as any };
  const subscribe = (name: string) => (callback: (event: any) => void) => {
    const group = listeners.get(name) ?? new Set();
    group.add(callback); listeners.set(name, group);
    return { remove: () => group.delete(callback) };
  };
  class Clock extends Date { static now() { return now; } }
  const native = {
    addStrideWatchHeartRateListener: subscribe('hr'), addStrideWatchTelemetryListener: subscribe('telemetry'),
    addPhoneCadenceListener: subscribe('cadence'),
    startPhoneCadence: async (id: string) => { cadenceStarts.push(id); },
    stopPhoneCadence: (id: string) => { cadenceStops.push(id); },
  };
  const filename = resolve('src/hooks/useOutdoorTelemetry.ts');
  const require = createRequire(filename);
  const module = { exports: {} as any };
  const mocks: Record<string, any> = {
    react: {
      useRef: () => callbackRef,
      useState: (initial: unknown) => { live ??= initial; return [live, (value: unknown) => { live = value; }]; },
      useEffect: (effect: () => (() => void) | undefined, dependencies: unknown[]) => {
        if (effectDependencies && dependencies.every((value, index) => value === effectDependencies![index])) return;
        cleanup?.(); effectDependencies = dependencies; cleanup = effect();
      },
    },
    '../../modules/stride-watch-connectivity/src': native,
    '../lib/healthKit': { getLatestHeartRateSample: async () => null },
    '../store/liveSensorStore': { useLiveSensorStore: { subscribe: () => () => undefined } },
    '../utils/outdoorTelemetry': {
      ...telemetry,
      appendTelemetrySamples: (existing: telemetry.OutdoorTelemetry, incoming: Partial<telemetry.OutdoorTelemetry>, startedAt: number, at: number) => {
        maximumExistingCache = Math.max(maximumExistingCache, existing.rawHeartRateSamples.length, existing.cadenceSamples.length, existing.powerSamples.length);
        return telemetry.appendTelemetrySamples(existing, incoming, startedAt, at);
      },
    },
  };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), Date: Clock,
    setInterval: (callback: () => void, period: number) => { const id = ++nextTimer; timers.set(id, { callback, period }); return id; },
    clearInterval: (id: number) => { timers.delete(id); },
  });
  let input = { workoutInstanceId: 'original-run', startedAt: now, activityType: 'running',
    isActive: true, isPaused: false, healthKitEnabled: false,
    onSamples: (id: string, samples: Partial<telemetry.OutdoorTelemetry>) => saved.push({ id, samples: structuredClone(samples) }) };
  function render(changes: Partial<typeof input> = {}) { input = { ...input, ...changes }; module.exports.useOutdoorTelemetry(input); }
  render();
  return {
    render, saved, cadenceStarts, cadenceStops,
    live: () => structuredClone(live),
    maximumExistingCache: () => maximumExistingCache,
    setNow: (value: number) => { now = value; },
    emit: (name: string, event: Record<string, unknown>) => {
      for (const listener of listeners.get(name) ?? []) listener({ workoutInstanceId: input.workoutInstanceId, timestamp: now, ...event });
    },
    tick: () => { for (const timer of [...timers.values()]) if (timer.period === 1000) timer.callback(); },
    listener: (name: string) => [...listeners.get(name) ?? []][0]!,
    close: () => cleanup?.(),
  };
}

test('display cache matches full-history selection through a twelve-minute run while every original sample reaches persistence', () => {
  const h = harness();
  let baseline = telemetry.EMPTY_OUTDOOR_TELEMETRY;
  const expected: typeof h.saved = [];
  for (let second = 0; second < 720; second++) {
    const now = 100_000 + second * 1000;
    h.setNow(now);
    const additions: Partial<telemetry.OutdoorTelemetry>[] = [
      { rawHeartRateSamples: [{ timestamp: now, bpm: 100 + second % 60, source: 'apple_watch' }] },
      { cadenceSamples: [{ timestamp: now, kind: 'steps', cadenceSpm: 160, source: 'phone_motion' }] },
      { powerSamples: [{ timestamp: now, watts: 230, sport: 'running', source: 'apple_watch', kind: 'device_estimated' }] },
    ];
    h.emit('hr', { heartRate: 100 + second % 60 });
    h.emit('cadence', { cadenceSpm: 160 });
    h.emit('telemetry', { powerWatts: 230, powerSport: 'running', powerKind: 'device_estimated' });
    for (const samples of additions) {
      const valid = telemetry.appendTelemetrySamples(telemetry.EMPTY_OUTDOOR_TELEMETRY, samples, 100_000, now);
      expected.push({ id: 'original-run', samples: valid });
      baseline = telemetry.appendTelemetrySamples(baseline, valid, 100_000, now);
    }
    h.tick();
    assert.deepEqual(h.live(), telemetry.selectLiveTelemetry(baseline, 100_000, now));
  }
  assert.deepEqual(h.saved, expected);
  assert.equal(h.saved.length, 2160);
  assert.ok(h.maximumExistingCache() <= 11, `cache retained ${h.maximumExistingCache()} samples per metric`);
  h.setNow(831_001); h.tick();
  assert.deepEqual(h.live(), { heartRateBpm: null, heartRateSample: undefined, cadenceSample: undefined, powerSample: undefined });
  h.close();
});

test('freshness boundaries, out-of-order/equal packets, source fallback and future/old packets retain baseline behavior', () => {
  const h = harness();
  h.setNow(120_000);
  h.emit('cadence', { timestamp: 112_000, cadenceSpm: 170 });
  h.emit('telemetry', { timestamp: 110_000, cadenceSpm: 155 });
  assert.equal(h.live().cadenceSample.source, 'apple_watch');
  h.tick();
  assert.equal(h.live().cadenceSample.timestamp, 110_000, 'exact ten-second boundary remains fresh');
  h.setNow(120_001); h.tick();
  assert.equal(h.live().cadenceSample.source, 'phone_motion', 'fallback uses an actual still-fresh source');
  h.emit('hr', { timestamp: 119_000, heartRate: 145 });
  h.emit('hr', { timestamp: 118_000, heartRate: 130 });
  assert.equal(h.live().heartRateBpm, 145);
  h.emit('hr', { timestamp: 119_000, heartRate: 147 });
  assert.equal(h.live().heartRateBpm, 147, 'same source/timestamp retains last packet semantics');
  const savedCount = h.saved.length;
  h.emit('hr', { timestamp: 120_002, heartRate: 199 });
  h.emit('hr', { timestamp: 110_000, heartRate: 100 });
  h.emit('hr', { timestamp: 99_999, heartRate: 100 });
  h.emit('hr', { workoutInstanceId: 'other-run', heartRate: 199 });
  assert.equal(h.saved.length, savedCount);
  assert.equal(h.live().heartRateBpm, 147);
  const baseline = h.saved.reduce((state, item) => telemetry.appendTelemetrySamples(state, item.samples, 100_000, 120_001), telemetry.EMPTY_OUTDOOR_TELEMETRY);
  assert.deepEqual(h.live(), telemetry.selectLiveTelemetry(baseline, 100_000, 120_001));
  h.close();
});

test('clock rollback clears only display cache and accepts a new valid observation without altering saved timestamps', () => {
  const h = harness();
  h.setNow(120_000); h.emit('hr', { heartRate: 145 });
  const before = structuredClone(h.saved);
  h.setNow(115_000); h.tick();
  assert.equal(h.live().heartRateBpm, null);
  assert.deepEqual(h.saved, before);
  h.emit('hr', { timestamp: 114_999, heartRate: 140 });
  assert.equal(h.live().heartRateBpm, 140);
  assert.equal(h.live().heartRateSample.timestamp, 114_999);
  assert.equal(h.saved[1].samples.rawHeartRateSamples![0].timestamp, 114_999);
  h.setNow(120_000); h.tick();
  assert.equal(h.live().heartRateBpm, 140, 'old pre-correction sample cannot reappear');
  h.close();
});

test('pause/resume and recording replacement remove old collectors and never transfer cached metrics to another session', () => {
  const h = harness();
  h.emit('hr', { heartRate: 140 });
  const obsolete = h.listener('hr');
  h.render({ isPaused: true });
  obsolete({ workoutInstanceId: 'original-run', timestamp: 100_000, heartRate: 199 });
  assert.equal(h.saved.length, 1);
  assert.equal(h.live().heartRateBpm, null);
  h.setNow(105_000); h.render({ isPaused: false });
  h.emit('hr', { timestamp: 104_999, heartRate: 199 });
  assert.equal(h.saved.length, 1, 'pre-resume observations cannot fill live metrics');
  h.emit('hr', { heartRate: 141 });
  assert.equal(h.live().heartRateBpm, 141);
  const previousSession = h.listener('hr');
  h.setNow(106_000); h.render({ workoutInstanceId: 'replacement-run', startedAt: 106_000 });
  previousSession({ workoutInstanceId: 'original-run', timestamp: 106_000, heartRate: 199 });
  h.emit('hr', { workoutInstanceId: 'original-run', heartRate: 199 });
  assert.equal(h.live().heartRateBpm, null);
  h.emit('hr', { heartRate: 142 });
  assert.equal(h.saved.at(-1)!.id, 'replacement-run');
  assert.equal(h.live().heartRateBpm, 142);
  h.render({ isActive: false });
  assert.equal(h.live().heartRateBpm, null);
  assert.deepEqual(h.cadenceStarts, ['original-run', 'original-run', 'replacement-run']);
  assert.deepEqual(h.cadenceStops, ['original-run', 'original-run', 'replacement-run']);
  h.close();
});
