import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const presetSource = readFileSync('app/(tabs)/strength/preset-session.tsx', 'utf8');
const trainingBlockSource = readFileSync('app/(tabs)/strength/index.tsx', 'utf8');
const outdoorSource = readFileSync('app/(tabs)/activity/start.tsx', 'utf8');
const runningSource = readFileSync('app/(tabs)/training/index.tsx', 'utf8');
const legacyRunTrackingSource = readFileSync('app/(tabs)/training/run-tracking.tsx', 'utf8');
const rootReconciler = readFileSync('src/components/liveActivity/LiveActivityCommandReconciler.tsx', 'utf8');
const strengthBridge = readFileSync('src/lib/strengthLiveActivity.ts', 'utf8');
const dionCard = readFileSync('src/components/movement/DionInstructionCard.tsx', 'utf8');

test('root reconciler owns identity-aware Live Activity commands after store hydration', () => {
  assert.match(rootReconciler, /waitForHydration\(useActiveRunStore\)/);
  assert.match(rootReconciler, /waitForHydration\(useActiveActivityStore\)/);
  assert.match(rootReconciler, /waitForHydration\(useActiveStrengthSessionStore\)/);
  assert.match(rootReconciler, /startControlCommandPolling/);
  assert.match(rootReconciler, /runCommandMatches/);
  assert.match(rootReconciler, /outdoorCommandMatches/);
  assert.match(rootReconciler, /strengthCommandMatches/);
  assert.match(rootReconciler, /requestCompletion/);
  assert.doesNotMatch(presetSource, /startControlCommandPolling/);
  assert.doesNotMatch(trainingBlockSource, /startControlCommandPolling/);
  assert.doesNotMatch(outdoorSource, /startControlCommandPolling/);
});

test('preset strength publishes shared source identity without a competing screen poller', () => {
  assert.match(presetSource, /sessionSource: 'preset'/);
  assert.match(presetSource, /session\.source !== 'preset'/);
});

test('Training Block polling and updates stop when another strength source owns the session', () => {
  assert.match(trainingBlockSource, /if \(!ownsActiveTrainingBlock \|\| strState === 'idle'/);
  assert.match(trainingBlockSource, /sessionSource: 'training_block'/);
  assert.match(trainingBlockSource, /strengthLiveActivitySessionId\(activeStrengthSession\)/);
});

test('strength payload normalizer separates exercise, prescription, load and progress', () => {
  assert.match(strengthBridge, /normalizeStrengthLiveActivityPayload/);
  assert.match(strengthBridge, /prescription/);
  assert.match(strengthBridge, /loadDisplay/);
  assert.match(strengthBridge, /progressLabel/);
  assert.match(strengthBridge, /strengthLiveActivitySessionId/);
});

test('outdoor activities consume shared controls and include snowboarding', () => {
  assert.match(outdoorSource, /type: 'snowboarding'/);
  assert.match(outdoorSource, /sessionSource: 'outdoor'/);
  assert.match(outdoorSource, /activeOutdoorElapsedSeconds/);
  assert.match(outdoorSource, /completionRequestedAt/);
  assert.match(outdoorSource, /elevationGainMeters/);
  assert.match(outdoorSource, /elevationLossMeters/);
});

test('cold-navigation run completion derives final time from persisted run state', () => {
  assert.match(runningSource, /const finalState = useActiveRunStore\.getState\(\)/);
  assert.match(runningSource, /const finalElapsed = activeRunElapsedSeconds\(finalState\)/);
  assert.match(runningSource, /elapsedSeconds: finalElapsed/);
  assert.doesNotMatch(runningSource, /const finalElapsed = elapsed;/);
});

test('every reachable direct run start is owner-gated and starts a Live Activity', () => {
  assert.equal((runningSource.match(/\bstartRun\(/g) ?? []).length, 2);
  assert.equal((runningSource.match(/getConflictingActiveSession\('running'\)/g) ?? []).length, 2);
  assert.match(runningSource, /startRunLiveActivity/);

  assert.equal((legacyRunTrackingSource.match(/\bstartRun\(/g) ?? []).length, 1);
  assert.match(legacyRunTrackingSource, /waitForActiveSessionStores/);
  assert.match(legacyRunTrackingSource, /getConflictingActiveSession\('running'\)/);
  assert.match(legacyRunTrackingSource, /startRunLiveActivity/);
  assert.match(legacyRunTrackingSource, /endRunLiveActivity/);
});

test('Bike Fit uses a full-width natural landscape frame without changing source images', () => {
  assert.ok(dionCard.includes('BIKE_FIT_ASPECT_RATIO = 4 / 3'));
  assert.match(dionCard, /frameFullLandscape/);
  assert.match(dionCard, /width: '100%'/);
  assert.match(dionCard, /landscape \? \(/);
});
