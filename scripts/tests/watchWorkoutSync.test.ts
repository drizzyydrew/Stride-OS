import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const watchManager = readFileSync('targets/StrideOSWatch/StrideWatchWorkoutManager.swift', 'utf8');
const moduleIndex = readFileSync('modules/stride-watch-connectivity/src/index.ts', 'utf8');
const bridge = readFileSync('src/components/watch/WatchWorkoutBridge.tsx', 'utf8');
const activeOutdoorStore = readFileSync('src/store/activeActivityStore.ts', 'utf8');
const activeRunStore = readFileSync('src/store/activeRunStore.ts', 'utf8');
const activeStrengthStore = readFileSync('src/store/activeStrengthSessionStore.ts', 'utf8');
const activityStore = readFileSync('src/store/activityStore.ts', 'utf8');
const runScreen = readFileSync('app/(tabs)/training/index.tsx', 'utf8');
const outdoorStartScreen = readFileSync('app/(tabs)/activity/start.tsx', 'utf8');
const appConfig = JSON.parse(readFileSync('app.json', 'utf8')) as { expo?: { ios?: { buildNumber?: string } } };
const xcodeProject = readFileSync('ios/StrideOSRunLiftRecover.xcodeproj/project.pbxproj', 'utf8');
const iosConfigPlugin = readFileSync('plugins/withIosWorkoutBackgroundModes.js', 'utf8');
const requirePlugin = createRequire(import.meta.url);
const { syncNativeTargetBuildNumbers } = requirePlugin('../../plugins/withIosWorkoutBackgroundModes.js') as {
  syncNativeTargetBuildNumbers: (project: unknown, buildNumber?: string) => void;
};

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('Apple Watch workouts preserve phone-provided identity and phone payloads accept environment', () => {
  assert.match(watchManager, /workoutInstanceId: String\?/);
  assert.match(watchManager, /workoutInstanceId \?\? "watch_/);
  assert.match(watchManager, /self\.workoutInstanceId = resolvedId/);
  assert.match(watchManager, /if let workoutInstanceId \{/);
  assert.match(watchManager, /payload\["workoutInstanceId"\] = workoutInstanceId/);
  assert.match(moduleIndex, /environment\?: string/);
  assert.match(moduleIndex, /environment: typeof event\?\.environment === 'string'/);
});

test('watch workout state events only control existing phone active-session stores', () => {
  assert.match(bridge, /addStrideWatchWorkoutStateListener/);
  assert.match(bridge, /handleWatchWorkoutState\(event\)/);
  assert.match(bridge, /event\.workoutKind === 'run'/);
  assert.match(bridge, /if \(!activeRun\.isActive\) return/);
  assert.match(bridge, /if \(active\.isActive && active\.activityType === outdoorType\) \{/);
  assert.match(bridge, /return active\.workoutInstanceId \?\? active\.activityId/);
  assert.doesNotMatch(bridge, /useActiveRunStore\.getState\(\)\.startRun\(null/);
  assert.doesNotMatch(bridge, /startLocationTracking\(\)/);
  assert.doesNotMatch(bridge, /useActiveActivityStore\.getState\(\)\.start\(/);
  assert.doesNotMatch(bridge, /useActiveStrengthSessionStore\.getState\(\)\.startSession/);
  assert.match(bridge, /pause\('manual'\)/);
  assert.match(bridge, /resume\('manual'\)/);
  assert.match(bridge, /requestCompletion\(\)/);
  assert.match(bridge, /enqueueVoiceCue\('Pausing workout\.', 'interval'\)/);
  assert.match(bridge, /enqueueVoiceCue\('Resuming workout\.', 'interval'\)/);
});

test('watch events reach JS through the Expo module emitter, not NativeEventEmitter', () => {
  // Expo modules are not in react-native NativeModules under the new
  // architecture, so a NativeEventEmitter built from NativeModules is null and
  // every listener silently never fires.
  assert.doesNotMatch(moduleIndex, /NativeEventEmitter/);
  assert.doesNotMatch(moduleIndex, /NativeModules/);
  assert.match(moduleIndex, /nativeModule\.addListener\(eventName, listener\)/);
  for (const eventName of ['onWatchStatus', 'onWatchHeartRate', 'onWatchWorkoutState', 'onWatchError', 'onWatchAck']) {
    assert.match(moduleIndex, new RegExp(`subscribe\\('${eventName}'`));
  }
  const watchModule = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');
  assert.match(watchModule, /Events\("onWatchStatus", "onWatchHeartRate", "onWatchWorkoutState", "onWatchError", "onWatchAck"\)/);
});

test('exactly one place applies watch pause/resume/end to the run store', () => {
  // WatchWorkoutBridge (mounted in app/_layout.tsx) owns run control. The
  // training screen only mirrors status for display.
  assert.match(read('app/_layout.tsx'), /<WatchWorkoutBridge \/>/);
  assert.doesNotMatch(runScreen, /addStrideWatchHeartRateListener/);
  const listenerStart = runScreen.indexOf('addStrideWatchStatusListener(setWatchStatus)');
  assert.ok(listenerStart > 0);
  const listenerBlock = runScreen.slice(listenerStart, runScreen.indexOf('activateStrideWatchConnectivity()', listenerStart));
  assert.doesNotMatch(listenerBlock, /pauseRun\(/);
  assert.doesNotMatch(listenerBlock, /resumeRun\(/);
  assert.doesNotMatch(listenerBlock, /requestCompletion\(/);
  assert.doesNotMatch(listenerBlock, /finishRun\(/);
  // A watch-ended run must go through the normal completion path so the
  // activity is saved; finishRun() would reset the run and log nothing.
  const runEndedStart = bridge.indexOf("if (event.state === 'ended') {\n      const activeRun");
  assert.ok(runEndedStart > 0);
  const runEnded = bridge.slice(runEndedStart, bridge.indexOf('const outdoorType = outdoorTypeFromWatch(event.workoutKind);', runEndedStart));
  assert.match(runEnded, /requestCompletion\(\)/);
  assert.doesNotMatch(runEnded, /finishRun\(\)/);
});

test('watch manager mutates state on the main thread and ends a session at most once', () => {
  const app = read('targets/StrideOSWatch/StrideOSWatchApp.swift');
  // Every sender hops to main before touching @Published state or the outbound queue.
  for (const fn of ['sendHeartRate', 'sendWorkoutState', 'sendEndedStateOnce', 'sendToPhone', 'flushQueuedOutboundPayloads']) {
    const body = watchManager.slice(watchManager.indexOf(`private func ${fn}(`));
    assert.match(body.slice(0, 260), /guard Thread\.isMainThread else/, `${fn} must hop to main`);
  }
  assert.match(watchManager, /DispatchQueue\.main\.async \{[\s\S]{0,220}self\.handleWorkoutSessionStateChange\(toState\)/);
  assert.match(watchManager, /DispatchQueue\.main\.async \{\s+self\.handleActivationCompleted\(error: error\)/);
  // "running" is published only from the HealthKit delegate, not also from beginWorkout.
  const beginBody = watchManager.slice(watchManager.indexOf('private func beginWorkout'), watchManager.indexOf('private func requestAuthorization'));
  assert.doesNotMatch(beginBody, /sendWorkoutState\("running"\)/);
  assert.match(watchManager, /case \.running:[\s\S]{0,200}sendWorkoutState\("running"\)/);
  // end() is idempotent and guarded by HealthKit session state.
  const endBody = watchManager.slice(watchManager.indexOf('func endWorkout()'), watchManager.indexOf('private func armStartWatchdog'));
  assert.match(endBody, /guard !isEnding else \{ return \}/);
  assert.match(endBody, /session\.state == \.running \|\| session\.state == \.paused \|\| session\.state == \.prepared/);
  assert.match(endBody, /isEnding = true/);
  assert.match(watchManager, /isEnding = false/);
  // Commands arrive over several channels; dedupe against a set, not just the last key.
  assert.match(watchManager, /handledPhoneCommandKeys\.contains\(commandKey\)/);
  assert.doesNotMatch(watchManager, /lastHandledPhoneCommandKey/);
  // The watch never starts a workout on its own.
  assert.doesNotMatch(app, /workout\.startWorkout\(/);
});

test('phone and watch expose runtime sync diagnostics and command acks', () => {
  const watchModule = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');
  const app = read('targets/StrideOSWatch/StrideOSWatchApp.swift');
  // Phone: delivery method, ack, and last watch state are tracked under a lock.
  assert.match(watchModule, /private let lock = NSLock\(\)/);
  for (const method of ['sendMessage', 'transferUserInfo', 'queued']) {
    assert.match(watchModule, new RegExp(`method: "${method}"`));
  }
  assert.match(watchModule, /"lastCommandMethod"/);
  assert.match(watchModule, /"lastAckAccepted"/);
  assert.match(watchModule, /case StrideWatchMessageType\.commandAck:/);
  assert.match(watchModule, /emit\("onWatchAck"/);
  assert.match(moduleIndex, /lastCommandMethod/);
  assert.match(moduleIndex, /addStrideWatchAckListener/);
  assert.match(runScreen, /<WatchStatusDiagnostics status=\{watchStatus\}/);
  // Watch: acks every phone control command and shows diagnostics on screen.
  assert.match(watchManager, /"type": "commandAck"/);
  assert.match(watchManager, /sendCommandAck\(command: type, message: message, reason: reason\)/);
  for (const reason of ['already_active', 'already_starting', 'no_active_workout', 'id_mismatch']) {
    assert.match(watchManager, new RegExp(`"${reason}"`));
  }
  assert.match(app, /StrideWatchDiagnostics\(\)/);
  for (const label of ['connectivityLabel', 'lastCommandLabel', 'healthKitLabel', 'workoutIdLabel']) {
    assert.match(watchManager, new RegExp(`var ${label}: String`));
    assert.match(app, new RegExp(`workout\\.${label}`));
  }
});

test('late or queued watch pause/resume events are ignored but ended is never dropped', () => {
  assert.match(bridge, /const WATCH_CONTROL_EVENT_MAX_AGE_MS = 5 \* 1000;/);
  const guardFn = bridge.slice(bridge.indexOf('function isStaleWatchControlEvent'), bridge.indexOf('function rememberCompletedWatchWorkout'));
  assert.ok(guardFn.length > 0);
  assert.match(guardFn, /if \(event\.state !== 'paused' && event\.state !== 'running'\) return false;/);
  assert.match(guardFn, /if \(event\.queued\) return true;/);
  assert.match(guardFn, /Date\.now\(\) - event\.timestamp > WATCH_CONTROL_EVENT_MAX_AGE_MS/);
  const handler = bridge.slice(bridge.indexOf('function handleWatchWorkoutState'));
  assert.match(handler.slice(0, 300), /if \(isStaleWatchControlEvent\(event\)\) return;/);
});

test('watch falls back to transferUserInfo for state, acks, and errors but not heart rate', () => {
  const sendBody = watchManager.slice(watchManager.indexOf('private func sendToPhone('), watchManager.indexOf('private func flushQueuedOutboundPayloads'));
  assert.match(sendBody, /session\.sendMessage\(payload, replyHandler: nil\)/);
  assert.match(sendBody, /if type == "workoutState" \|\| type == "commandAck" \|\| type == "error" \{/);
  assert.match(sendBody, /WCSession\.default\.transferUserInfo\(queuedPayload\)/);
  assert.doesNotMatch(sendBody, /type == "heartRate"/);
});

test('HealthKit callbacks from a previous session cannot end or clear the current one', () => {
  assert.match(watchManager, /guard workoutSession === self\.session else \{ return \}\s+self\.handleWorkoutSessionStateChange\(toState\)/);
  assert.match(watchManager, /guard workoutSession === self\.session else \{ return \}\s+self\.handleWorkoutSessionFailure\(error\)/);
});

test('watch face keeps controls above rounded bottom edge and applies latest phone command context', () => {
  const watchApp = read('targets/StrideOSWatch/StrideOSWatchApp.swift');
  const watchManager = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const watchModule = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');
  const watchInfoPlist = read('targets/StrideOSWatch/Info.plist');
  const watchTargetConfig = read('targets/StrideOSWatch/expo-target.config.js');

  assert.match(watchApp, /ScrollView/);
  assert.match(watchApp, /\.scenePadding\(\.horizontal\)/);
  assert.match(watchApp, /\.scrollIndicators\(\.hidden\)/);
  assert.doesNotMatch(watchApp, /GeometryReader/);
  assert.doesNotMatch(watchApp, /prepareConnectivityAfterLaunch/);
  assert.match(watchManager, /didReceiveApplicationContext/);
  assert.match(watchManager, /recordLocalError/);
  assert.match(watchApp, /Start from iPhone/);
  assert.match(watchApp, /Start workouts from iPhone/);
  assert.match(watchApp, /prepareForPhoneControl/);
  assert.doesNotMatch(watchApp, /workout\.startWorkout\(/);
  assert.match(watchModule, /updateApplicationContext/);
  assert.match(watchModule, /sendReachableOrFallback/);
  assert.match(watchModule, /session\.transferUserInfo\(message\)/);
  assert.match(watchModule, /shouldPublishAsLatestContext/);
  assert.doesNotMatch(watchModule, /session\.activationState != \.activated \|\|/);
  assert.match(watchInfoPlist, /WKBackgroundModes/);
  assert.match(watchInfoPlist, /workout-processing/);
  assert.match(watchTargetConfig, /WKBackgroundModes: \['workout-processing'\]/);
});

test('embedded native targets use the current iOS build number', () => {
  const buildNumber = appConfig.expo?.ios?.buildNumber;
  assert.ok(buildNumber);

  const extensionBuildNumbers = [...xcodeProject.matchAll(/buildSettings = \{([\s\S]*?)\n\t\t\t\};/g)]
    .map(match => match[1])
    .filter(block => /INFOPLIST_FILE = \.\.\/targets\/(?:StrideOSWatch|StrideRunLiveActivity)\/Info\.plist;/.test(block))
    .map(block => {
      const version = block.match(/CURRENT_PROJECT_VERSION = (\d+);/)?.[1];
      assert.ok(version, `Missing CURRENT_PROJECT_VERSION in extension block:\n${block}`);
      return version;
    });

  assert.ok(extensionBuildNumbers.length >= 4);
  assert.deepEqual([...new Set(extensionBuildNumbers)], [buildNumber]);
  assert.match(iosConfigPlugin, /withXcodeProject/);
  assert.match(iosConfigPlugin, /syncNativeTargetBuildNumbers/);
  assert.match(iosConfigPlugin, new RegExp('StrideOSWatch/Info\\.plist'));
  assert.match(iosConfigPlugin, new RegExp('StrideRunLiveActivity/Info\\.plist'));
});

test('config plugin only syncs embedded StrideOS native target build numbers', () => {
  const buildNumber = appConfig.expo?.ios?.buildNumber;
  assert.ok(buildNumber);
  const project = {
    hash: {
      project: {
        objects: {
          XCBuildConfiguration: {
            WATCH_DEBUG: {
              buildSettings: {
                INFOPLIST_FILE: '../targets/StrideOSWatch/Info.plist',
                CURRENT_PROJECT_VERSION: '63',
              },
            },
            LIVE_ACTIVITY_RELEASE: {
              buildSettings: {
                INFOPLIST_FILE: '../targets/StrideRunLiveActivity/Info.plist',
                CURRENT_PROJECT_VERSION: '63',
              },
            },
            PHONE_RELEASE: {
              buildSettings: {
                INFOPLIST_FILE: 'StrideOSRunLiftRecover/Info.plist',
                CURRENT_PROJECT_VERSION: '1',
              },
            },
            WATCH_DEBUG_comment: 'Debug',
          },
        },
      },
    },
  };

  syncNativeTargetBuildNumbers(project, buildNumber);

  const configs = project.hash.project.objects.XCBuildConfiguration;
  assert.equal(configs.WATCH_DEBUG.buildSettings.CURRENT_PROJECT_VERSION, buildNumber);
  assert.equal(configs.LIVE_ACTIVITY_RELEASE.buildSettings.CURRENT_PROJECT_VERSION, buildNumber);
  assert.equal(configs.PHONE_RELEASE.buildSettings.CURRENT_PROJECT_VERSION, '1');
});

test('phone session stores can reuse watch-provided workout instance ids', () => {
  assert.match(activeRunStore, /workoutInstanceId\?:\s+string \| null/);
  assert.match(activeRunStore, /startedAtMs\?:\s+number \| null/);
  assert.match(activeRunStore, /config\?\.workoutInstanceId \?\? buildWorkoutInstanceId/);
  assert.match(activeOutdoorStore, /workoutInstanceId\?: string/);
  assert.match(activeOutdoorStore, /input\.workoutInstanceId \?\? buildWorkoutInstanceId/);
  assert.match(activeStrengthStore, /workoutInstanceId\?: string/);
  assert.match(activeStrengthStore, /input\.workoutInstanceId \?\? buildWorkoutInstanceId/);
});

test('watch and phone completion handling is idempotent for duplicate stop events', () => {
  assert.match(bridge, /completedWatchWorkoutEvents/);
  assert.match(bridge, /rememberCompletedWatchWorkout\(id, event\.timestamp\)/);
  // Run completion goes through requestCompletion() -> training stop(), which saves once.
  assert.doesNotMatch(bridge, /finishRun\(\)/);
  assert.match(bridge, /if \(!activeRun\.completionRequestedAt\) \{/);
  assert.match(bridge, /if \(!active\.completionRequestedAt\) \{/);
  assert.match(bridge, /if \(!useActiveStrengthSessionStore\.getState\(\)\.completionRequestedAt\) \{/);
  assert.match(activityStore, /function nearDuplicateTrackedIndex/);
  assert.match(activityStore, /Math\.abs\(item\.startTime - activity\.startTime\) <= 180_000/);
  assert.match(activityStore, /Math\.max\(120, distance \* 0\.05\)/);
});

test('live run and outdoor activity saves do not create fresh ids for repeated finish events', () => {
  assert.match(runScreen, /function liveRunCompletionKey/);
  assert.match(runScreen, /liveRunCompletionKey\('gps_run', finalState\.workoutInstanceId, finalState\.startTime\)/);
  assert.match(runScreen, /liveRunCompletionKey\(\s*'treadmill_run',/);
  assert.doesNotMatch(runScreen, /const id = `gps_run_\$\{Date\.now\(\)\}`/);
  assert.doesNotMatch(runScreen, /const id = `treadmill_run_\$\{Date\.now\(\)\}`/);
  assert.match(runScreen, /stopInFlightRef/);
  assert.match(outdoorStartScreen, /saveInFlightRef/);
});

test('watch workout target stays on the build-66 HealthKit path while phone commands can queue safely', () => {
  const watchManager = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const watchModule = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');

  assert.doesNotMatch(watchManager, /watchOnlyActive/);
  assert.doesNotMatch(watchManager, /watchOnlyPaused/);
  assert.doesNotMatch(watchManager, /private func startWatchOnlyWorkout/);
  assert.match(watchManager, /isStartingWorkout/);
  assert.doesNotMatch(watchManager, /private override init\(\) \{\s*super\.init\(\)\s*activateWatchConnectivity\(\)\s*\}/);
  assert.doesNotMatch(watchManager, /func prepareConnectivityAfterLaunch/);
  assert.match(watchManager, /func prepareForPhoneControl\(\)/);
  assert.match(watchManager, /queuedOutboundPayloads/);
  assert.match(watchManager, /scheduleConnectivityActivation\(reportErrors: false, delay: 1\.5\)/);
  assert.match(watchManager, /scheduleConnectivityActivation\(reportErrors: false\)/);
  assert.doesNotMatch(watchManager, /queuedOutboundPayloads\.append\(payload\)\s*session\.activate\(\)/);
  assert.match(watchManager, /workoutInstanceId \?\? "watch_\\\(kind\.rawValue\)_/);
  assert.match(watchManager, /sendEndedStateOnce/);
  assert.match(watchManager, /isStaleControlCommand/);
  assert.match(watchManager, /handledPhoneCommandKeys/);
  assert.match(watchManager, /let session = try HKWorkoutSession\(healthStore: healthStore, configuration: configuration\)/);
  assert.match(watchManager, /builder\.beginCollection\(withStart: now\)/);
  assert.match(watchManager, /session\.startActivity\(with: now\)/);
  assert.match(watchManager, /session\.transferUserInfo\(queuedPayload\)/);
  assert.match(watchManager, /recordLocalError/);
  assert.match(watchManager, /controlRejection/);
  assert.match(watchManager, /guard let session, session\.state == \.running else/);
  assert.match(watchManager, /guard let session, session\.state == \.paused else/);
  assert.match(moduleIndex, /startWorkout/);
  assert.match(watchModule, /session\.isPaired && session\.isWatchAppInstalled/);
  assert.match(moduleIndex, /endWorkout\(workoutInstanceId \?\? null\)/);
  assert.match(moduleIndex, /pauseWorkout\(workoutInstanceId \?\? null\)/);
  assert.match(runScreen, /endStrideWatchRun\(finalState\.workoutInstanceId\)/);
  assert.match(watchModule, /pendingCommands\.append\(message\)/);
  assert.match(watchModule, /flushPendingCommandsIfPossible\(\)/);
  assert.match(watchModule, /transferUserInfo\(command\)/);
});

test('run screen activates Apple Watch automatically without exposing the manual sync control', () => {
  assert.match(runScreen, /activateStrideWatchConnectivity\(\)/);
  assert.doesNotMatch(runScreen, /async function syncWatchNow/);
  assert.doesNotMatch(runScreen, /Sync Watch/);
  assert.doesNotMatch(runScreen, /accessibilityLabel="Sync Apple Watch"/);
});

test('watch pause resume and stop are applied to the active run store by the bridge only', () => {
  assert.match(bridge, /useActiveRunStore\.getState\(\)\.pauseRun\('manual'\)/);
  assert.match(bridge, /useActiveRunStore\.getState\(\)\.resumeRun\('manual'\)/);
  assert.match(bridge, /useActiveRunStore\.getState\(\)\.requestCompletion\(\)/);
  assert.match(bridge, /activeRun\.workoutInstanceId !== event\.workoutInstanceId/);
  // The run screen keeps mirroring phone auto-pause out to the watch, but no
  // longer applies watch events to the store (that double-applied them).
  assert.match(runScreen, /lastMirroredAutoPauseDecisionRef/);
  assert.match(runScreen, /pauseStrideWatchRun\(workoutInstanceId\)/);
  assert.match(runScreen, /resumeStrideWatchRun\(workoutInstanceId\)/);
  assert.doesNotMatch(runScreen, /useActiveRunStore\.getState\(\)\.pauseRun\('manual'\)/);
  assert.doesNotMatch(runScreen, /useActiveRunStore\.getState\(\)\.resumeRun\('manual'\)/);
  assert.doesNotMatch(runScreen, /useActiveRunStore\.getState\(\)\.requestCompletion\(\)/);
});
