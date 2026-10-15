import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');
const watch = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');

test('Watch launch keeps baseline scopes; new permission sheets require foreground idle setup', () => {
  const startupAuthorization = watch.slice(watch.indexOf('private func requestAuthorization('), watch.indexOf('private func optionalMetricIdentifiers('));
  for (const scope of ['.heartRate', '.activeEnergyBurned', '.distanceWalkingRunning', '.distanceCycling']) assert.ok(startupAuthorization.includes(scope));
  assert.doesNotMatch(startupAuthorization, /optionalMetricIdentifiers|distanceDownhillSnowSports|runningPower|cyclingPower/);
  const setup = watch.slice(watch.indexOf('func enableWorkoutMetrics()'), watch.indexOf('func cycleMetricPage()'));
  assert.match(setup, /guard !isActive, !isStartingWorkout, WKExtension.shared\(\).applicationState == .active/);
  assert.match(setup, /optionalMetricIdentifiers/);
  assert.match(read('targets/StrideOSWatch/StrideOSWatchApp.swift'), /Button\("Enable Workout Metrics".*workout.enableWorkoutMetrics\(\)/);
});

test('Watch cadence callback belongs to the session, not the replaceable provisional recording ID', () => {
  const cadence = watch.slice(watch.indexOf('private func startCadenceIfAvailable('), watch.indexOf('private func sendTelemetry('));
  assert.match(cadence, /let cadenceSession = session/);
  assert.match(cadence, /self.session === cadenceSession/);
  assert.doesNotMatch(cadence, /workoutInstanceId ==/);
  const adoption = watch.slice(watch.indexOf('private func adoptPhoneStartIfProvisional'), watch.indexOf('private var isDiscardingCurrentSession'));
  assert.ok(adoption.indexOf('workoutInstanceId = id') < adoption.indexOf('builder?.addMetadata(recordingMetadata'));
  assert.match(watch, /metadata\["StrideOSWorkoutInstanceId"\] = workoutInstanceId/);
  assert.match(watch, /builder.addMetadata\(recordingMetadata\(for: kind\)\)/);
  const activityStart = read('app/(tabs)/activity/start.tsx');
  const nativeStart = activityStart.slice(activityStart.indexOf('const started = useActiveActivityStore.getState();'),
    activityStart.indexOf('async function saveAndFinish()'));
  assert.match(nativeStart, /startOutdoorLiveActivity\(\{[\s\S]*?workoutInstanceId: started.workoutInstanceId \?\? undefined/);
  assert.match(nativeStart, /startStrideWatchWorkout\(\{[\s\S]*?workoutInstanceId: started.workoutInstanceId \?\? null/);
});

test('all run ActivityKit updates schedule sensor expiry, and both widget zone badges honor stale state', () => {
  const native = read('modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift');
  const runOnly = native.slice(native.indexOf('AsyncFunction("startOutdoor")'), native.indexOf('AsyncFunction("startStrength")'));
  assert.equal((runOnly.match(/staleDate: state.telemetryStaleDate\(\)/g) ?? []).length, 4);
  assert.doesNotMatch(runOnly, /staleDate: Date\(\).addingTimeInterval\(90\)/);
  const intents = read('targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift');
  assert.match(intents, /state.heartRateObservedAt = state.updatedAt.map/);
  assert.match(intents, /staleDate: state.telemetryStaleDate\(\)/);
  const widget = read('targets/StrideRunLiveActivity/StrideRunLiveActivity.swift');
  assert.equal((widget.match(/ZoneBadge\(label: !context.isStale && heartRateIsFresh/g) ?? []).length, 2);
  assert.match(widget, /!context.isStale, liveMetricIsFresh\(context.state, observedAt: context.state.powerObservedAt\)/);
  assert.match(widget, /!context.isStale, liveMetricIsFresh\(context.state, observedAt: context.state.cadenceObservedAt\)/);
});

test('production Swift deadline math expires at the earliest observation plus ten seconds', { skip: process.platform !== 'darwin' }, () => {
  const core = read('modules/stride-live-activity/ios/Core/StrideRunActivityAttributes.swift')
    .replace('import ActivityKit', '').replace('StrideRunActivityAttributes: ActivityAttributes', 'StrideRunActivityAttributes');
  const native = read('modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift');
  const matcherStart = native.indexOf('private static func matchesSession(');
  const matcher = native.slice(matcherStart, native.indexOf('\n  @available', matcherStart))
    .replace('private static func', 'static func');
  const probe = `
let now = Date(timeIntervalSince1970: 1000)
var state = StrideRunActivityAttributes.ContentState(elapsedSeconds: 30, distanceMiles: 0, averagePace: "--", heartRate: 120,
  zoneLabel: "Z2", zoneStatus: "in", status: "Running", updatedAt: 999)
state.activityType = "running"
state.heartRateObservedAt = 995000
precondition(state.telemetryStaleDate(now: now).timeIntervalSince1970 == 1005)
state.cadenceValue = 160
state.cadenceObservedAt = 993000
precondition(state.telemetryStaleDate(now: now).timeIntervalSince1970 == 1003)
state.powerWatts = 200
precondition(state.telemetryStaleDate(now: now) == now)
state.powerObservedAt = 989000
precondition(state.telemetryStaleDate(now: now).timeIntervalSince1970 == 999)
state.powerObservedAt = Double.infinity
precondition(state.telemetryStaleDate(now: now) == now)
state.powerWatts = nil
state.cadenceValue = nil
state.heartRateObservedAt = nil
precondition(state.telemetryStaleDate(now: now) == now)
state.activityType = nil
precondition(state.telemetryStaleDate(now: now).timeIntervalSince1970 == 1009)
state.heartRate = 0
precondition(state.telemetryStaleDate(now: now).timeIntervalSince1970 == 1090)
state.workoutInstanceId = "new"
state.sessionSource = "running"
precondition(!Matcher.matchesSession(["workoutInstanceId": "old", "sessionSource": "running"], state: state))
precondition(Matcher.matchesSession(["workoutInstanceId": "new", "sessionSource": "running"], state: state))
precondition(!Matcher.matchesSession(["workoutInstanceId": "new", "sessionSource": "outdoor"], state: state))
state.workoutInstanceId = nil
state.sessionId = nil
precondition(!Matcher.matchesSession(["workoutInstanceId": "old", "sessionSource": "running"], state: state))
state.sessionId = "new-session"
precondition(!Matcher.matchesSession(["sessionId": "old-session", "sessionSource": "running"], state: state))
precondition(Matcher.matchesSession(["sessionId": "new-session", "sessionSource": "running"], state: state))
print("deadline cases passed")
`;
  const result = spawnSync('xcrun', ['swift', '-'], { input: `${core}\nstruct Matcher {\n${matcher}\n}\n${probe}`, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /deadline cases passed/);
});
