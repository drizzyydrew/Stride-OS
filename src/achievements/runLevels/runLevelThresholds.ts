export const RUN_LEVEL_METER_PER_MILE = 1609.344;

export const RUN_LEVEL_THRESHOLDS_MILES = {
  foundation: 0,
  rhythm: 50,
  momentum: 150,
  durability: 400,
  engine: 750,
  peak: 1500,
  summit: 3000,
} as const;

export function runLevelMilesToMeters(miles: number): number {
  return miles * RUN_LEVEL_METER_PER_MILE;
}
