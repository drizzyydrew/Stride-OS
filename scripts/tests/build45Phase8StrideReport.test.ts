import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Activity } from '../../src/types/activity';
import type { Shoe } from '../../src/store/gearStore';
import { buildStrideReport, buildStrideReportSharePayload } from '../../src/utils/strideReport';

const NOW = Date.UTC(2026, 6, 26, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;
const MILE = 1609.344;

function activity(overrides: Partial<Activity> = {}): Activity {
  const startTime = overrides.startTime ?? NOW;
  return {
    id: overrides.id ?? `activity_${startTime}`,
    activityType: overrides.activityType ?? 'running',
    subtype: overrides.subtype ?? 'outdoor',
    source: 'manual',
    status: overrides.status ?? 'completed',
    scheduled: false,
    startTime,
    endTime: startTime + 30 * 60 * 1000,
    rpe: overrides.rpe ?? 5,
    notes: overrides.notes,
    symptoms: overrides.symptoms,
    indoor: overrides.indoor ?? false,
    shoeId: overrides.shoeId,
    metrics: {
      durationSeconds: 1800,
      distanceMeters: MILE,
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

test('Stride Report aggregates distance, run averages, strength, cross-training, and active days', () => {
  const report = buildStrideReport({
    period: 'weekly',
    now: NOW,
    activities: [
      activity({ id: 'run_1', startTime: NOW - DAY_MS, metrics: { distanceMeters: 3 * MILE, durationSeconds: 1800 } }),
      activity({ id: 'run_2', startTime: NOW - 2 * DAY_MS, metrics: { distanceMeters: 5 * MILE, durationSeconds: 2400 } }),
      activity({ id: 'walk', activityType: 'walking', startTime: NOW - 2 * DAY_MS, metrics: { distanceMeters: MILE, durationSeconds: 1200 } }),
      activity({ id: 'lift', activityType: 'strength', indoor: true, metrics: { durationSeconds: 2700, distanceMeters: undefined } }),
      activity({ id: 'bike', activityType: 'indoor_cycling', indoor: true, metrics: { durationSeconds: 1800, distanceMeters: 6 * MILE } }),
      activity({ id: 'old', startTime: NOW - 20 * DAY_MS, metrics: { distanceMeters: 20 * MILE } }),
      activity({ id: 'skip', status: 'skipped', metrics: { distanceMeters: 10 * MILE } }),
    ],
  });

  assert.equal(report.totals.distanceMiles, 15);
  assert.equal(report.totals.runs, 2);
  assert.equal(report.totals.averageRunMiles, 4);
  assert.equal(report.totals.strengthSessions, 1);
  assert.equal(report.totals.crossTrainingSessions, 1);
  assert.equal(report.totals.activeDays, 3);
  assert.equal(report.longestRun?.id, 'run_2');
});

test('Stride Report excludes treadmill and missing elevation from elevation averages and highest-elevation activity', () => {
  const report = buildStrideReport({
    period: 'weekly',
    now: NOW,
    activities: [
      activity({ id: 'outdoor_hilly', metrics: { elevationGainMeters: 120, distanceMeters: 3 * MILE } }),
      activity({ id: 'outdoor_flat_valid', startTime: NOW - DAY_MS, metrics: { elevationGainMeters: 0, distanceMeters: 2 * MILE } }),
      activity({
        id: 'treadmill_fake',
        subtype: 'treadmill',
        indoor: true,
        metrics: { elevationGainMeters: 900, distanceMeters: 4 * MILE, distanceSource: 'treadmill_reported' },
      }),
      activity({ id: 'missing_elevation', startTime: NOW - 2 * DAY_MS, metrics: { distanceMeters: 2 * MILE } }),
    ],
  });

  assert.equal(report.totals.elevationGainMeters, 120);
  assert.equal(report.totals.averageElevationGainMeters, 60);
  assert.equal(report.highestElevationActivity?.id, 'outdoor_hilly');
});

test('Stride Report handles sparse and empty periods without NaN or fabricated claims', () => {
  const report = buildStrideReport({ period: 'weekly', now: NOW, activities: [] });
  const encoded = JSON.stringify(report);

  assert.equal(report.totals.distanceMiles, 0);
  assert.equal(report.totals.averageRunMiles, null);
  assert.equal(report.totals.averageElevationGainMeters, null);
  assert.equal(report.longestRun, null);
  assert.doesNotMatch(encoded, /NaN|Infinity/);
});

test('weekly may include upcoming focus while monthly and yearly stay retrospective', () => {
  const weekly = buildStrideReport({ period: 'weekly', now: NOW, activities: [], upcomingFocus: 'Running Economy' });
  const monthly = buildStrideReport({ period: 'monthly', now: NOW, activities: [], upcomingFocus: 'Running Economy' });
  const yearly = buildStrideReport({ period: 'yearly', now: NOW, activities: [], upcomingFocus: 'Running Economy' });

  assert.equal(weekly.upcomingFocus, 'Running Economy');
  assert.equal(monthly.upcomingFocus, undefined);
  assert.equal(yearly.upcomingFocus, undefined);
});

test('Stride Report derives most-used shoe and route without exposing route maps or private fields', () => {
  const report = buildStrideReport({
    period: 'weekly',
    now: NOW,
    shoes: [shoe('shoe_a', 'Daily'), shoe('shoe_b', 'Speed')],
    activities: [
      activity({
        id: 'private',
        shoeId: 'shoe_a',
        notes: 'private note should not be shared',
        symptoms: ['knee soreness'],
        metrics: {
          distanceMeters: 3 * MILE,
          routeId: 'route_private',
          routeCoordinates: [{ latitude: 40.1, longitude: -73.1, timestamp: NOW }],
        },
      }),
      activity({ id: 'second', shoeId: 'shoe_a', metrics: { distanceMeters: 2 * MILE, routeId: 'route_private' } }),
      activity({ id: 'other_shoe', shoeId: 'shoe_b', metrics: { distanceMeters: MILE, routeId: 'route_other' } }),
    ],
  });
  const payload = buildStrideReportSharePayload(report, 'data_focus');
  const encoded = JSON.stringify(payload);

  assert.equal(report.mostUsedShoe?.label, 'Test Daily');
  assert.equal(report.mostUsedRoute?.routeId, 'route_private');
  assert.equal(payload.privacyDefaults.includeRouteMaps, false);
  assert.doesNotMatch(encoded, /routeCoordinates|latitude|longitude|private note|knee soreness/i);
});

test('Phase 8 source contracts add Stride Report route, share-card variants, and web-safe native sharing fallback', () => {
  const more = read('app/(tabs)/more/index.tsx');
  const tabs = read('app/(tabs)/_layout.tsx');
  const route = read('app/(tabs)/more/stride-report.tsx');
  const share = read('src/lib/shareCard.ts');
  const nativeShare = read('src/lib/shareCard.native.ts');

  assert.match(more, /Stride Report/);
  assert.match(tabs, /more\/stride-report/);
  assert.match(route, /ShareCardCleanSummary/);
  assert.match(route, /ShareCardDataFocus/);
  assert.match(route, /ShareCardAchievementFocus/);
  assert.match(share, /available on device/);
  assert.doesNotMatch(share, /@shopify\/react-native-skia/);
  assert.match(nativeShare, /makeImageFromView/);
  assert.match(nativeShare, /expo-file-system\/legacy/);
});
