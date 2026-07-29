import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Activity } from '../../src/types/activity';
import type { Shoe } from '../../src/store/gearStore';
import { deriveShoeMileage, mostUsedShoe, shoeWearReminderCopy } from '../../src/utils/gear';
import { filterActivities } from '../../src/utils/activitySearch';
import { evaluateAchievements, HEALTHY_ACHIEVEMENTS } from '../../src/utils/achievements';

const NOW = Date.UTC(2026, 6, 26, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

function activity(overrides: Partial<Activity> = {}): Activity {
  const startTime = overrides.startTime ?? NOW;
  return {
    id: overrides.id ?? `a_${startTime}`,
    activityType: overrides.activityType ?? 'running',
    subtype: overrides.subtype ?? 'outdoor',
    source: 'manual',
    status: overrides.status ?? 'completed',
    scheduled: false,
    startTime,
    endTime: startTime + 30 * 60 * 1000,
    rpe: overrides.rpe ?? 5,
    indoor: overrides.indoor ?? false,
    shoeId: overrides.shoeId,
    gearIds: overrides.gearIds,
    completionClassification: overrides.completionClassification,
    notes: overrides.notes,
    metrics: {
      durationSeconds: 1800,
      distanceMeters: 1609.344,
      ...(overrides.metrics ?? {}),
    },
    trainingLoad: {
      method: 'session_rpe',
      wholeBody: 50,
      running: 50,
      walking: 0,
      strength: 0,
      crossTraining: 0,
      impactBearing: 50,
      nonImpactAerobic: 0,
      confidence: 'moderate',
      ...(overrides.trainingLoad ?? {}),
    },
    createdAt: startTime,
    updatedAt: startTime,
  };
}

function shoe(id: string, model: string): Shoe {
  return { id, brand: 'Test', model, addedAt: NOW, active: true };
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('shoe mileage is derived from activities and changes after edit/delete inputs', () => {
  const shoes = [shoe('shoe_a', 'A'), shoe('shoe_b', 'B')];
  const activities = [
    activity({ id: 'one', shoeId: 'shoe_a', metrics: { distanceMeters: 3218.688 } }),
    activity({ id: 'two', shoeId: 'shoe_a', metrics: { distanceMeters: 1609.344 } }),
    activity({ id: 'skip', shoeId: 'shoe_a', status: 'skipped', metrics: { distanceMeters: 1609.344 } }),
    activity({ id: 'other', shoeId: 'shoe_b', metrics: { distanceMeters: 804.672 } }),
  ];

  assert.deepEqual(deriveShoeMileage(activities, shoes).map(item => [item.shoeId, item.miles]), [
    ['shoe_a', 3],
    ['shoe_b', 0.5],
  ]);
  assert.equal(mostUsedShoe(activities, shoes)?.shoe.id, 'shoe_a');
  assert.equal(deriveShoeMileage(activities.filter(item => item.id !== 'two'), shoes)[0].miles, 2);
});

test('shoe wear reminder is a check-wear prompt, not an unsafe claim', () => {
  const copy = shoeWearReminderCopy({ ...shoe('shoe_a', 'A'), reminderThresholdMiles: 300 }, 320);
  assert.match(copy ?? '', /Consider checking wear/);
  assert.doesNotMatch(copy ?? '', /unsafe|injury|danger/i);
});

test('activity search filters query, type, shoe, treadmill, indoor, route, status and distance', () => {
  const activities = [
    activity({ id: 'road', notes: 'easy aerobic', shoeId: 'shoe_a', metrics: { routeId: 'route_a', distanceMeters: 8046.72 } }),
    activity({ id: 'treadmill', subtype: 'treadmill', indoor: true, shoeId: 'shoe_b', notes: 'hotel treadmill' }),
    activity({ id: 'strength', activityType: 'strength', subtype: 'general', indoor: true, status: 'partial', metrics: { durationSeconds: 2400 } }),
  ];

  assert.deepEqual(filterActivities(activities, { query: 'hotel' }).map(item => item.id), ['treadmill']);
  assert.deepEqual(filterActivities(activities, { type: 'running', shoeId: 'shoe_a', minDistanceMiles: 4 }).map(item => item.id), ['road']);
  assert.deepEqual(filterActivities(activities, { treadmill: true, indoor: true }).map(item => item.id), ['treadmill']);
  assert.deepEqual(filterActivities(activities, { routeId: 'route_a' }).map(item => item.id), ['road']);
  assert.deepEqual(filterActivities(activities, { status: 'partial' }).map(item => item.id), ['strength']);
});

test('healthy achievements are restrained and rest never removes existing awards', () => {
  const ids = evaluateAchievements([
    activity({ id: 'long', metrics: { durationSeconds: 50 * 60, distanceMeters: 8046.72 }, rpe: 4 }),
    activity({ id: 'lift', activityType: 'strength', trainingLoad: { strength: 40, wholeBody: 40 } as Activity['trainingLoad'] }),
    activity({ id: 'mobility', activityType: 'mobility' }),
    activity({ id: 'skip', status: 'skipped' }),
  ], ['consistency_wins'], NOW);

  assert.ok(ids.includes('long_run_builder'));
  assert.ok(ids.includes('easy_means_easy'));
  assert.ok(ids.includes('strong_strides'));
  assert.ok(ids.includes('recovery_master'));
  assert.ok(ids.includes('consistency_wins'));
  assert.deepEqual(HEALTHY_ACHIEVEMENTS.map(item => item.id), [
    'consistency_wins',
    'long_run_builder',
    'recovery_master',
    'smart_progression',
    'strong_strides',
    'foundation_builder',
    'strength_supports_running',
    'listened_to_your_body',
    'back_on_track',
    'deload_done_right',
    'balanced_training',
    'quality_earned',
    'easy_means_easy',
  ]);
});

test('Phase 7 source contracts wire search, gear, equipment, and achievement surfaces', () => {
  const activityType = read('src/types/activity.ts');
  const activityScreen = read('app/(tabs)/activity/index.tsx');
  const manual = read('app/(tabs)/activity/manual.tsx');
  const more = read('app/(tabs)/more/index.tsx');
  const tabs = read('app/(tabs)/_layout.tsx');
  const gearStore = read('src/store/gearStore.ts');

  assert.match(activityType, /shoeId\?: string/);
  assert.match(activityType, /gearIds\?: string\[\]/);
  assert.match(activityScreen, /FlatList/);
  assert.match(activityScreen, /Search activity history/);
  assert.match(activityScreen, /filterActivities/);
  assert.match(manual, /useGearStore/);
  assert.match(manual, /shoeId: showShoePicker/);
  assert.match(more, /Gear/);
  assert.match(more, /HEALTHY PROGRESS/);
  assert.match(tabs, /more\/gear/);
  assert.match(gearStore, /createAppJSONStorage/);
  assert.match(gearStore, /blePeripheralId\?: string/);
});
