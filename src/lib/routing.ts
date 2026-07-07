// ─── Route Builder Routing Client ─────────────────────────────────────────────
//
// Snap-to-path routing for the Route Builder. Provider choice (researched
// against Mapbox Directions, Google Directions, Valhalla, GraphHopper, OSRM):
//
//   MVP provider: OSRM `foot` profile on the public FOSSGIS instance
//   (routing.openstreetmap.de). Chosen because it is keyless (no app-config
//   or secret changes — package.json/app.json are protected paths), OSM-based
//   (so it knows footpaths, pedestrian crossings, and many trails, not just
//   roads), returns GeoJSON geometry directly, and is free at Route Builder
//   traffic volumes. Mapbox Directions (walking profile) is the documented
//   production upgrade — see docs/route-builder.md — it plugs in behind the
//   same RoutedLeg contract without UI changes.
//
// Every network call degrades gracefully: if the router is unreachable, slow
// (>8s), or returns no route, the leg falls back to a direct line and the
// result is tagged so the UI can say so honestly. No fake snapping.

import type { RoutePoint } from '../store/routeStore';
import { milesBetween } from '../store/routeStore';

export type RoutingProvider = 'osrm_foot' | 'osrm_road' | 'direct';

export type RoutedPath = {
  provider:       RoutingProvider;
  geometry:       RoutePoint[];  // full snapped polyline (or the waypoints themselves when direct)
  distanceMeters: number;
};

export type ElevationSummary = {
  profileM:    number[];  // sampled elevations along the geometry, meters
  gainMeters:  number;
  lossMeters:  number;
};

// Provider chain, tried in order. FOSSGIS is the true pedestrian profile
// (footpaths + trails). The OSRM demo server is a *road-network* failover —
// its "foot" endpoint actually routes on the driving graph, so it's labeled
// 'osrm_road' and the UI says so. Both are keyless. Their usage policies
// expect an identifying User-Agent, and un-identified mobile requests are a
// plausible cause of on-device drops that curl testing never reproduces.
const PROVIDERS: { name: Exclude<RoutingProvider, 'direct'>; base: string }[] = [
  { name: 'osrm_foot', base: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot' },
  { name: 'osrm_road', base: 'https://router.project-osrm.org/route/v1/foot' },
];
const ROUTING_USER_AGENT = 'StrideOS/1.0 (training app; route builder)';
const ROUTING_TIMEOUT_MS = 12000;
const MAX_ELEVATION_SAMPLES = 40;
// Same hysteresis idea as live-run elevation: ignore sub-threshold jitter so
// a flat route doesn't report phantom climbing.
const ELEVATION_NOISE_METERS = 2;

function metersFromPolyline(points: RoutePoint[]): number {
  let miles = 0;
  for (let i = 1; i < points.length; i++) miles += milesBetween(points[i - 1], points[i]);
  return miles * 1609.344;
}

function directPath(waypoints: RoutePoint[]): RoutedPath {
  return {
    provider: 'direct',
    geometry: [...waypoints],
    distanceMeters: metersFromPolyline(waypoints),
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': ROUTING_USER_AGENT, Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestProvider(
  provider: { name: Exclude<RoutingProvider, 'direct'>; base: string },
  waypoints: RoutePoint[],
): Promise<RoutedPath | null> {
  const coords = waypoints
    .map(p => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`)
    .join(';');
  const url = `${provider.base}/${coords}?overview=full&geometries=geojson&steps=false&continue_straight=false`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) return null;

  const json = await response.json() as {
    code?: string;
    routes?: { distance?: number; geometry?: { coordinates?: [number, number][] } }[];
  };
  const route = json.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (json.code !== 'Ok' || !coordinates || coordinates.length < 2) return null;

  const geometry: RoutePoint[] = coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
  const distanceMeters = typeof route?.distance === 'number' ? route.distance : metersFromPolyline(geometry);

  // Degenerate-result guard: for unroutable input OSRM can return code "Ok"
  // with a zero-length route snapped to the nearest road — sometimes hundreds
  // of km from the request. Reject any result whose start snapped absurdly
  // far from the first waypoint, or that claims ~0 m for separated waypoints.
  const directMeters = metersFromPolyline(waypoints);
  const startSnapDeviation = milesBetween(geometry[0], waypoints[0]) * 1609.344;
  if (startSnapDeviation > 1000 || (distanceMeters < 1 && directMeters > 100)) return null;

  return { provider: provider.name, geometry, distanceMeters };
}

// Routes through ALL waypoints in order with one call so the line stays
// consistent. Tries each provider up to twice. Returns **null when no
// provider produced a snapped route** — snapping failure is surfaced to the
// user, never silently replaced with a straight line (the athlete must opt
// into Direct mode explicitly).
export async function snapRouteToPaths(waypoints: RoutePoint[]): Promise<RoutedPath | null> {
  if (waypoints.length < 2) return null;

  for (const provider of PROVIDERS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const path = await requestProvider(provider, waypoints);
        if (path) return path;
        break; // provider answered but had no usable route — try next provider
      } catch {
        // network error/timeout — retry once, then next provider
      }
    }
  }
  return null;
}

// Explicit direct-line path — only for the user-chosen Direct mode.
export function buildDirectPath(waypoints: RoutePoint[]): RoutedPath {
  return directPath(waypoints);
}

// Elevation along a geometry via Open-Meteo (keyless; already used by the
// training screen for route previews). Returns null when unavailable rather
// than fabricating a profile.
export async function fetchRouteElevation(geometry: RoutePoint[]): Promise<ElevationSummary | null> {
  if (geometry.length < 2) return null;

  const step = Math.max(1, Math.ceil(geometry.length / MAX_ELEVATION_SAMPLES));
  const sample = geometry.filter((_, i) => i % step === 0);
  if (sample[sample.length - 1] !== geometry[geometry.length - 1]) {
    sample.push(geometry[geometry.length - 1]);
  }

  const latitudes = sample.map(p => p.latitude.toFixed(6)).join(',');
  const longitudes = sample.map(p => p.longitude.toFixed(6)).join(',');

  try {
    const response = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`,
    );
    if (!response.ok) return null;

    const json = await response.json() as { elevation?: number[] };
    const profileM = json.elevation;
    if (!Array.isArray(profileM) || profileM.length < 2) return null;

    let gain = 0;
    let loss = 0;
    let ref = profileM[0];
    for (let i = 1; i < profileM.length; i++) {
      const delta = profileM[i] - ref;
      if (delta >= ELEVATION_NOISE_METERS) {
        gain += delta;
        ref = profileM[i];
      } else if (delta <= -ELEVATION_NOISE_METERS) {
        loss += -delta;
        ref = profileM[i];
      }
    }

    return {
      profileM,
      gainMeters: Math.round(gain),
      lossMeters: Math.round(loss),
    };
  } catch {
    return null;
  }
}

// GeoJSON serialization for the stored route line — the interchange format
// for any future export (GPX conversion, backend sync, Live Run guidance).
export function routeToGeoJSON(geometry: RoutePoint[]): {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  properties: Record<string, never>;
} {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: geometry.map(p => [p.longitude, p.latitude]),
    },
    properties: {},
  };
}

// The exact educational copy required by the Route Builder spec — kept here
// so the builder and detail screens render one identical source of truth.
export const TANGENTS_EDUCATION_COPY =
  'Race courses are measured by the shortest possible legal route. Your watch may show extra distance because of weaving, wide turns, aid station movement, and GPS drift. StrideOS planned distance is an estimate based on the selected route line.';
