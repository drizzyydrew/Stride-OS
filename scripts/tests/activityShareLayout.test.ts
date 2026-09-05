import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeRouteForOverlay } from '../../src/utils/routeOverlay';

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

  assert.match(shareStudio, /normalizeRouteForOverlay\(activity\.metrics\.routeCoordinates, \{ width: 1080, height: 1080 \}, 0\.06\)/);
  assert.match(shareStudio, /strokeWidth=\{28\}/);
  assert.match(shareStudio, /fixedMetricsSquareActivity: \{ left: '8%', right: '8%', top: '28%'/);
  assert.match(shareStudio, /fixedRouteSquareActivity: \{ left: '20%', right: '20%', top: '48%', bottom: '21%' \}/);
  assert.match(shareStudio, /fixedRouteStoryActivity: \{ left: '16%', right: '16%', top: '44%', bottom: '26%' \}/);
});

test('route overlay framing resists isolated GPS outliers so selected routes stay visible', () => {
  const route = [
    ...Array.from({ length: 40 }, (_, index) => ({
      latitude: 44.05 + index * 0.00025,
      longitude: -121.3 + Math.sin(index / 4) * 0.001,
    })),
    { latitude: 45.5, longitude: -123.1 },
  ];
  const overlay = normalizeRouteForOverlay(route, { width: 1080, height: 1080 }, 0.06);

  assert.equal(overlay.hasRoute, true);
  assert.ok(Math.max(...overlay.points.map(point => point.x)) - Math.min(...overlay.points.map(point => point.x)) > 120);
  assert.ok(Math.max(...overlay.points.map(point => point.y)) - Math.min(...overlay.points.map(point => point.y)) > 740);
});

test('activity detail surfaces run splits before share image controls', () => {
  const activityDetail = read('app/(tabs)/activity/[activityId].tsx');

  assert.match(activityDetail, /buildRunSplits\(activity, units\)/);
  assert.match(activityDetail, /RUN SPLITS/);
  assert.match(activityDetail, /split\.trend === 'faster'/);
  assert.match(activityDetail, /split\.trend === 'slower'/);
});
