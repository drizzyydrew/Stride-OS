import type { ActivityType } from '../types/activity';

export const OUTDOOR_SPORTS = {
  running: { watchKind: 'run', label: 'Run', speedBased: false },
  walking: { watchKind: 'walking', label: 'Walk', speedBased: false },
  cycling: { watchKind: 'cycling', label: 'Ride', speedBased: true },
  hiking: { watchKind: 'hiking', label: 'Hike', speedBased: false },
  downhill_skiing: { watchKind: 'downhill_skiing', label: 'Downhill Ski', speedBased: true },
  cross_country_skiing: { watchKind: 'cross_country_skiing', label: 'Cross-Country Ski', speedBased: true },
  snowboarding: { watchKind: 'snowboarding', label: 'Snowboard', speedBased: true },
  ski_touring: { watchKind: 'ski_touring', label: 'Ski Touring', speedBased: true },
  snowboard_touring: { watchKind: 'snowboard_touring', label: 'Snowboard Touring', speedBased: true },
} as const;

export type OutdoorSport = keyof typeof OUTDOOR_SPORTS;

// Open workouts share recording/ownership controls, but are not outdoor sports.
export const TRACKED_ACTIVITIES = {
  ...OUTDOOR_SPORTS,
  other: { watchKind: 'other', label: 'Open / Other', speedBased: false },
} as const;
export type TrackedActivityType = keyof typeof TRACKED_ACTIVITIES;
export function trackedActivityFromWatch(kind: string | undefined): TrackedActivityType | null {
  return kind === 'other' ? 'other' : outdoorSportFromWatch(kind);
}

export function outdoorSportFromWatch(kind: string | undefined): OutdoorSport | null {
  return (Object.keys(OUTDOOR_SPORTS) as OutdoorSport[])
    .find(type => OUTDOOR_SPORTS[type].watchKind === kind) ?? null;
}

export function isOutdoorSport(type: ActivityType): type is OutdoorSport {
  return Object.prototype.hasOwnProperty.call(OUTDOOR_SPORTS, type);
}
