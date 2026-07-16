import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('bottom navigation declares exactly the six approved primary destinations', () => {
  const source = read('app/(tabs)/_layout.tsx');
  const visibleSection = source.slice(source.indexOf('<Tabs.Screen'), source.indexOf('<Tabs.Screen name="index"'));
  const names = [...visibleSection.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map(match => match[1]);
  const hiddenNames = [...source.matchAll(/<Tabs\.Screen name="([^"]+)" options=\{\{ href: null \}\}/g)]
    .map(match => match[1]);

  assert.deepEqual(names, ['dashboard', 'calendar', 'training', 'strength', 'coach', 'more']);
  assert.deepEqual(hiddenNames, [
    'index',
    'analytics',
    'performance',
    'profile',
    'settings',
    'movement',
    'activity-log',
    'activity',
  ]);
  assert.equal(existsSync('app/(tabs)/activity/_layout.tsx'), true);
  assert.equal(existsSync('app/(tabs)/profile/_layout.tsx'), true);
  assert.equal(existsSync('app/(tabs)/activity-log/_layout.tsx'), true);
  assert.doesNotMatch(visibleSection, /href:\s*null/);
  assert.doesNotMatch(source, /tabBarStyle:\s*\{\s*display:\s*['"]none['"]/);
  assert.match(source, /minWidth:\s*0/);
});

test('More contains only valid secondary destinations and does not duplicate primary tabs', () => {
  const source = read('app/(tabs)/more/index.tsx');
  const itemBlock = source.slice(source.indexOf('const ITEMS'), source.indexOf('export default function'));
  const labels = [...itemBlock.matchAll(/label:\s*'([^']+)'/g)].map(match => match[1]);
  const routes = [...itemBlock.matchAll(/route:\s*'([^']+)'/g)].map(match => match[1]);

  assert.deepEqual(labels, [
    'Activity',
    'Movement Lab',
    'Analytics',
    'Adaptive Performance',
    'Profile',
    'Settings',
  ]);
  assert.equal(labels.includes('Running'), false);
  assert.equal(labels.includes('Strength'), false);

  for (const route of routes) {
    const relative = route.replace('/(tabs)/', '');
    assert.equal(
      existsSync(`app/(tabs)/${relative}.tsx`)
        || existsSync(`app/(tabs)/${relative}/index.tsx`),
      true,
      `More destination ${route} must resolve to a route`,
    );
  }
});

test('legacy training-history links open unified Activity', () => {
  const profile = read('app/(tabs)/profile/index.tsx');
  const settings = read('app/(tabs)/settings/index.tsx');

  assert.match(profile, /router\.push\('\/\(tabs\)\/activity'/);
  assert.doesNotMatch(profile, /router\.push\('\/\(tabs\)\/activity-log'/);
  assert.match(settings, /router\.push\('\/\(tabs\)\/activity'/);
  assert.doesNotMatch(settings, /router\.push\('\/\(tabs\)\/activity-log'/);
});

test('Build 38 detail screens use shared responsive headers', () => {
  const header = read('src/components/layout/ScreenHeader.tsx');
  const preset = read('app/(tabs)/strength/preset/[id].tsx');
  const movement = read('app/(tabs)/movement/analyze.tsx');

  assert.match(header, /width:\s*44/);
  assert.match(header, /height:\s*44/);
  assert.match(header, /titleNumberOfLines\s*=\s*2/);
  assert.match(header, /minWidth:\s*0/);
  assert.match(preset, /<ScreenHeader/);
  assert.match(movement, /<ScreenHeader/);
});

test('preset details render centralized user-facing equipment labels', () => {
  const preset = read('app/(tabs)/strength/preset/[id].tsx');

  assert.match(preset, /displayLabels\(workout\.equipment\)/);
  assert.match(preset, /displayLabels\(exercise\.equipment\)/);
  assert.doesNotMatch(preset, /equipment\.join\(/);
});

test('Build 39 affected workflows use the centralized display-label contract', () => {
  const affectedScreens = [
    'app/(tabs)/activity-log/[entryId].tsx',
    'app/(tabs)/activity-log/index.tsx',
    'app/(tabs)/activity/plans.tsx',
    'app/(tabs)/calendar/index.tsx',
    'app/(tabs)/dashboard/index.tsx',
    'app/(tabs)/profile/index.tsx',
    'app/(tabs)/strength/[sessionIndex].tsx',
    'app/(tabs)/strength/index.tsx',
    'app/(tabs)/strength/preset-session.tsx',
    'app/(tabs)/strength/preset/[id].tsx',
    'app/(tabs)/training/index.tsx',
    'src/components/movement/LandmarkEditor.tsx',
    'src/components/strength/StrengthSessionCard.tsx',
    'src/components/strength/StrengthWeekCard.tsx',
  ];

  for (const path of affectedScreens) {
    const source = read(path);
    assert.doesNotMatch(source, /\.replace\(\s*\/_/, `${path} must not format enum labels ad hoc`);
  }
});
