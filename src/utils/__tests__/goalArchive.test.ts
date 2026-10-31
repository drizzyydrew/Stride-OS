import assert from 'node:assert/strict';
import test from 'node:test';

import type { Activity } from '../../types/activity';
import type { RacePR } from '../../types/athlete';
import type { GeneratedBeginnerPlan } from '../../types/beginnerPlan';
import type { GoalArchiveDescriptor } from '../../types/goalArchive';
import type { MacroPlan, Race } from '../../types/plan';
import { buildGoalArchive } from '../goalArchive';

const NOW = 1_800_000_000_000;
const descriptor: GoalArchiveDescriptor = {
  sourceKey: 'race:fall-5k', ownerUserId: 'owner', athleteId: 'athlete',
  title: 'Fall 5K', kind: 'race', goalType: 'race_prep',
  startDate: '2026-10-01', endDate: '2026-10-31',
};
const race: Race = {
  id: 'fall-5k', name: 'Fall 5K', date: '2026-10-31', distance: '5k', priority: 'A',
};

function activity(id: string, localTime: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id, activityType: 'running', source: 'manual', status: 'completed',
    scheduled: false, indoor: false, startTime: new Date(localTime).getTime(),
    createdAt: 1, updatedAt: 1, metrics: {},
    trainingLoad: {
      method: 'session_rpe', wholeBody: 8, running: 8, walking: 0,
      strength: 0, crossTraining: 0, impactBearing: 8, nonImpactAerobic: 0, confidence: 'high',
    },
    ...overrides,
  };
}

function pr(overrides: Partial<RacePR> = {}): RacePR {
  return {
    id: 'official', distanceKey: '5k', distanceLabel: '5K', distanceMeters: 5000,
    timeSeconds: 1500, date: race.date, official: true, ...overrides,
  };
}

test('includes both local boundary days and only completed/partial activities', () => {
  const archive = buildGoalArchive(descriptor, [
    activity('before', '2026-09-30T23:59:59.999'),
    activity('first', '2026-10-01T00:00:00', {
      metrics: { distanceMeters: 5000, durationSeconds: 1800, elevationGainMeters: 25 },
    }),
    activity('partial', '2026-10-01T12:00:00', {
      status: 'partial', metrics: { distanceMeters: 1000, durationSeconds: 600 },
    }),
    activity('last', '2026-10-31T23:59:59.999', { metrics: { durationSeconds: 60 } }),
    activity('after', '2026-11-01T00:00:00'),
    activity('skipped', '2026-10-15T12:00:00', {
      status: 'skipped', metrics: { distanceMeters: 999999, durationSeconds: 999999 },
    }),
    activity('invalid-time', 'invalid'),
    activity('out-of-js-date-range', 'invalid', { startTime: 1e20 }),
  ], [], NOW);

  assert.equal(archive.schemaVersion, 1);
  assert.equal(archive.archivedAt, NOW);
  assert.deepEqual(archive.summary, {
    completedActivities: 2, partialActivities: 1, activeDays: 2,
    distanceMeters: 6000, durationSeconds: 2460, elevationGainMeters: 25, trainingLoad: 24,
    activityIds: ['first', 'partial', 'last'],
    weeks: [
      { startDate: '2026-09-27', activityCount: 2, distanceMeters: 6000, durationSeconds: 2400 },
      { startDate: '2026-10-25', activityCount: 1, distanceMeters: null, durationSeconds: 60 },
    ],
    coverage: { distanceActivities: 2, durationActivities: 3 },
  });
});

test('DST uses local calendar boundaries, including both repeated hours and Sunday buckets', () => {
  const originalTZ = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(new Date('2026-11-01T12:00:00').getTimezoneOffset(), 480);
    const fall = buildGoalArchive({ ...descriptor, startDate: '2026-11-01', endDate: '2026-11-01' }, [
      activity('before', '2026-11-01T06:59:59.999Z'),
      activity('midnight', '2026-11-01T07:00:00Z'),
      activity('first-1am', '2026-11-01T01:30:00-07:00'),
      activity('second-1am', '2026-11-01T01:30:00-08:00'),
      activity('late', '2026-11-02T07:59:59.999Z'),
      activity('after', '2026-11-02T08:00:00Z'),
    ], [], NOW);
    assert.deepEqual(fall.summary.activityIds, ['midnight', 'first-1am', 'second-1am', 'late']);
    assert.equal(fall.summary.activeDays, 1);
    assert.equal(fall.summary.weeks[0].startDate, '2026-11-01');

    const spring = buildGoalArchive({ ...descriptor, startDate: '2026-03-08', endDate: '2026-03-14' }, [
      activity('sunday', '2026-03-08T00:00:00'),
      activity('saturday', '2026-03-14T23:59:59.999'),
      activity('next-week', '2026-03-15T00:00:00'),
    ], [], NOW);
    assert.equal(spring.summary.weeks.length, 1);
    assert.equal(spring.summary.weeks[0].startDate, '2026-03-08');
    assert.equal(spring.summary.weeks[0].activityCount, 2);
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});

test('rejects malformed, impossible and reversed date ranges; accepts leap day', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01',
    '2026-10-00', '2026-10-32', '2026-1-01', '2026-10-01T00:00:00Z', '0000-01-01', '']) {
    assert.throws(() => buildGoalArchive({ ...descriptor, startDate: date }, [], [], NOW), RangeError);
    assert.throws(() => buildGoalArchive({ ...descriptor, endDate: date }, [], [], NOW), RangeError);
  }
  assert.throws(() => buildGoalArchive({ ...descriptor, endDate: '2026-09-30' }, [], [], NOW), RangeError);
  assert.doesNotThrow(() => buildGoalArchive({ ...descriptor, startDate: '2024-02-29', endDate: '2024-02-29' }, [], [], NOW));
  for (const now of [NaN, Infinity, -1]) {
    assert.throws(() => buildGoalArchive(descriptor, [], [], now), RangeError);
  }
});

test('stable ID depends on source and athlete, never time, title or activity order', () => {
  const activities = [activity('b', '2026-10-02T12:00:00'), activity('a', '2026-10-01T12:00:00')];
  const first = buildGoalArchive(descriptor, activities, [], NOW);
  assert.deepEqual(first, buildGoalArchive(descriptor, [...activities].reverse(), [], NOW));
  const second = buildGoalArchive({ ...descriptor, title: 'Renamed' }, activities, [], NOW + 1);
  assert.equal(first.id, second.id);
  assert.notEqual(first.id, buildGoalArchive({ ...descriptor, athleteId: 'other' }, [], [], NOW).id);
  assert.notEqual(first.id, buildGoalArchive({ ...descriptor, sourceKey: 'other' }, [], [], NOW).id);
  assert.notEqual(
    buildGoalArchive({ ...descriptor, athleteId: 'a:b', sourceKey: 'c' }, [], [], NOW).id,
    buildGoalArchive({ ...descriptor, athleteId: 'a', sourceKey: 'b:c' }, [], [], NOW).id,
  );
  const before = Date.now();
  const defaultNow = buildGoalArchive(descriptor, [], []).archivedAt;
  assert.ok(defaultNow >= before && defaultNow <= Date.now());
});

test('deduplicates IDs, shared instances and transitive legacy duplicates before aggregation', () => {
  const inputs = [
    activity('same', '2026-10-01T12:00:00', { workoutInstanceId: 'instance-a', metrics: { distanceMeters: 200 } }),
    activity('same', '2026-10-01T12:00:00', { workoutInstanceId: 'instance-b', metrics: { distanceMeters: 300 } }),
    activity('legacy', '2026-10-01T12:00:00', {
      workoutInstanceId: 'instance-b', updatedAt: 2, metrics: { distanceMeters: 400 },
    }),
    activity('newer-partial', '2026-10-01T12:00:00', {
      workoutInstanceId: 'instance-a', status: 'partial', updatedAt: 10, metrics: { distanceMeters: 100 },
    }),
    activity('independent', '2026-10-02T12:00:00', { metrics: { distanceMeters: 50 } }),
    activity('skipped', '2026-10-02T12:00:00', { status: 'skipped', workoutInstanceId: 'instance-a' }),
  ];
  const archive = buildGoalArchive(descriptor, inputs, [], NOW);
  assert.deepEqual(archive.summary.activityIds, ['legacy', 'independent']);
  assert.equal(archive.summary.distanceMeters, 450);
  assert.equal(archive.summary.completedActivities, 2);
  assert.equal(archive.summary.partialActivities, 0);
  assert.deepEqual(archive, buildGoalArchive(descriptor, [...inputs].reverse(), [], NOW));
});

test('unknown and invalid metrics stay null, while explicit zero is known', () => {
  const unknownLoad = undefined as unknown as Activity['trainingLoad'];
  const missing = activity('missing', '2026-10-01T12:00:00', { trainingLoad: unknownLoad });
  const invalid = activity('invalid', '2026-10-02T12:00:00', {
    metrics: { distanceMeters: NaN, durationSeconds: Infinity, elevationGainMeters: -1 },
    trainingLoad: { ...missing.trainingLoad, wholeBody: NaN } as Activity['trainingLoad'],
  });
  const archive = buildGoalArchive(descriptor, [missing, invalid], [], NOW);
  for (const key of ['distanceMeters', 'durationSeconds', 'elevationGainMeters', 'trainingLoad'] as const) {
    assert.equal(archive.summary[key], null);
  }
  assert.deepEqual(archive.summary.coverage, { distanceActivities: 0, durationActivities: 0 });
  const zeros = buildGoalArchive(descriptor, [invalid, activity('zero', '2026-10-03T12:00:00', {
    metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0 },
    trainingLoad: { ...activity('fixture', '').trainingLoad, wholeBody: 0 },
  })], [], NOW);
  assert.equal(zeros.summary.distanceMeters, 0);
  assert.equal(zeros.summary.durationSeconds, 0);
  assert.equal(zeros.summary.elevationGainMeters, 0);
  assert.equal(zeros.summary.trainingLoad, 0);
  assert.deepEqual(zeros.summary.coverage, { distanceActivities: 1, durationActivities: 1 });
});

test('duration uses recorded metrics without inventing duration from activity timestamps', () => {
  const archive = buildGoalArchive(descriptor, [
    activity('duration', '2026-10-01T12:00:00', { metrics: { durationSeconds: 30, activeTimeSeconds: 20 } }),
    activity('active', '2026-10-02T12:00:00', { metrics: { activeTimeSeconds: 15 } }),
    activity('wall', '2026-10-03T12:00:00', {
      endTime: new Date('2026-10-03T13:00:00').getTime(), metrics: { elapsedTimeSeconds: 3600 },
    }),
  ], [], NOW);
  assert.equal(archive.summary.durationSeconds, 45);
  assert.equal(archive.summary.coverage.durationActivities, 2);
  assert.deepEqual(archive.result, { status: 'unrecorded' });
});

test('overflow cannot produce nonfinite aggregate metrics', () => {
  const archive = buildGoalArchive(descriptor, ['a', 'b'].map(id => activity(id, '2026-10-01T12:00:00', {
    metrics: { distanceMeters: Number.MAX_VALUE, durationSeconds: Number.MAX_VALUE },
  })), [], NOW);
  assert.equal(archive.summary.distanceMeters, null);
  assert.equal(archive.summary.weeks[0].durationSeconds, null);
  assert.equal(archive.summary.coverage.distanceActivities, 2);
});

test('empty archives have no fabricated metrics, activities, weeks or results', () => {
  const archive = buildGoalArchive(descriptor, [], [], NOW);
  assert.deepEqual(archive.summary, {
    completedActivities: 0, partialActivities: 0, activeDays: 0,
    distanceMeters: null, durationSeconds: null, elevationGainMeters: null, trainingLoad: null,
    activityIds: [], weeks: [], coverage: { distanceActivities: 0, durationActivities: 0 },
  });
  assert.deepEqual(archive.result, { status: 'unrecorded' });
});

test('race-day training duration and unofficial PRs never create a race result', () => {
  const desc = { ...descriptor, race };
  const activities = [activity('race-day', '2026-10-31T12:00:00', {
    metrics: { distanceMeters: 5000, durationSeconds: 1500 },
  })];
  for (const records of [[], [pr({ official: false })], [pr({ date: '2026-10-30' })],
    [pr({ distanceMeters: 5000.1 })], [pr({ timeSeconds: NaN })], [pr({ timeSeconds: Infinity })],
    [pr({ timeSeconds: -1 })], [pr({ timeSeconds: 0 })]]) {
    assert.deepEqual(buildGoalArchive(desc, activities, records, NOW).result, { status: 'unrecorded' });
  }
  assert.deepEqual(buildGoalArchive(descriptor, activities, [pr()], NOW).result, { status: 'unrecorded' });
});

test('one distinct official time yields a result; conflicting times remain unrecorded', () => {
  const desc = { ...descriptor, race };
  const records = [pr(), pr({ id: 'duplicate' }), pr({ official: false, timeSeconds: 1600 })];
  assert.deepEqual(buildGoalArchive(desc, [], records, NOW).result, {
    status: 'finished', timeSeconds: 1500, source: 'race_record', updatedAt: NOW,
  });
  assert.deepEqual(buildGoalArchive(desc, [], [...records, pr({ id: 'conflict', timeSeconds: 1501 })], NOW).result,
    { status: 'unrecorded' });
  for (const date of ['2026-02-30', '2026-11-01']) {
    assert.deepEqual(buildGoalArchive({ ...desc, race: { ...race, date } }, [], [pr({ date })], NOW).result,
      { status: 'unrecorded' });
  }
});

test('all supported race distances match exact meters, including fractional half marathon', () => {
  for (const [distance, meters] of [
    ['5k', 5000], ['10k', 10000], ['half_marathon', 21097.5], ['marathon', 42195],
  ] as const) {
    const desc = { ...descriptor, race: { ...race, distance } };
    assert.equal(buildGoalArchive(desc, [], [pr({ distanceMeters: meters })], NOW).result.status, 'finished');
    assert.equal(buildGoalArchive(desc, [], [pr({ distanceMeters: meters + 1 })], NOW).result.status, 'unrecorded');
  }
});

test('snapshots deeply copy and freeze plans and summaries without freezing or mutating inputs', () => {
  const macroPlan: MacroPlan = {
    goalType: 'race_prep', startDate: '2026-09-27', totalWeeks: 1, generatedAt: 1,
    weeks: [{ weekNumber: 1, startDate: '2026-09-27', phase: 'base', isDeload: false,
      isTaper: false, isRaceWeek: false, focus: 'Base' }],
  };
  const beginnerPlan: GeneratedBeginnerPlan = {
    id: 'beginner', goal: 'couch_to_5k', primaryEnduranceMode: 'running', completionGoal: 'complete_distance',
    startDate: '2026-10-01', targetDate: '2026-10-31', durationWeeks: 4, createdAt: 1,
    recommendation: {
      recommendedWeeks: 4, minimumSupportedWeeks: 4, earliestSupportedTargetDate: '2026-10-31',
      reasoning: ['Build gradually'], progressionRequirements: ['Walk first'], accelerated: false,
    },
    weeks: [],
  };
  const desc = { ...descriptor, race: { ...race }, macroPlan, beginnerPlan };
  const inputs = [activity('a', '2026-10-01T12:00:00', { metrics: { distanceMeters: 100 } })];
  const records = [pr()];
  const before = structuredClone({ desc, inputs, records });
  const archive = buildGoalArchive(desc, inputs, records, NOW);
  assert.deepEqual({ desc, inputs, records }, before);
  assert.notEqual(archive.macroPlan, macroPlan);
  assert.notEqual(archive.macroPlan!.weeks[0], macroPlan.weeks[0]);
  assert.notEqual(archive.beginnerPlan!.recommendation.reasoning, beginnerPlan.recommendation.reasoning);
  const assertDeepFrozen = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    assert.ok(Object.isFrozen(value));
    Object.values(value).forEach(assertDeepFrozen);
  };
  assertDeepFrozen(archive);
  assert.equal(Reflect.set(archive.race!, 'name', 'Changed'), false);
  assert.equal(Reflect.set(archive.result, 'timeSeconds', 999), false);
  assert.throws(() => archive.summary.activityIds.push('extra'), TypeError);
  macroPlan.weeks[0].focus = 'Changed';
  beginnerPlan.recommendation.reasoning.push('Changed');
  desc.race.name = 'Changed';
  inputs[0].metrics.distanceMeters = 999;
  records[0].timeSeconds = 999;
  assert.equal(archive.race!.name, 'Fall 5K');
  assert.equal(archive.macroPlan!.weeks[0].focus, 'Base');
  assert.deepEqual(archive.beginnerPlan!.recommendation.reasoning, ['Build gradually']);
  assert.equal(archive.summary.distanceMeters, 100);
  assert.equal(archive.result.timeSeconds, 1500);
});
