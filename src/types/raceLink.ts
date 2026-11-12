import type { Race } from './plan';

/** Event/course distance is distinct from a recorder's GPS distance. */
export type RaceEventSnapshot = {
  id: string;
  name: string;
  date: string;
  distance: Race['distance'];
  distanceMeters: number;
};

export type RaceActivityLink = {
  ownerUserId: string;
  athleteId: 'athlete_default';
  event: RaceEventSnapshot;
  outcome: 'unrecorded' | 'finished' | 'did_not_finish';
  linkedAt: number;
};
