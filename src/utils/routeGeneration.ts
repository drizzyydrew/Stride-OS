import type { RoutePoint, RouteSurface } from '../store/routeStore';

export type GeneratedRouteShape = 'loop' | 'out_and_back';
export type GeneratedRouteHillIntent = 'flat' | 'rolling' | 'hilly';
export type GeneratedRouteElevationIntent = 'low' | 'moderate' | 'high';

export type RouteGenerationInput = {
  start: RoutePoint;
  distanceMiles: number;
  surface: Exclude<RouteSurface, 'unknown'>;
  hills: GeneratedRouteHillIntent;
  elevation: GeneratedRouteElevationIntent;
  shape: GeneratedRouteShape;
  seed?: number;
};

export type GeneratedRoutePlan = {
  waypoints: RoutePoint[];
  name: string;
  notes: string;
};

const MIN_ROUTE_MI = 0.5;
const MAX_ROUTE_MI = 50;

function clampDistanceMiles(distanceMiles: number): number {
  if (!Number.isFinite(distanceMiles)) return 3;
  return Math.min(MAX_ROUTE_MI, Math.max(MIN_ROUTE_MI, distanceMiles));
}

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function destinationPoint(start: RoutePoint, bearingDegrees: number, distanceMiles: number): RoutePoint {
  const radiusMiles = 3958.8;
  const bearing = bearingDegrees * Math.PI / 180;
  const angular = distanceMiles / radiusMiles;
  const lat1 = start.latitude * Math.PI / 180;
  const lon1 = start.longitude * Math.PI / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
    Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
    Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
  );

  return {
    latitude: lat2 * 180 / Math.PI,
    longitude: ((lon2 * 180 / Math.PI + 540) % 360) - 180,
  };
}

function milesBetween(a: RoutePoint, b: RoutePoint): number {
  const radiusMiles = 3958.8;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radiusMiles * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function generatedRouteDistanceMiles(points: RoutePoint[]): number {
  return points.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + milesBetween(points[index - 1], point);
  }, 0);
}

function baseBearing(input: Pick<RouteGenerationInput, 'surface' | 'hills' | 'elevation' | 'seed'>): number {
  const surfaceOffset = input.surface === 'trail' ? 295 : input.surface === 'road' ? 85 : 35;
  const hillOffset = input.hills === 'hilly' ? 30 : input.hills === 'rolling' ? 15 : 0;
  const elevationOffset = input.elevation === 'high' ? 24 : input.elevation === 'moderate' ? 12 : 0;
  const seededOffset = Math.round(seededUnit(input.seed ?? 1) * 46) - 23;
  return (surfaceOffset + hillOffset + elevationOffset + seededOffset + 360) % 360;
}

function hillSpread(hills: GeneratedRouteHillIntent, elevation: GeneratedRouteElevationIntent): number {
  const hillValue = hills === 'hilly' ? 78 : hills === 'rolling' ? 58 : 40;
  const elevationValue = elevation === 'high' ? 18 : elevation === 'moderate' ? 9 : 0;
  return hillValue + elevationValue;
}

function generatedName(input: Pick<RouteGenerationInput, 'distanceMiles' | 'surface' | 'hills' | 'shape'>): string {
  const surface = input.surface === 'mixed' ? 'Mixed' : input.surface === 'trail' ? 'Trail' : 'Road';
  const hills = input.hills === 'flat' ? 'Flat' : input.hills === 'rolling' ? 'Rolling' : 'Hilly';
  const shape = input.shape === 'loop' ? 'Loop' : 'Out & Back';
  return `${input.distanceMiles.toFixed(input.distanceMiles < 10 ? 1 : 0)} mi ${hills} ${surface} ${shape}`;
}

export function buildGeneratedRouteWaypoints(input: RouteGenerationInput): GeneratedRoutePlan {
  const distanceMiles = clampDistanceMiles(input.distanceMiles);
  const seed = input.seed ?? Math.round(Date.now() / 1000);
  const bearing = baseBearing({ ...input, seed });
  const spread = hillSpread(input.hills, input.elevation);

  if (input.shape === 'out_and_back') {
    const outboundMiles = distanceMiles / 2;
    const turn = destinationPoint(input.start, bearing, outboundMiles);
    const waypoints = [input.start, turn, input.start];
    return {
      waypoints,
      name: generatedName({ ...input, distanceMiles }),
      notes: `Auto-created from filters: ${input.surface} surface, ${input.hills} hills, ${input.elevation} elevation intent. Snapping and elevation are resolved after generation.`,
    };
  }

  const legMiles = distanceMiles / 3;
  const p1 = destinationPoint(input.start, bearing, legMiles);
  const p2 = destinationPoint(input.start, bearing + spread, legMiles);
  const p3 = destinationPoint(input.start, bearing + spread * 1.85, Math.max(0.2, legMiles * 0.7));
  const waypoints = [input.start, p1, p2, p3, input.start];
  const directDistance = generatedRouteDistanceMiles(waypoints);
  const scale = directDistance > 0 ? distanceMiles / directDistance : 1;

  if (Math.abs(scale - 1) > 0.08) {
    const scaled = [
      input.start,
      destinationPoint(input.start, bearing, legMiles * scale),
      destinationPoint(input.start, bearing + spread, legMiles * scale),
      destinationPoint(input.start, bearing + spread * 1.85, Math.max(0.2, legMiles * 0.7 * scale)),
      input.start,
    ];
    return {
      waypoints: scaled,
      name: generatedName({ ...input, distanceMiles }),
      notes: `Auto-created from filters: ${input.surface} surface, ${input.hills} hills, ${input.elevation} elevation intent. Snapping and elevation are resolved after generation.`,
    };
  }

  return {
    waypoints,
    name: generatedName({ ...input, distanceMiles }),
    notes: `Auto-created from filters: ${input.surface} surface, ${input.hills} hills, ${input.elevation} elevation intent. Snapping and elevation are resolved after generation.`,
  };
}
