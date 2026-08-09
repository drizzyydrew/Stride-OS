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

test('Build 53 keeps Build 37 in-process ActivityKit IDs without persisted source matching', () => {
  assert.match(moduleSource, /private static var currentActivityId: String\?/);
  assert.match(moduleSource, /private static var currentStrengthActivityId: String\?/);
  assert.doesNotMatch(moduleSource, /StrideOS\.currentRunLiveActivityId/);
  assert.doesNotMatch(moduleSource, /sessionSource/);
  assert.doesNotMatch(moduleSource, /workoutInstanceId/);
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

test('Build 53 restores Build 37 simple App Intent command contract', () => {
  assert.match(intentSource, /static let idKey = "StrideOS\.pendingRunControlCommand\.id"/);
  assert.match(intentSource, /static let actionKey = "StrideOS\.pendingRunControlCommand\.action"/);
  assert.match(intentSource, /StrideRunControlCommand\.write\("pause"\)/);
  assert.match(intentSource, /private func endRun\(\) async/);
  assert.match(intentSource, /Activity<StrideRunActivityAttributes>\.activities\.first/);
  assert.doesNotMatch(intentSource, /pendingTimeout/);
  assert.doesNotMatch(intentSource, /sessionSourceKey/);
  assert.doesNotMatch(moduleSource, /controlStatePreservingPending/);
});

test('Build 53 restores Build 37 extension target and iOS availability gates', () => {
  assert.match(targetConfigSource, /deploymentTarget: '18\.0'/);
  assert.match(moduleSource, /#available\(iOS 16\.1, \*\)/);
  assert.doesNotMatch(moduleSource, /#available\(iOS 17\.0, \*\)/);
  assert.doesNotMatch(widgetSource, /if #available\(iOS 18\.0, \*\)/);
  assert.match(intentSource, /@available\(iOS 18\.0, \*\)[\s\S]*struct PauseRunIntent/);
});

test('Build 53 widget reads only the Build 37 run and strength content state', () => {
  assert.match(widgetSource, /context\.state\.averagePace/);
  assert.match(widgetSource, /context\.state\.zoneLabel/);
  assert.match(widgetSource, /context\.state\.currentExercise/);
  assert.match(widgetSource, /context\.state\.setsCompleted/);
  assert.doesNotMatch(widgetSource, /context\.state\.activityType/);
  assert.doesNotMatch(widgetSource, /context\.state\.metricLabel/);
  assert.doesNotMatch(widgetSource, /context\.state\.navigationInstruction/);
  assert.doesNotMatch(widgetSource, /context\.state\.prescription/);
  assert.doesNotMatch(widgetSource, /context\.state\.loadDisplay/);
  assert.match(widgetSource, /PauseStrengthIntent/);
  assert.match(widgetSource, /ResumeStrengthIntent/);
});
