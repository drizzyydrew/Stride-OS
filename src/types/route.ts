/** A geographic range along the saved line, independent of timed workout blocks. */
export type RouteSection = {
  id: string;
  name: string;
  startMeters: number;
  endMeters: number;
  targetPaceSecPerMile?: number;
  targetHrZone?: 1 | 2 | 3 | 4 | 5;
  targetRpe?: number;
};
