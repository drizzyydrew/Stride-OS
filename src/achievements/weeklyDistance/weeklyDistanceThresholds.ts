export const WEEKLY_DISTANCE_KM_THRESHOLDS = [
  5,
  10,
  15,
  25,
  30,
  50,
  75,
  100,
] as const;

export type WeeklyDistanceMilestoneKm = typeof WEEKLY_DISTANCE_KM_THRESHOLDS[number];

export function weeklyDistanceKilometersToMeters(kilometers: number): number {
  return kilometers * 1000;
}

export function weeklyDistanceMilestoneSlug(kilometers: number): `${number}k` {
  return `${kilometers}k` as `${number}k`;
}

export function weeklyDistanceMilestoneId(kilometers: number): `weekly_${number}k` {
  return `weekly_${kilometers}k` as `weekly_${number}k`;
}
