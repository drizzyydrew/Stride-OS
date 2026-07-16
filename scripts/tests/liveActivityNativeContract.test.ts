import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync('modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift', 'utf8');
const intentSource = readFileSync('targets/StrideRunLiveActivity/_shared/StrideControlIntents.swift', 'utf8');
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
});

test('App Intents publish pending state and suppress rapid duplicate commands', () => {
  assert.match(intentSource, /pendingTimeout: TimeInterval = 15/);
  assert.match(intentSource, /controlState: "pause_pending"/);
  assert.match(intentSource, /controlState: "resume_pending"/);
  assert.match(intentSource, /controlState: "complete_pending"/);
  assert.doesNotMatch(intentSource, /private func endRun/);
  assert.match(widgetSource, /ProgressView\(\)/);
  assert.match(widgetSource, /pendingLabel/);
});

test('activity-specific and strength-priority content are visible contracts', () => {
  assert.match(widgetSource, /activityIcon\(context\.state\.activityType\)/);
  assert.match(widgetSource, /context\.state\.metricLabel/);
  assert.match(widgetSource, /context\.state\.navigationInstruction/);
  assert.match(widgetSource, /context\.state\.prescription/);
  assert.match(widgetSource, /context\.state\.loadDisplay/);
});
