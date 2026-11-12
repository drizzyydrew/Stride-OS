import assert from 'node:assert/strict';
import test from 'node:test';
import { formatArchivedCoverage } from '../goalArchiveCoverage';

function summary(total = 62, distance = 47, duration = 62) {
  return { completedActivities: total - 2, partialActivities: 2,
    activityIds: Array.from({ length: total }, (_, index) => `activity-${index}`),
    coverage: { distanceActivities: distance, durationActivities: duration } };
}

test('frozen coverage uses completed plus partial activities, not the duration or distance coverage denominator', () => {
  const value = summary(62, 47, 60);
  const before = JSON.stringify(value);
  assert.equal(formatArchivedCoverage(value), 'Distance available for 47 of 62 activities. Duration available for 60 of 62 activities. Totals include recorded values. Missing values appear as —.');
  assert.equal(JSON.stringify(value), before);
});
test('conflicting legacy activity counts or duplicate/missing links show coverage without claiming a total', () => {
  const base = summary();
  for (const value of [{ ...base, completedActivities: 61 }, { ...base, activityIds: [] },
    { ...base, activityIds: [...base.activityIds.slice(1), base.activityIds[1]] }]) {
    assert.equal(formatArchivedCoverage(value), 'Distance available for 47 activities. Duration available for 62 activities. Totals include recorded values. Missing values appear as —.');
  }
});
test('coverage exceeding the frozen total cannot produce an impossible of-total claim', () => {
  const text = formatArchivedCoverage(summary(62, 63, 62));
  assert.match(text, /Distance available for 63 activities/);
  assert.doesNotMatch(text, / of 62/);
});
test('zero known coverage remains zero, while unavailable coverage is never synthesized as zero', () => {
  assert.match(formatArchivedCoverage(summary(62, 0, 62)), /Distance available for 0 of 62 activities/);
  const unknown = { ...summary(), coverage: { distanceActivities: undefined, durationActivities: 62 } } as any;
  assert.match(formatArchivedCoverage(unknown), /Distance coverage is unavailable/);
  assert.doesNotMatch(formatArchivedCoverage(unknown), /Distance available for 0/);
});
test('empty and singular snapshots stay plain and avoid zero-of-zero arithmetic', () => {
  const empty = { completedActivities: 0, partialActivities: 0, activityIds: [], coverage: { distanceActivities: 0, durationActivities: 0 } };
  assert.match(formatArchivedCoverage(empty), /Distance available for 0 activities/);
  assert.doesNotMatch(formatArchivedCoverage(empty), /0 of 0/);
  assert.match(formatArchivedCoverage({ ...empty, completedActivities: 1, activityIds: ['one'], coverage: { distanceActivities: 1, durationActivities: 0 } }), /Distance available for 1 of 1 activity\. Duration available for 0 of 1 activity\./);
});
test('nonfinite and invalid legacy totals fall back to actual metric coverage counts', () => {
  for (const invalid of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
    const value = { ...summary(), completedActivities: invalid };
    assert.doesNotMatch(formatArchivedCoverage(value), / of /);
    assert.match(formatArchivedCoverage(value), /Distance available for 47 activities/);
  }
});
