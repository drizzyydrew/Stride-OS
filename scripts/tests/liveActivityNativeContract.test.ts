import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync('modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift', 'utf8');
const intentSource = readFileSync('targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift', 'utf8');
const targetConfigSource = readFileSync('targets/StrideRunLiveActivity/expo-target.config.js', 'utf8');
const widgetSource = readFileSync('targets/StrideRunLiveActivity/StrideRunLiveActivity.swift', 'utf8');
const moduleIndexSource = readFileSync('modules/stride-live-activity/src/index.ts', 'utf8');

test('Build 53 uses the Build 37 Live Activity backbone without the MapKit bridge', () => {
  assert.doesNotMatch(moduleSource, /import MapKit/);
  assert.doesNotMatch(moduleSource, /getRouteDirections/);
  assert.match(moduleIndexSource, /getAppleRouteDirections\(\): Promise<AppleRouteDirectionsResult \| null>[\s\S]*return null/);
});

test('ActivityKit retains in-process IDs and rejects mismatched outdoor session updates', () => {
  assert.match(moduleSource, /private static var currentActivityId: String\?/);
  assert.match(moduleSource, /private static var currentStrengthActivityId: String\?/);
  assert.doesNotMatch(moduleSource, /StrideOS\.currentRunLiveActivityId/);
  assert.match(moduleSource, /private static func matchesSession/);
  assert.match(moduleSource, /let current = state.workoutInstanceId \?\? state.sessionId/);
  assert.match(moduleSource, /let requested = payload\["workoutInstanceId"\] as\? String \?\? payload\["sessionId"\] as\? String/);
  assert.match(moduleSource, /return requested == current/);
  const matcher = moduleSource.slice(moduleSource.indexOf('private static func matchesSession'), moduleSource.indexOf('private static func makeOutdoorState'));
  assert.doesNotMatch(matcher, /return true/);
  assert.match(moduleSource, /payload\["sessionSource"\] as\? String == state\.sessionSource/);
  for (const action of ['updateOutdoor', 'endOutdoor']) {
    const start = moduleSource.indexOf(`AsyncFunction("${action}")`);
    const body = moduleSource.slice(start, moduleSource.indexOf('AsyncFunction(', start + 1));
    assert.match(body, /guard let activity = Self\.currentActivity\(\), Self\.matchesSession\(payload, state: activity\.contentState\) else/);
  }
});

test('Build 53 restores Build 37 first-active fallback semantics', () => {
  assert.match(moduleSource, /private static func currentActivity\(\) -> Activity<StrideRunActivityAttributes>\?/);
  assert.match(moduleSource, /return Activity<StrideRunActivityAttributes>\.activities\.first/);
  assert.match(moduleSource, /private static func currentStrengthActivity\(\) -> Activity<StrideStrengthActivityAttributes>\?/);
  assert.match(moduleSource, /return Activity<StrideStrengthActivityAttributes>\.activities\.first/);
  assert.doesNotMatch(moduleSource, /singleRunActivityFallback/);
  assert.doesNotMatch(moduleSource, /fallback_saved_run_id/);
});

test('native start paths restore Build 37 single-active Live Activity replacement', () => {
  assert.match(moduleSource, /await Self\.endExistingActivityIfNeeded\(\)/);
  assert.match(moduleSource, /AsyncFunction\("startStrength"\)[\s\S]*await Self\.endExistingStrengthActivityIfNeeded\(\)/);
  assert.match(moduleSource, /private static func endExistingActivityIfNeeded\(\) async/);
  assert.match(moduleSource, /private static func endExistingStrengthActivityIfNeeded\(\) async/);
  assert.doesNotMatch(moduleSource, /endMatchingRunActivityIfNeeded/);
  assert.doesNotMatch(moduleSource, /endMatchingStrengthActivityIfNeeded/);
});

test('App Intent commands preserve legacy actions and carry the exact outdoor ownership', () => {
  assert.match(intentSource, /static let idKey = "StrideOS\.pendingRunControlCommand\.id"/);
  assert.match(intentSource, /static let actionKey = "StrideOS\.pendingRunControlCommand\.action"/);
  assert.match(intentSource, /StrideRunControlCommand\.write\("pause"\)/);
  assert.match(intentSource, /private func endRun\(\) async/);
  assert.match(intentSource, /Activity<StrideRunActivityAttributes>\.activities\.first/);
  assert.doesNotMatch(intentSource, /pendingTimeout/);
  assert.doesNotMatch(intentSource, /sessionSourceKey/);
  assert.doesNotMatch(moduleSource, /controlStatePreservingPending/);
  for (const field of ['workoutInstanceId', 'sessionId', 'sessionSource']) {
    assert.ok(intentSource.includes(`StrideOS.pendingRunControlCommand.${field}`));
    assert.ok(moduleSource.includes(`StrideOS.pendingRunControlCommand.${field}`));
  }
  assert.match(intentSource, /var state = activity\.contentState/);
});

test('Build 53 restores Build 37 extension target and iOS availability gates', () => {
  assert.match(targetConfigSource, /deploymentTarget: '18\.0'/);
  assert.match(moduleSource, /#available\(iOS 16\.1, \*\)/);
  assert.doesNotMatch(moduleSource, /#available\(iOS 17\.0, \*\)/);
  assert.doesNotMatch(widgetSource, /if #available\(iOS 18\.0, \*\)/);
  assert.match(intentSource, /@available\(iOS 18\.0, \*\)[\s\S]*struct PauseRunIntent/);
});

test('expanded content-state fields are optional, encoded natively, and preserve legacy widget fallbacks', () => {
  const attributes = readFileSync('modules/stride-live-activity/ios/Core/StrideRunActivityAttributes.swift', 'utf8');
  for (const field of ['workoutInstanceId', 'sessionId', 'sessionSource', 'activityType', 'metricLabel', 'metricValue',
    'metricUnit', 'distanceValue', 'distanceUnit', 'elevationDisplay', 'descentDisplay', 'cadenceUnit', 'powerKind',
    'currentInterval', 'nextTransition', 'navigationInstruction', 'cueText', 'controlState']) {
    assert.match(attributes, new RegExp(`public var ${field}: String\\?`));
    assert.match(moduleSource, new RegExp(`state\\.${field} = text\\("${field}"\\)`));
  }
  for (const field of ['cadenceValue', 'powerWatts', 'heartRateObservedAt', 'cadenceObservedAt', 'powerObservedAt']) {
    assert.match(attributes, new RegExp(`public var ${field}: Double\\?`));
    assert.match(moduleSource, new RegExp(`state\\.${field} = number\\("${field}"\\)`));
  }
  assert.match(widgetSource, /context\.state\.averagePace/);
  assert.match(widgetSource, /context\.state\.metricValue \?\? context\.state\.averagePace/);
  assert.match(widgetSource, /context\.state\.metricUnit \?\? "\/mi"/);
  assert.match(widgetSource, /context\.state\.metricLabel \?\? "PACE"/);
  assert.match(widgetSource, /outdoorSymbol\(context\.state\.activityType\)/);
  assert.match(widgetSource, /observedAt: context\.state\.powerObservedAt/);
  assert.match(widgetSource, /context\.isStale/);
  assert.match(widgetSource, /context\.state\.zoneLabel/);
  assert.match(widgetSource, /context\.state\.currentExercise/);
  assert.match(widgetSource, /context\.state\.setsCompleted/);
  assert.doesNotMatch(widgetSource, /context\.state\.prescription/);
  assert.doesNotMatch(widgetSource, /context\.state\.loadDisplay/);
  assert.doesNotMatch(widgetSource, /priorityGuidance/);
  assert.match(widgetSource, /PauseStrengthIntent/);
  assert.match(widgetSource, /ResumeStrengthIntent/);
});
