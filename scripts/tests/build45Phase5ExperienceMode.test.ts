import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TAB_BAR_VISUAL_CONTRACT, VISIBLE_BOTTOM_TABS } from '../../src/constants/layout';
import { experienceModeAllows } from '../../src/utils/experienceMode';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('experience mode visibility order is simple then balanced then data rich', () => {
  assert.equal(experienceModeAllows('simple', 'simple'), true);
  assert.equal(experienceModeAllows('simple', 'balanced'), false);
  assert.equal(experienceModeAllows('balanced', 'simple'), true);
  assert.equal(experienceModeAllows('balanced', 'balanced'), true);
  assert.equal(experienceModeAllows('balanced', 'data_rich'), false);
  assert.equal(experienceModeAllows('data_rich', 'simple'), true);
  assert.equal(experienceModeAllows('data_rich', 'balanced'), true);
  assert.equal(experienceModeAllows('data_rich', 'data_rich'), true);
});

test('settings store adds balanced experience mode with safe merge behavior', () => {
  const source = read('src/store/settingsStore.ts');
  const utility = read('src/utils/experienceMode.ts');
  assert.match(utility, /export type ExperienceMode = 'simple' \| 'balanced' \| 'data_rich'/);
  assert.match(source, /export type \{ ExperienceMode \}/);
  assert.match(source, /experienceMode:\s*'balanced'/);
  assert.match(source, /setExperienceMode:\s*\(experienceMode\) => set\(\{ experienceMode \}\)/);
  assert.match(source, /experienceMode:\s*saved\?\.experienceMode \?\? 'balanced'/);
});

test('Today workout card uses the required action groups and no empty change banner', () => {
  const dashboard = read('app/(tabs)/dashboard/index.tsx');
  assert.doesNotMatch(dashboard, /No plan changes today/);
  assert.match(dashboard, /More Options/);
  for (const group of ['Adjust Today', 'Adjust the Plan', 'Get Help']) {
    assert.match(dashboard, new RegExp(group));
  }
  for (const action of [
    "Shorten today's session",
    'Reduce intensity',
    "Move today's workout",
    'Replace with an equivalent session',
    'Switch outdoor to treadmill',
    'Skip today',
    'Report fatigue',
    'Why is this workout scheduled?',
    'Explain Performance Forecast',
    'Ask AI Coach',
  ]) {
    assert.match(dashboard, new RegExp(action));
  }
  assert.match(dashboard, /primarySession\?\.adaptationReason/);
  assert.match(dashboard, /What changed: \{primarySession\.adaptationReason\}/);
});

test('mode gating reaches the specified Phase 5 presentation surfaces', () => {
  const files = [
    'app/(tabs)/dashboard/index.tsx',
    'app/(tabs)/training/index.tsx',
    'app/(tabs)/strength/index.tsx',
    'app/(tabs)/activity/[activityId].tsx',
    'app/(tabs)/more/index.tsx',
    'src/components/today/ReadinessCard.tsx',
  ];

  for (const file of files) {
    assert.match(read(file), /useExperienceMode|experienceModeAllows|useExperienceModeAllows/, `${file} should consume experience mode`);
  }
});

test('bottom tab visual contract is centralized and uniform', () => {
  assert.deepEqual(VISIBLE_BOTTOM_TABS, ['Today', 'Calendar', 'Running', 'Strength', 'AI Coach', 'More']);
  assert.deepEqual(TAB_BAR_VISUAL_CONTRACT, {
    iconSize: 25,
    iconBoxSize: 30,
    labelFontSize: 10,
    labelLineHeight: 12,
    itemMinHeight: 54,
    iconToLabelGap: 4,
    itemPaddingVertical: 3,
    itemPaddingHorizontal: 0,
  });

  const tabs = read('app/(tabs)/_layout.tsx');
  const visibleSection = tabs.slice(tabs.indexOf('<Tabs.Screen'), tabs.indexOf('<Tabs.Screen name="index"'));
  assert.equal((visibleSection.match(/<Tabs\.Screen/g) ?? []).length, 6);
  assert.match(tabs, /TAB_BAR_VISUAL_CONTRACT/);
  assert.match(tabs, /width:\s*TAB_ICON_BOX_SIZE/);
  assert.match(tabs, /height:\s*TAB_ICON_BOX_SIZE/);
  assert.match(tabs, /minimumFontScale=\{0\.85\}/);
  assert.match(tabs, /includeFontPadding:\s*false/);
});
