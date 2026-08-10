import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('Activity detail waits for legacy hydration and provides designed recovery actions', () => {
  const store = source('src/store/activityStore.ts');
  const detail = source('app/(tabs)/activity/[activityId].tsx');
  assert.match(store, /hydrationStatus: 'loading'/);
  assert.match(store, /Promise\.allSettled/);
  assert.match(store, /setHydrationStatus\('ready'\)/);
  assert.match(store, /useActivityStore\.getState\(\)\.setHydrationStatus\('error'\)/);
  assert.match(detail, /Loading activity/);
  assert.match(detail, /Activity unavailable/);
  assert.match(detail, /Back to Activity/);
  assert.match(detail, /Return to Today/);
  assert.doesNotMatch(detail, />Activity not found</);
  assert.match(detail, /buildActivitySummary/);
  assert.match(detail, /useSettingsStore/);
  assert.match(source('src/utils/activitySummary.ts'), /'snowboarding'/);
});

test('hydration steppers stack on phone widths and embedded content avoids excessive bottom padding', () => {
  const hydration = source('app/(tabs)/training/hydration.tsx');
  assert.match(hydration, /useWindowDimensions/);
  assert.match(hydration, /width <= 480 \|\| fontScale >= 1\.15/);
  assert.match(hydration, /inputRowStacked/);
  assert.match(hydration, /stepControlsStacked/);
  assert.match(hydration, /paddingBottom: embedded \? 32 : LAYOUT\.screenPadBottom/);
  assert.doesNotMatch(hydration, /wordBreak|wordWrap:\s*['"]break-word|flexWrap:\s*['"]wrap-reverse/);
});

test('cross-training frequency uses the accessible wheel instead of an overflowing pill row', () => {
  const preferences = source('app/(tabs)/activity/preferences.tsx');
  assert.match(preferences, /<PickerWheel/);
  assert.match(preferences, /values=\{\[1, 2, 3, 4\]\}/);
  assert.match(preferences, /Cross-training frequency/);
  assert.match(preferences, /accessibilityLabel=\{`Cross-training frequency/);
  assert.doesNotMatch(preferences, /style=\{s\.frequency\}/);
});
