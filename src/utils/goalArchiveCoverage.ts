import type { GoalArchive } from '../types/goalArchive';

type CoverageSummary = Pick<GoalArchive['summary'], 'completedActivities' | 'partialActivities' | 'activityIds' | 'coverage'>;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** These counts describe the frozen snapshot. Never use current Activity rows or
 * one metric's coverage as the total, and never treat missing values as zero. */
export function formatArchivedCoverage(summary: CoverageSummary): string {
  const distance = summary.coverage?.distanceActivities;
  const duration = summary.coverage?.durationActivities;
  const total = count(summary.completedActivities) && count(summary.partialActivities)
    ? summary.completedActivities + summary.partialActivities : null;
  const ids = summary.activityIds;
  const safeTotal = total != null && count(total) && total > 0 && Array.isArray(ids)
    && ids.every(id => typeof id === 'string' && id.length > 0) && new Set(ids).size === ids.length && ids.length === total
    && count(distance) && count(duration) && distance <= total && duration <= total ? total : null;
  function line(label: string, available: unknown): string {
    if (!count(available)) return `${label} coverage is unavailable.`;
    const denominator = safeTotal == null ? '' : ` of ${safeTotal.toLocaleString()}`;
    const noun = (safeTotal ?? available) === 1 ? 'activity' : 'activities';
    return `${label} available for ${available.toLocaleString()}${denominator} ${noun}.`;
  }
  return `${line('Distance', distance)} ${line('Duration', duration)} Totals include recorded values. Missing values appear as —.`;
}
