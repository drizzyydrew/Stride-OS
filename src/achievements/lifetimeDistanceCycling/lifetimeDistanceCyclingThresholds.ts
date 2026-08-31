export const LIFETIME_DISTANCE_CYCLING_METERS_PER_MILE = 1609.344;

export const LIFETIME_DISTANCE_CYCLING_THRESHOLDS_MILES = [
  10,
  50,
  100,
  250,
  500,
  1000,
  2500,
  5000,
  10000,
] as const;

export type LifetimeDistanceCyclingMilestone = typeof LIFETIME_DISTANCE_CYCLING_THRESHOLDS_MILES[number];

export function lifetimeCyclingMilesToMeters(miles: number): number {
  return miles * LIFETIME_DISTANCE_CYCLING_METERS_PER_MILE;
}

export function lifetimeCyclingMilestoneSlug(miles: number): string {
  return `${String(miles).replace('.', '-')}mi`;
}

export function lifetimeCyclingMilestoneId(miles: number): `lifetime_cycle_${string}_mi` {
  return `lifetime_cycle_${String(miles).replace('.', '_')}_mi`;
}
