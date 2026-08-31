export const LIFETIME_DISTANCE_RUNNING_METERS_PER_MILE = 1609.344;

export const LIFETIME_DISTANCE_RUNNING_THRESHOLDS_MILES = [
  1,
  5,
  10,
  26.2,
  50,
  100,
  250,
  500,
  1000,
  10000,
] as const;

export type LifetimeDistanceRunningMilestone = typeof LIFETIME_DISTANCE_RUNNING_THRESHOLDS_MILES[number];

export function lifetimeRunningMilesToMeters(miles: number): number {
  return miles * LIFETIME_DISTANCE_RUNNING_METERS_PER_MILE;
}

export function lifetimeRunningMilestoneSlug(miles: number): string {
  return `${String(miles).replace('.', '-')}mi`;
}

export function lifetimeRunningMilestoneId(miles: number): `lifetime_run_${string}_mi` {
  return `lifetime_run_${String(miles).replace('.', '_')}_mi`;
}
