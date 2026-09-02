export const MONTHLY_DISTANCE_KM_THRESHOLDS = [
  25,
  50,
  100,
  150,
  200,
  250,
  300,
] as const;

export type MonthlyDistanceMilestoneKm = typeof MONTHLY_DISTANCE_KM_THRESHOLDS[number];

export function monthlyDistanceKilometersToMeters(kilometers: number): number {
  return kilometers * 1000;
}

export function monthlyDistanceMilestoneSlug(kilometers: number): `${number}k` {
  return `${kilometers}k` as `${number}k`;
}

export function monthlyDistanceMilestoneId(kilometers: number): `monthly_run_${number}k` {
  return `monthly_run_${kilometers}k` as `monthly_run_${number}k`;
}
