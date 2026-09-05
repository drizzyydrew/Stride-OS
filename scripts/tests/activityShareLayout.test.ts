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

test('activity detail surfaces run splits before share image controls', () => {
  const activityDetail = read('app/(tabs)/activity/[activityId].tsx');

  assert.match(activityDetail, /buildRunSplits\(activity, units\)/);
  assert.match(activityDetail, /RUN SPLITS/);
  assert.match(activityDetail, /split\.trend === 'faster'/);
  assert.match(activityDetail, /split\.trend === 'slower'/);
});
