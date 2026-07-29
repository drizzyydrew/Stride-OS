import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { Activity } from '../../src/types/activity';
import type { Shoe } from '../../src/store/gearStore';
import {
  compareDateOnly,
  dateOnlyFromParts,
  dateOnlyToLocalTimestamp,
  formatDateOnly,
  isValidDateOnly,
  parseDateOnlyDisplay,
  timestampToDateOnly,
} from '../../src/utils/dateOnly';
import {
  buildStrideReport,
  buildStrideReportSharePayload,
  formatReportDistance,
  formatReportElevation,
} from '../../src/utils/strideReport';
import { buildPerformanceForecast, buildTrainingOutlook } from '../../src/utils/trainingOutlook';

const NOW = Date.parse('2026-07-29T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const MILE = 1609.344;

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

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
    endTime: startTime + 45 * 60 * 1000,
    rpe: overrides.rpe ?? 5,
    notes: overrides.notes,
    symptoms: overrides.symptoms,
    indoor: overrides.indoor ?? false,
    shoeId: overrides.shoeId,
    metrics: {
      durationSeconds: 2700,
      distanceMeters: 3 * MILE,
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

function shoe(overrides: Partial<Shoe> & Pick<Shoe, 'id' | 'brand' | 'model'>): Shoe {
  return {
    addedAt: NOW - 100 * DAY_MS,
    active: true,
    ...overrides,
  };
}

test('Build 47 date-only utilities use MM/DD/YYYY display, ISO storage, and exact local-day timestamps', () => {
  assert.equal(formatDateOnly('2026-07-29'), '07/29/2026');
  assert.equal(parseDateOnlyDisplay('07/29/2026'), '2026-07-29');
  assert.equal(parseDateOnlyDisplay('07-29-2026'), '2026-07-29');
  assert.equal(parseDateOnlyDisplay('2026-07-29'), '2026-07-29');
  assert.equal(timestampToDateOnly(dateOnlyToLocalTimestamp('2026-03-08')), '2026-03-08');
  assert.equal(timestampToDateOnly(dateOnlyToLocalTimestamp('2026-11-01')), '2026-11-01');
  assert.equal(isValidDateOnly('2028-02-29'), true);
  assert.equal(isValidDateOnly('2027-02-29'), false);
  assert.equal(dateOnlyFromParts(2026, 0, 31), '2026-01-31');
  assert.equal(dateOnlyFromParts(2026, 3, 31), null);
  assert.ok(compareDateOnly('2026-07-29', '2026-07-30') < 0);
});

test('Build 47 shared picker architecture keeps viewport and footer separate and exposes hundredths distance', () => {
  const picker = read('src/components/ui/PickerWheel.tsx');
  const training = read('app/(tabs)/training/index.tsx');
  const checkIn = read('src/components/today/ReadinessCheckInCard.tsx');

  assert.match(picker, /function PickerSheet/);
  assert.match(picker, /styles\.viewport/);
  assert.match(picker, /styles\.divider/);
  assert.match(picker, /styles\.actions/);
  assert.match(picker, /useSafeAreaInsets/);
  assert.match(picker, /KeyboardAvoidingView/);
  assert.match(picker, /accessibilityRole="adjustable"/);
  assert.match(picker, /DistanceHundredthsPickerWheel/);
  assert.match(picker, /composeDistanceHundredths/);
  assert.match(training, /DistanceHundredthsPickerWheel/);
  assert.match(training, /title="Run distance"/);
  assert.match(training, /title="Race distance"/);
  assert.match(checkIn, /pendingOtherText/);
  assert.match(checkIn, /onDraftChange/);
});

test('Build 47 shared date component is used for editable calendar dates and manual Activity is date-only', () => {
  const dateField = read('src/components/ui/StrideDateField.tsx');
  const manual = read('app/(tabs)/activity/manual.tsx');
  const settings = read('app/(tabs)/settings/index.tsx');
  const plans = read('app/(tabs)/activity/plans.tsx');
  const onboarding = read('app/onboarding/goal.tsx');
  const calibration = read('app/(tabs)/profile/calibration.tsx');
  const logModal = read('src/components/shared/LogWorkoutModal.tsx');

  for (const source of [manual, settings, plans, onboarding, calibration, logModal]) {
    assert.match(source, /StrideDateField/);
    assert.doesNotMatch(source, /placeholder="YYYY-MM-DD"/);
  }
  assert.match(dateField, /MONTH_NAMES/);
  assert.match(dateField, /Previous month/);
  assert.match(dateField, /Next month/);
  assert.match(dateField, /Choose month and year/);
  assert.match(dateField, /Selected-date|selected/i);
  assert.match(dateField, /today/i);
  assert.match(manual, /dateOnlyToLocalTimestamp/);
  assert.doesNotMatch(manual, /Start time/);
  assert.doesNotMatch(manual, /TIME ZONE/);
});

test('Build 47 Training Outlook removes duplicated Load while Performance Forecast owns Load Trend', () => {
  const dashboard = read('app/(tabs)/dashboard/index.tsx');
  assert.match(dashboard, /TRAINING OUTLOOK/);
  assert.match(dashboard, /Training Focus/);
  assert.match(dashboard, /Recommended Action/);
  assert.match(dashboard, /History and Confidence/);
  assert.doesNotMatch(dashboard, />Load<\/Text>/);
  assert.match(dashboard, /PERFORMANCE FORECAST/);
  assert.match(dashboard, /Forecast Details/);
  assert.match(dashboard, /About \$\{metric\.label\}/);

  const outlook = buildTrainingOutlook({
    activities: [activity({ id: 'old', startTime: NOW - 20 * DAY_MS }), activity({ id: 'recent', startTime: NOW - DAY_MS, trainingLoad: { wholeBody: 120 } as never })],
    focus: 'Aerobic Foundation',
    now: NOW,
  });
  const forecast = buildPerformanceForecast(outlook);
  const loadMetric = forecast.metrics.find(metric => metric.key === 'training_load_trend');
  assert.ok(loadMetric);
  assert.match(loadMetric.visualLabel ?? '', /Building|Stable|Reducing|Ramping|Deloading|Developing/);
});

test('Build 47 Performance Forecast insufficient-history states are confidence-safe', () => {
  const outlook = buildTrainingOutlook({ activities: [], now: NOW, weeksToRace: 12 });
  const forecast = buildPerformanceForecast(outlook, { weeksToRace: 12 });
  assert.equal(forecast.metrics.find(metric => metric.key === 'peak_window')?.visualLabel, 'Not Yet Available');
  assert.equal(forecast.metrics.find(metric => metric.key === 'race_readiness')?.visualLabel, 'Developing');
  assert.doesNotMatch(JSON.stringify(forecast), /\b[A-Z][a-z]{2}\s+\d{1,2}\b/);
  assert.doesNotMatch(JSON.stringify(forecast), /guaranteed performance|race-ready prediction/i);
});

test('Build 47 Stride Report formats elevation by unit preference and keeps source data unchanged', () => {
  assert.equal(formatReportDistance(10, 'imperial'), '10.0 mi');
  assert.equal(formatReportDistance(10, 'metric'), '16.1 km');
  assert.equal(formatReportElevation(100, 'imperial'), '328 ft');
  assert.equal(formatReportElevation(100, 'metric'), '100 m');

  const source = activity({ id: 'hilly', metrics: { distanceMeters: 2 * MILE, elevationGainMeters: 100 } });
  const report = buildStrideReport({ period: 'weekly', now: NOW, activities: [source] });
  assert.equal(report.totals.elevationGainMeters, 100);
  assert.equal(source.metrics.elevationGainMeters, 100);
  assert.equal(report.totals.averageElevationGainMeters, 100);
  assert.equal(report.highestElevationActivity?.elevationGainMeters, 100);
});

test('Build 47 Shoe Report aggregates period distance, elevation, unassigned, retired history, and privacy defaults', () => {
  const shoes = [
    shoe({ id: 'pegasus', brand: 'Nike', model: 'Pegasus 41' }),
    shoe({ id: 'cascadia', brand: 'Brooks', model: 'Cascadia', active: false, retirementDate: '2026-07-27' }),
  ];
  const activities = [
    activity({ id: 'peg_1', shoeId: 'pegasus', metrics: { distanceMeters: 4 * MILE, elevationGainMeters: 30 } }),
    activity({ id: 'peg_2', shoeId: 'pegasus', startTime: NOW - DAY_MS, metrics: { distanceMeters: 2 * MILE, elevationGainMeters: 10 } }),
    activity({ id: 'cas_1', shoeId: 'cascadia', startTime: NOW - 2 * DAY_MS, metrics: { distanceMeters: 3 * MILE, elevationGainMeters: 300 } }),
    activity({ id: 'unassigned', startTime: NOW - 3 * DAY_MS, metrics: { distanceMeters: MILE, elevationGainMeters: 0 } }),
    activity({ id: 'old', shoeId: 'pegasus', startTime: NOW - 40 * DAY_MS, metrics: { distanceMeters: 10 * MILE } }),
  ];
  const report = buildStrideReport({ period: 'weekly', now: NOW, activities, shoes });

  assert.equal(report.shoeReport.mostUsed?.label, 'Nike Pegasus 41');
  assert.equal(report.shoeReport.mostUsed?.periodDistanceMiles, 6);
  assert.equal(report.shoeReport.highestElevation?.label, 'Brooks Cascadia');
  assert.equal(report.shoeReport.highestElevation?.periodElevationGainMeters, 300);
  assert.equal(report.shoeReport.unassigned?.periodRuns, 1);
  assert.equal(report.shoeReport.retiredDuringPeriod[0]?.label, 'Brooks Cascadia');
  assert.equal(report.shoeReport.currentRotation.some(summary => summary.label === 'Nike Pegasus 41'), true);
  assert.equal(report.shoeReport.privacyDefaults.includePhotos, false);
  assert.equal(report.shoeReport.privacyDefaults.includePrivateNotes, false);
  assert.equal(report.shoeReport.byShoe.find(summary => summary.label === 'Nike Pegasus 41')?.lifetimeDistanceMiles, 16);
});

test('Build 47 Stride Report screen and share cards use canonical naming and unit formatters', () => {
  const screen = read('app/(tabs)/more/stride-report.tsx');
  const clean = read('src/components/report/ShareCardCleanSummary.tsx');
  const data = read('src/components/report/ShareCardDataFocus.tsx');
  const achievement = read('src/components/report/ShareCardAchievementFocus.tsx');
  const payload = buildStrideReportSharePayload(
    buildStrideReport({ period: 'weekly', now: NOW, activities: [activity()] }),
    'data_focus',
    'metric',
  );

  assert.match(screen, /title="Stride Report"/);
  assert.doesNotMatch(screen, /title="Training Report"/);
  assert.match(screen, /SHOE REPORT/);
  assert.match(screen, /Shoe photos and private notes are excluded/);
  for (const source of [screen, clean, data, achievement]) {
    assert.match(source, /formatReportDistance/);
  }
  assert.match(data, /formatReportElevation/);
  assert.match(payload.headline, /km/);
});
