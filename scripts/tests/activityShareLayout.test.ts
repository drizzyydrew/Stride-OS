import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('activity share exports use fixed layouts and transparent metric blocks', () => {
  const shareStudio = read('src/components/share/ShareStudio.tsx');

  assert.match(shareStudio, /fixedActivityLayout = Boolean\(activity\)/);
  assert.match(shareStudio, /fixedActivityLayout \? \[\] :/);
  assert.match(shareStudio, /styles\.fixedRoute/);
  assert.match(shareStudio, /styles\.fixedMetrics/);
  assert.match(shareStudio, /statPillTransparent/);
  assert.match(shareStudio, /selectedMetrics\.slice\(0, 6\)/);
  assert.doesNotMatch(shareStudio, /Activity Complete[\s\S]*Running/);
});

test('run level achievement shares stay level-focused and do not inherit activity stats', () => {
  const shareStudio = read('src/components/share/ShareStudio.tsx');

  assert.match(shareStudio, /isRunLevelAchievement = Boolean\(achievement && runLevelSlugFromId\(achievement\.id\)\)/);
  assert.match(shareStudio, /!isRunLevelAchievement && metricValue\(activity, 'imperial', 'distance'\)/);
  assert.match(shareStudio, /keys\.includes\(key\) && enabled\[key\]/);
  assert.match(shareStudio, /keys\.includes\('route'\) && enabled\.route/);
  assert.match(shareStudio, /activityTitle && achievementShareTitle && !runLevelSlug/);
});

test('activity plus route share keeps a large fixed route drawing area', () => {
  const shareStudio = read('src/components/share/ShareStudio.tsx');

  assert.match(shareStudio, /normalizeRouteForOverlay\(activity\.metrics\.routeCoordinates, \{ width: 1080, height: 1080 \}, 0\.035\)/);
  assert.match(shareStudio, /strokeWidth=\{20\}/);
  assert.match(shareStudio, /fixedMetricsSquareActivity: \{ left: 24, right: 24, top: 156/);
  assert.match(shareStudio, /fixedRouteSquareActivity: \{ left: 82, right: 82, top: 246, bottom: 116 \}/);
  assert.match(shareStudio, /fixedRouteStoryActivity: \{ left: 64, right: 64, top: 430, bottom: 178 \}/);
});

test('activity detail surfaces run splits before share image controls', () => {
  const activityDetail = read('app/(tabs)/activity/[activityId].tsx');

  assert.match(activityDetail, /buildRunSplits\(activity, units\)/);
  assert.match(activityDetail, /RUN SPLITS/);
  assert.match(activityDetail, /split\.trend === 'faster'/);
  assert.match(activityDetail, /split\.trend === 'slower'/);
});
