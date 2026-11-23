import type { GoalArchive } from '../types/goalArchive';

/** Keep raw tombstones for source-key backfill, but never offer deleted archives as plans. */
export function visibleGoalArchives(archives: readonly GoalArchive[]): GoalArchive[] {
  const deleted = new Set(archives.filter(row => row.deletedAt !== undefined).map(row => `${row.ownerUserId}:${row.sourceKey}`));
  return archives.filter(row => !deleted.has(`${row.ownerUserId}:${row.sourceKey}`)).map(row => row.metadata
    ? { ...row, title: row.metadata.title, startDate: row.metadata.startDate, endDate: row.metadata.endDate } : row);
}
