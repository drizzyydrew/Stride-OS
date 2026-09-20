import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const watchManager = readFileSync('targets/StrideOSWatch/StrideWatchWorkoutManager.swift', 'utf8');
const moduleIndex = readFileSync('modules/stride-watch-connectivity/src/index.ts', 'utf8');
const bridge = readFileSync('src/components/watch/WatchWorkoutBridge.tsx', 'utf8');
const activeOutdoorStore = readFileSync('src/store/activeActivityStore.ts', 'utf8');
const activeStrengthStore = readFileSync('src/store/activeStrengthSessionStore.ts', 'utf8');
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

test('Apple Watch started workouts publish a shared workout identity and environment', () => {
  assert.match(watchManager, /workoutInstanceId \?\? "watch_\\\(kind\.rawValue\)_/);
  assert.match(watchManager, /private var workoutEnvironment: String = "outdoor"/);
  assert.match(watchManager, /"environment": workoutEnvironment/);
  assert.match(moduleIndex, /environment\?: string/);
  assert.match(moduleIndex, /environment: typeof event\?\.environment === 'string'/);
});

test('watch workout state events drive the phone active-session stores', () => {
  assert.match(bridge, /addStrideWatchWorkoutStateListener/);
  assert.match(bridge, /handleWatchWorkoutState\(event\)/);
  assert.match(bridge, /useActiveActivityStore\.getState\(\)\.start/);
  assert.match(bridge, /useActiveStrengthSessionStore\.getState\(\)\.startSession/);
  assert.match(bridge, /pause\('manual'\)/);
  assert.match(bridge, /resume\('manual'\)/);
  assert.match(bridge, /requestCompletion\(\)/);
  assert.match(bridge, /enqueueVoiceCue\('Pausing workout\.', 'interval'\)/);
  assert.match(bridge, /enqueueVoiceCue\('Resuming workout\.', 'interval'\)/);
});

test('watch face keeps controls above rounded bottom edge and applies latest phone command context', () => {
  const watchApp = read('targets/StrideOSWatch/StrideOSWatchApp.swift');
  const watchManager = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const watchModule = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');
  const watchInfoPlist = read('targets/StrideOSWatch/Info.plist');
  const watchTargetConfig = read('targets/StrideOSWatch/expo-target.config.js');

  assert.match(watchApp, /ScrollView/);
  assert.match(watchApp, /\.scrollIndicators\(\.hidden\)/);
  assert.match(watchManager, /didReceiveApplicationContext/);
  assert.match(watchManager, /handlePhoneCommand\(applicationContext, fromApplicationContext: true\)/);
  assert.match(watchModule, /updateApplicationContext/);
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
  assert.match(activeOutdoorStore, /workoutInstanceId\?: string/);
  assert.match(activeOutdoorStore, /input\.workoutInstanceId \?\? buildWorkoutInstanceId/);
  assert.match(activeStrengthStore, /workoutInstanceId\?: string/);
  assert.match(activeStrengthStore, /input\.workoutInstanceId \?\? buildWorkoutInstanceId/);
});

test('watch and phone completion handling is idempotent for duplicate stop events', () => {
  const endWorkoutBody = watchManager.slice(
    watchManager.indexOf('func endWorkout()'),
    watchManager.indexOf('private func beginWorkout', watchManager.indexOf('func endWorkout()')),
  );
  assert.match(watchManager, /private var endedStateSentForWorkoutInstanceId/);
  assert.match(watchManager, /sendEndedStateOnce\(\)/);
  assert.doesNotMatch(endWorkoutBody, /sendWorkoutState\("ended"\)/);
  assert.match(watchManager, /lastHandledPhoneCommandKey/);
  assert.match(bridge, /completedWatchWorkoutEvents/);
  assert.match(bridge, /rememberCompletedWatchWorkout\(id, event\.timestamp\)/);
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

test('watch workout start is guarded against pre-activation connectivity sends and duplicate starts', () => {
  const watchManager = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const watchModule = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');

  assert.match(watchManager, /@Published private\(set\) var isStartingWorkout: Bool = false/);
  assert.match(watchManager, /guard !isActive && !isStartingWorkout else \{ return \}/);
  assert.match(watchManager, /private var queuedOutboundPayloads: \[\[String: Any\]\] = \[\]/);
  assert.doesNotMatch(watchManager, /watchOnlyActive/);
  assert.doesNotMatch(watchManager, /watchOnlyPaused/);
  assert.doesNotMatch(watchManager, /private func startWatchOnlyWorkout/);
  assert.match(watchManager, /HealthKit did not start/);
  assert.match(watchManager, /guard session\.activationState == \.activated else/);
  assert.match(watchManager, /queuedOutboundPayloads\.append\(payload\)/);
  assert.match(watchManager, /flushQueuedOutboundPayloads\(\)/);
  assert.match(watchManager, /recordLocalError/);
  assert.match(watchManager, /reportFailures: false/);
  assert.match(watchManager, /isStaleControlCommand/);
  assert.match(watchManager, /stalePhoneContextWindowMs/);
  assert.match(moduleIndex, /startWorkout/);
  assert.match(watchModule, /session\.isPaired && session\.isWatchAppInstalled/);
  assert.match(watchModule, /pendingCommands\.append\(message\)/);
  assert.match(watchModule, /flushPendingCommandsIfPossible\(\)/);
  assert.match(watchModule, /transferUserInfo\(command\)/);
});

test('run screen exposes manual Apple Watch sync for queued watch activity', () => {
  assert.match(runScreen, /async function syncWatchNow/);
  assert.match(runScreen, /activateStrideWatchConnectivity\(\)/);
  assert.match(runScreen, /Sync Watch/);
});

test('run screen mirrors watch pause resume and stop into the active run store', () => {
  assert.match(runScreen, /if \(event\.state === 'paused'\) \{/);
  assert.match(runScreen, /useActiveRunStore\.getState\(\)\.pauseRun\('manual'\)/);
  assert.match(runScreen, /else if \(event\.state === 'running'\) \{/);
  assert.match(runScreen, /useActiveRunStore\.getState\(\)\.resumeRun\('manual'\)/);
  assert.match(runScreen, /else if \(event\.state === 'ended'\) \{/);
  assert.match(runScreen, /useActiveRunStore\.getState\(\)\.requestCompletion\(\)/);
});
