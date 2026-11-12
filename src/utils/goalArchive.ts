import { isValidRaceActivityLink } from './raceLink';
import type { Activity } from '../types/activity';
import type { RacePR } from '../types/athlete';
import type { GoalArchive, GoalArchiveDescriptor } from '../types/goalArchive';
import type { Race } from '../types/plan';

const RACE_METERS: Record<Race['distance'], number> = {
  '5k': 5000,
  '10k': 10000,
  half_marathon: 21097.5,
  marathon: 42195,
};

function dateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Parse calendar dates locally without accepting Date's rollover normalization. */
function localDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return null;
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return dateKey(date) === value ? date : null;
}

function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function total(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? nonnegative(known.reduce((sum, value) => sum + value, 0)) : null;
}

/** Copy before freezing, so caller-owned plans and their nested arrays stay mutable. */
function frozenCopy<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  const copy = Array.isArray(value)
    ? value.map(item => frozenCopy(item))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, frozenCopy(item)]));
  return Object.freeze(copy) as T;
}

function uniqueActivities(activities: readonly Activity[]): Activity[] {
  // Union both identities before selecting records, including transitive duplicates.
  const parents = activities.map((_, index) => index);
  const root = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const ids = new Map<string, number>();
  const instances = new Map<string, number>();
  activities.forEach((activity, index) => {
    const instance = activity.workoutInstanceId || activity.healthKit?.workoutInstanceId;
    for (const [map, key] of [[ids, activity.id], [instances, instance]] as const) {
      if (!key) continue;
      const prior = map.get(key);
      if (prior !== undefined) parents[root(index)] = root(prior);
      map.set(key, index);
    }
  });
  const groups = new Map<number, Activity>();
  // Completed wins over partial; otherwise retain the most recently updated record.
  const ordered = [...activities].sort((a, b) =>
    Number(b.status === 'completed') - Number(a.status === 'completed')
    || (nonnegative(b.updatedAt) ?? 0) - (nonnegative(a.updatedAt) ?? 0)
    || a.startTime - b.startTime
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const indices = new Map(activities.map((activity, index) => [activity, index]));
  for (const activity of ordered) {
    const group = root(indices.get(activity)!);
    if (!groups.has(group)) groups.set(group, activity);
  }
  return [...groups.values()].sort((a, b) => a.startTime - b.startTime
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function raceResult(descriptor: GoalArchiveDescriptor, racePRs: readonly RacePR[], now: number, activities: readonly Activity[]): GoalArchive['result'] {
  const race = descriptor.race;
  if (race) {
    const linked = activities.filter(activity => isValidRaceActivityLink(activity.raceLink, descriptor.ownerUserId)
      && activity.raceLink.event.id === race.id);
    if (linked.length === 1) return { status: 'unrecorded', source: 'activity_link', linkedActivityId: linked[0].id, updatedAt: now };
    if (linked.length > 1) return { status: 'unrecorded' };
  }
  if (!race || !localDate(race.date) || race.date < descriptor.startDate || race.date > descriptor.endDate) {
    return { status: 'unrecorded' };
  }
  const times = new Set(racePRs.filter(pr => pr.official === true
    && pr.date === race.date
    && pr.distanceMeters === RACE_METERS[race.distance]
    && nonnegative(pr.timeSeconds) !== null && pr.timeSeconds > 0)
    .map(pr => pr.timeSeconds));
  return times.size === 1
    ? { status: 'finished', timeSeconds: [...times][0], source: 'race_record', updatedAt: now }
    : { status: 'unrecorded' };
}

/**
 * Build a deeply copied, recursively frozen snapshot. Inputs must already belong
 * to this athlete (Activity and RacePR carry no owner). Dates are strict local
 * YYYY-MM-DD, inclusive, based on activity startTime. Weeks begin Sunday.
 * Totals sum known finite nonnegative metrics; null means none were recorded.
 * Duration uses recorded durationSeconds, then activeTimeSeconds, never elapsed
 * wall time or a race finish inference. now is epoch milliseconds.
 */
export function buildGoalArchive(
  descriptor: GoalArchiveDescriptor,
  activities: readonly Activity[],
  racePRs: readonly RacePR[],
  now: number = Date.now(),
): GoalArchive {
  if (!localDate(descriptor.startDate) || !localDate(descriptor.endDate)
    || descriptor.startDate > descriptor.endDate) {
    throw new RangeError('Goal archive requires a valid inclusive YYYY-MM-DD range');
  }
  if (nonnegative(now) === null) throw new RangeError('Goal archive now must be finite and nonnegative');

  const included = uniqueActivities(activities.filter(activity => {
    if (activity.status !== 'completed' && activity.status !== 'partial') return false;
    if (!Number.isFinite(activity.startTime)) return false;
    const date = new Date(activity.startTime);
    if (!Number.isFinite(date.getTime())) return false;
    const day = dateKey(date);
    return day >= descriptor.startDate && day <= descriptor.endDate;
  }));
  const rows = included.map(activity => {
    const date = new Date(activity.startTime);
    const day = dateKey(date);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return {
      activity, day, week: dateKey(date),
      distance: nonnegative(activity.metrics?.distanceMeters),
      duration: nonnegative(activity.metrics?.durationSeconds) ?? nonnegative(activity.metrics?.activeTimeSeconds),
    };
  });
  const weekRows = new Map<string, typeof rows>();
  for (const row of rows) {
    const week = weekRows.get(row.week) ?? [];
    week.push(row);
    weekRows.set(row.week, week);
  }

  // Encoding each tuple member prevents delimiter collisions without a lossy hash.
  return frozenCopy({
    schemaVersion: 1,
    id: `goal-archive:${encodeURIComponent(descriptor.athleteId)}:${encodeURIComponent(descriptor.sourceKey)}`,
    sourceKey: descriptor.sourceKey,
    ownerUserId: descriptor.ownerUserId,
    athleteId: descriptor.athleteId,
    title: descriptor.title,
    kind: descriptor.kind,
    goalType: descriptor.goalType,
    startDate: descriptor.startDate,
    endDate: descriptor.endDate,
    archivedAt: now,
    ...(descriptor.race ? { race: descriptor.race } : {}),
    ...(descriptor.beginnerPlan ? { beginnerPlan: descriptor.beginnerPlan } : {}),
    ...(descriptor.macroPlan ? { macroPlan: descriptor.macroPlan } : {}),
    summary: {
      completedActivities: included.filter(activity => activity.status === 'completed').length,
      partialActivities: included.filter(activity => activity.status === 'partial').length,
      activeDays: new Set(rows.map(row => row.day)).size,
      distanceMeters: total(rows.map(row => row.distance)),
      durationSeconds: total(rows.map(row => row.duration)),
      elevationGainMeters: total(included.map(activity => nonnegative(activity.metrics?.elevationGainMeters))),
      trainingLoad: total(included.map(activity => nonnegative(activity.trainingLoad?.wholeBody))),
      activityIds: included.map(activity => activity.id),
      weeks: [...weekRows.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([startDate, week]) => ({
          startDate,
          activityCount: week.length,
          distanceMeters: total(week.map(row => row.distance)),
          durationSeconds: total(week.map(row => row.duration)),
        })),
      coverage: {
        distanceActivities: rows.filter(row => row.distance !== null).length,
        durationActivities: rows.filter(row => row.duration !== null).length,
      },
    },
    result: raceResult(descriptor, racePRs, now, activities),
  });
}
