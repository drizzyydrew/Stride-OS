import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync('modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift', 'utf8');
const intentSource = readFileSync('targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift', 'utf8');
const targetConfigSource = readFileSync('targets/StrideRunLiveActivity/expo-target.config.js', 'utf8');
const widgetSource = readFileSync('targets/StrideRunLiveActivity/StrideRunLiveActivity.swift', 'utf8');

test('native route directions use MapKit walking and cycling contracts', () => {
  assert.match(moduleSource, /import MapKit/);
  assert.match(moduleSource, /transport == "cycling" \? \.cycling : \.walking/);
  assert.match(moduleSource, /route\.steps/);
  assert.match(moduleSource, /coordinatesFromPolyline/);
});

test('Live Activity IDs persist and stale first-activity selection is avoided', () => {
  assert.match(moduleSource, /StrideOS\.currentRunLiveActivityId/);
  assert.match(moduleSource, /StrideOS\.currentStrengthLiveActivityId/);
  assert.match(intentSource, /currentRunActivity\(\)/);
  assert.match(intentSource, /activities\.count == 1/);
  assert.match(intentSource, /removeObject\(forKey: StrideRunControlCommand\.strengthActivityIdKey\)/);
  assert.match(moduleSource, /StrideLiveActivityIdStore\.write\(activity\.id, key: StrideLiveActivityIdStore\.strengthKey\)/);
});

test('native Live Activity recovery keeps the prior single-activity fallback', () => {
  assert.match(moduleSource, /singleRunActivityFallback\(sessionId: sessionId, sessionSource: sessionSource\)/);
  assert.match(moduleSource, /Activity<StrideRunActivityAttributes>\.activities\.count == 1/);
  assert.match(moduleSource, /fallback_single_run/);
  assert.doesNotMatch(moduleSource, /exactSourceConflict/);
  assert.match(moduleSource, /singleStrengthActivityFallback\(sessionId: sessionId, sessionSource: sessionSource\)/);
  assert.match(moduleSource, /Activity<StrideStrengthActivityAttributes>\.activities\.count == 1/);
  assert.match(moduleSource, /fallback_single_strength/);
  assert.match(moduleSource, /fallback_saved_run_id/);
  assert.match(moduleSource, /fallback_saved_strength_id/);
});

test('native start paths restore Build 37 single-active Live Activity replacement', () => {
  assert.match(moduleSource, /await Self\.endExistingRunActivityIfNeeded\(\)/);
  assert.match(moduleSource, /AsyncFunction\("startStrength"\)[\s\S]*await Self\.endExistingStrengthActivityIfNeeded\(\)/);
  assert.match(moduleSource, /private static func endExistingRunActivityIfNeeded\(\) async/);
  assert.match(moduleSource, /private static func endExistingStrengthActivityIfNeeded\(\) async/);
  assert.doesNotMatch(moduleSource, /endMatchingRunActivityIfNeeded/);
  assert.doesNotMatch(moduleSource, /endMatchingStrengthActivityIfNeeded/);
});

test('App Intents publish pending state and suppress rapid duplicate commands', () => {
  assert.match(intentSource, /pendingTimeout: TimeInterval = 15/);
  assert.match(intentSource, /controlState: "pause_pending"/);
  assert.match(intentSource, /controlState: "resume_pending"/);
  assert.match(intentSource, /controlState: "complete_pending"/);
  assert.doesNotMatch(intentSource, /private func endRun/);
  assert.match(widgetSource, /ProgressView\(\)/);
  assert.match(widgetSource, /pendingLabel/);
  assert.match(intentSource, /sessionSourceKey/);
  assert.match(intentSource, /activityKitIdKey/);
  assert.match(moduleSource, /controlStatePreservingPending/);
});

test('Live Activity extension supports iOS 17 display and gates iOS 18 controls', () => {
  assert.match(targetConfigSource, /deploymentTarget: '17\.0'/);
  assert.match(moduleSource, /#available\(iOS 17\.0, \*\)/);
  assert.match(moduleSource, /live_activity_extension_requires_ios_17/);
  assert.match(widgetSource, /if #available\(iOS 18\.0, \*\)/);
  assert.match(intentSource, /@available\(iOS 18\.0, \*\)[\s\S]*struct PauseRunIntent/);
  assert.match(widgetSource, /Tracking in StrideOS/);
  assert.match(widgetSource, /Open StrideOS for controls/);
});

test('activity-specific and strength-priority content are visible contracts', () => {
  assert.match(widgetSource, /activityIcon\(context\.state\.activityType\)/);
  assert.match(widgetSource, /context\.state\.metricLabel/);
  assert.match(widgetSource, /context\.state\.navigationInstruction/);
  assert.match(widgetSource, /context\.state\.prescription/);
  assert.match(widgetSource, /context\.state\.loadDisplay/);
  assert.match(widgetSource, /PauseStrengthIntent/);
  assert.match(widgetSource, /ResumeStrengthIntent/);
  assert.match(widgetSource, /figure\.snowboarding/);
});
