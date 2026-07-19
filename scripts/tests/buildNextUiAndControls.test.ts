import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { formatYMDForDisplay, parseDisplayDateToYMD } from '../../src/utils/dateFormatting';
import { sanitizeCoachDisplayText } from '../../src/utils/coachDisplay';
import {
  MARKER_EDGE_INSET,
  clampMarkerCoordinate,
  normalizedMarkerFromDrag,
} from '../../src/utils/markerEditing';

test('user-facing date helpers display MM-DD-YYYY and store ISO without timezone shifting', () => {
  assert.equal(formatYMDForDisplay('2026-10-18'), '10-18-2026');
  assert.equal(formatYMDForDisplay(null), '');
  assert.equal(parseDisplayDateToYMD('10-18-2026'), '2026-10-18');
  assert.equal(parseDisplayDateToYMD('2026-10-18'), null);
});

test('onboarding date and PR inputs use picker sheets instead of free-text ISO or steppers', () => {
  const goal = readFileSync('app/onboarding/goal.tsx', 'utf8');
  const race = readFileSync('app/onboarding/race.tsx', 'utf8');

  assert.match(goal, /RACE DATE \(MM-DD-YYYY\)/);
  assert.match(goal, /MultiColumnPickerSheet/);
  assert.doesNotMatch(goal, /placeholder="YYYY-MM-DD"/);
  assert.match(race, /Hours/);
  assert.match(race, /Minutes/);
  assert.match(race, /Seconds/);
  assert.match(race, /MultiColumnPickerSheet/);
  assert.doesNotMatch(race, /onPress=\{\(\) => adjust/);
});

test('settings, calibration, and manual logging expose MM-DD-YYYY date entry', () => {
  const settings = readFileSync('app/(tabs)/settings/index.tsx', 'utf8');
  const calibration = readFileSync('app/(tabs)/profile/calibration.tsx', 'utf8');
  const logModal = readFileSync('src/components/shared/LogWorkoutModal.tsx', 'utf8');

  for (const source of [settings, calibration, logModal]) {
    assert.doesNotMatch(source, /placeholder="YYYY-MM-DD"/);
    assert.doesNotMatch(source, /Use YYYY-MM-DD format/);
  }

  assert.match(settings, /Enter a valid date as MM-DD-YYYY/);
  assert.match(settings, /formatYMDForDisplay\(race\.date\)/);
  assert.match(calibration, /placeholder="MM-DD-YYYY"/);
  assert.match(logModal, /placeholder="MM-DD-YYYY"/);
  assert.match(logModal, /parseDisplayDateToYMD\(dateDisplay\)/);
});

test('AI Coach strips raw Markdown and emoji-like pictographs before display', () => {
  assert.equal(
    sanitizeCoachDisplayText('**Run 90 seconds** 🏃\n- Walk 90 seconds\n`Zone 2`'),
    'Run 90 seconds\n• Walk 90 seconds\nZone 2',
  );
  const coach = readFileSync('app/(tabs)/coach/index.tsx', 'utf8');
  assert.match(coach, /keyboardDismissMode="interactive"/);
  assert.match(coach, /keyboardShouldPersistTaps="handled"/);
  assert.match(coach, /onScrollBeginDrag=\{\(\) => Keyboard\.dismiss\(\)\}/);
  assert.match(coach, /no markdown syntax, no emojis/);
  assert.doesNotMatch(coach, />🏃</);
  assert.doesNotMatch(coach, />🔑</);
});

test('bottom tabs remain exactly six and use the modest larger label/icon contract', () => {
  const tabs = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
  const visibleSection = tabs.slice(tabs.indexOf('<Tabs.Screen'), tabs.indexOf('<Tabs.Screen name="index"'));
  assert.equal((visibleSection.match(/<Tabs\.Screen/g) ?? []).length, 6);
  assert.match(tabs, /size=\{24\}/);
  assert.match(tabs, /fontSize:\s*9\.5/);
  assert.match(tabs, /minimumFontScale=\{0\.85\}/);
  assert.match(tabs, /minWidth:\s*0/);
});

test('marker editing allows full-image movement with only edge clamping', () => {
  assert.equal(MARKER_EDGE_INSET, 0.01);
  assert.equal(clampMarkerCoordinate(-10), 0.01);
  assert.equal(clampMarkerCoordinate(10), 0.99);
  assert.deepEqual(
    normalizedMarkerFromDrag({ x: 0.5, y: 0.5 }, { dx: 180, dy: -180 }, { width: 300, height: 300 }),
    { x: 0.99, y: 0.01 },
  );
  assert.deepEqual(
    normalizedMarkerFromDrag({ x: 0.5, y: 0.5 }, { dx: -120, dy: 90 }, { width: 300, height: 300 }),
    { x: 0.09999999999999998, y: 0.8 },
  );
});

test('Landmark editor owns drag gestures and uses visible-media coordinate mapping', () => {
  const editor = readFileSync('src/components/movement/LandmarkEditor.tsx', 'utf8');
  assert.match(editor, /normalizedMarkerFromDrag/);
  assert.match(editor, /onPanResponderTerminationRequest:\s*\(\) => false/);
  assert.match(editor, /onShouldBlockNativeResponder:\s*\(\) => true/);
  assert.match(editor, /resizeMode="contain"/);
  assert.doesNotMatch(editor, /MAX_DRAG_RADIUS|radiusLimit|snapBack/);
});

test('strength Live Activity complete requests session completion through the shared store contract', () => {
  const store = readFileSync('src/store/activeStrengthSessionStore.ts', 'utf8');
  const reconciler = readFileSync('src/components/liveActivity/LiveActivityCommandReconciler.tsx', 'utf8');
  const preset = readFileSync('app/(tabs)/strength/preset-session.tsx', 'utf8');
  const strength = readFileSync('app/(tabs)/strength/index.tsx', 'utf8');

  assert.match(store, /completionRequestedAt/);
  assert.match(store, /requestCompletion/);
  assert.match(reconciler, /strength_complete/);
  assert.match(reconciler, /requestCompletion\(\)/);
  assert.doesNotMatch(reconciler, /strength_complete:[\s\S]*completeExercise\(current\.id\)/);
  assert.match(preset, /completionRequestedAt/);
  assert.match(preset, /saveAndFinish\(\)/);
  assert.match(strength, /completionRequestedAt/);
  assert.match(strength, /finishSession\(\)/);
});
