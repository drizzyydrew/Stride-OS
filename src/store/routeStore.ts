import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import {
  EMPTY_ROUTE_ATTACHMENT,
  attachRouteState,
  detachRouteState,
  migrateRouteAttachment,
  reverseRouteState,
  reverseDistanceFromStart,
  type RouteAttachmentState,
} from '../utils/routeAttachment';

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteInterval = {
  label: string;
  distanceMiles: number;
  point: RoutePoint;
};

export type RouteSurface = 'road' | 'trail' | 'mixed' | 'unknown';

export type RunRoute = {
  id: string;
  name: string;
  folder: 'easy' | 'tempo' | 'long' | 'custom';
  difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Custom';
  distanceMiles: number;
  elevationGainFt: number;
  elevationProfileFt?: number[];
  estimatedMinutes: number;
  segments: RouteInterval[];
  // Full route line (snapped geometry when the router produced one). This is
  // the polyline every consumer draws and measures — GeoJSON-convertible via
  // routeToGeoJSON() in src/lib/routing.ts.
  points: RoutePoint[];

  // ── Route Builder fields (all optional — legacy stored routes stay valid) ──
  createdAt?:           number;
  updatedAt?:           number;
  waypoints?:           RoutePoint[];  // the user's control points, distinct from snapped geometry
  distanceMeters?:      number;
  elevationGainMeters?: number;
  elevationLossMeters?: number;
  estimatedDurationMin?: number;       // canonical; `estimatedMinutes` kept for legacy consumers
  surfaceType?:         RouteSurface;
  routingProvider?:     'osrm_foot' | 'osrm_road' | 'direct';
  notes?:               string;
  linkedWorkoutId?:     string;
};

type RouteStore = {
  routes: RunRoute[];
  routeAttachment: RouteAttachmentState;
  /** @deprecated Compatibility alias. Use routeAttachment.routeId. */
  selectedRouteId: string | null;
  addRoute: (route: Omit<RunRoute, 'id'>) => string;
  updateRoute: (id: string, patch: Partial<Omit<RunRoute, 'id'>>) => void;
  removeRoute: (id: string) => void;
  selectRoute: (id: string | null) => void;
  attachRoute: (id: string) => void;
  detachRouteFromToday: () => void;
  reverseAttachedRoute: () => void;
  reattachLastRoute: () => void;
};

const DEFAULT_ROUTES: RunRoute[] = [
  {
    id: 'riverside-loop',
    name: 'Riverside Loop',
    folder: 'easy',
    difficulty: 'Easy',
    distanceMiles: 6.2,
    elevationGainFt: 184,
    estimatedMinutes: 58,
    segments: [
      { label: 'A', distanceMiles: 3.2 * 0.621371, point: { latitude: 44.062, longitude: -121.309 } },
      { label: 'B', distanceMiles: 6.5 * 0.621371, point: { latitude: 44.066, longitude: -121.318 } },
    ],
    points: [
      { latitude: 44.058, longitude: -121.315 },
      { latitude: 44.061, longitude: -121.31 },
      { latitude: 44.065, longitude: -121.308 },
      { latitude: 44.068, longitude: -121.313 },
      { latitude: 44.065, longitude: -121.32 },
      { latitude: 44.06, longitude: -121.318 },
      { latitude: 44.058, longitude: -121.315 },
    ],
  },
  {
    id: 'pilot-butte-out-back',
    name: 'Pilot Butte Out and Back',
    folder: 'tempo',
    difficulty: 'Moderate',
    distanceMiles: 4.1,
    elevationGainFt: 479,
    estimatedMinutes: 42,
    segments: [{ label: 'Turnaround', distanceMiles: 3.3 * 0.621371, point: { latitude: 44.052, longitude: -121.3 } }],
    points: [
      { latitude: 44.058, longitude: -121.315 },
      { latitude: 44.055, longitude: -121.308 },
      { latitude: 44.052, longitude: -121.3 },
      { latitude: 44.049, longitude: -121.295 },
      { latitude: 44.046, longitude: -121.29 },
    ],
  },
  {
    id: 'drake-park-mirror-pond',
    name: 'Drake Park and Mirror Pond',
    folder: 'easy',
    difficulty: 'Easy',
    distanceMiles: 3.2,
    elevationGainFt: 43,
    estimatedMinutes: 31,
    segments: [],
    points: [
      { latitude: 44.058, longitude: -121.315 },
      { latitude: 44.057, longitude: -121.318 },
      { latitude: 44.055, longitude: -121.322 },
      { latitude: 44.054, longitude: -121.325 },
      { latitude: 44.056, longitude: -121.328 },
      { latitude: 44.059, longitude: -121.326 },
      { latitude: 44.061, longitude: -121.32 },
      { latitude: 44.06, longitude: -121.316 },
    ],
  },
  {
    id: 'century-drive-climb',
    name: 'Century Drive Climb',
    folder: 'long',
    difficulty: 'Hard',
    distanceMiles: 8.8,
    elevationGainFt: 1024,
    estimatedMinutes: 95,
    segments: [
      { label: 'Half', distanceMiles: 5 * 0.621371, point: { latitude: 44.046, longitude: -121.34 } },
      { label: 'Top', distanceMiles: 10 * 0.621371, point: { latitude: 44.036, longitude: -121.355 } },
    ],
    points: [
      { latitude: 44.058, longitude: -121.315 },
      { latitude: 44.05, longitude: -121.33 },
      { latitude: 44.04, longitude: -121.345 },
      { latitude: 44.03, longitude: -121.36 },
    ],
  },
];

export function milesBetween(a: RoutePoint, b: RoutePoint): number {
  const r = 3958.8;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function routeDistanceMiles(points: RoutePoint[]): number {
  return points.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + milesBetween(points[index - 1], point);
  }, 0);
}

export function effectiveAttachedRoute(
  route: RunRoute | null,
  attachment: RouteAttachmentState,
): RunRoute | null {
  if (!route || attachment.status !== 'attached' || attachment.routeId !== route.id) return null;
  if (attachment.direction === 'forward') return route;
  const points = [...route.points].reverse();
  return {
    ...route,
    points,
    waypoints: route.waypoints ? [...route.waypoints].reverse() : undefined,
    segments: route.segments
      .map(segment => ({
        ...segment,
        distanceMiles: reverseDistanceFromStart(route.distanceMiles, segment.distanceMiles),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .map(segment => ({
        ...segment,
        point: pointAtDistance(points, segment.distanceMiles),
      })),
  };
}

function pointAtDistance(points: RoutePoint[], targetMiles: number): RoutePoint {
  if (points.length === 0) return { latitude: 44.058, longitude: -121.315 };
  if (points.length === 1 || targetMiles <= 0) return points[0];

  let traversed = 0;
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    const segmentMiles = milesBetween(start, end);
    if (traversed + segmentMiles >= targetMiles) {
      const ratio = segmentMiles === 0 ? 0 : (targetMiles - traversed) / segmentMiles;
      return {
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      };
    }
    traversed += segmentMiles;
  }

  return points[points.length - 1];
}

function normalizeRoute(route: RunRoute): RunRoute {
  return {
    ...route,
    segments: route.segments.map((segment) => ({
      ...segment,
      point: segment.point ?? pointAtDistance(route.points, segment.distanceMiles),
    })),
  };
}

export const useRouteStore = create<RouteStore>()(
  persist(
    (set) => ({
      routes: DEFAULT_ROUTES,
      routeAttachment: EMPTY_ROUTE_ATTACHMENT,
      selectedRouteId: null,
      addRoute: (route) => {
        const id = `route-${Date.now()}`;
        const now = Date.now();
        set((state) => ({
          routes: [{ createdAt: now, updatedAt: now, ...route, id }, ...state.routes],
          routeAttachment: attachRouteState(id, now),
          selectedRouteId: id,
        }));
        return id;
      },
      updateRoute: (id, patch) => set((state) => ({
        routes: state.routes.map((route) =>
          route.id === id ? { ...route, ...patch, updatedAt: Date.now() } : route,
        ),
      })),
      removeRoute: (id) => set((state) => ({
        routes: state.routes.filter((route) => route.id !== id),
        routeAttachment: state.routeAttachment.routeId === id
          ? detachRouteState(state.routeAttachment)
          : {
            ...state.routeAttachment,
            lastDetachedRouteId: state.routeAttachment.lastDetachedRouteId === id
              ? null
              : state.routeAttachment.lastDetachedRouteId,
          },
        selectedRouteId: state.selectedRouteId === id ? null : state.selectedRouteId,
      })),
      selectRoute: (id) => set(state => ({
        selectedRouteId: id,
        routeAttachment: id ? attachRouteState(id) : detachRouteState(state.routeAttachment),
      })),
      attachRoute: (id) => set({
        selectedRouteId: id,
        routeAttachment: attachRouteState(id),
      }),
      detachRouteFromToday: () => set(state => ({
        selectedRouteId: null,
        routeAttachment: detachRouteState(state.routeAttachment),
      })),
      reverseAttachedRoute: () => set(state => ({
        routeAttachment: reverseRouteState(state.routeAttachment),
      })),
      reattachLastRoute: () => set(state => {
        const id = state.routeAttachment.lastDetachedRouteId;
        if (!id || !state.routes.some(route => route.id === id)) return state;
        return {
          selectedRouteId: id,
          routeAttachment: attachRouteState(id),
        };
      }),
    }),
    {
      name: 'route-store',
      storage: createAppJSONStorage(),
      merge: (persisted, current) => {
        const state = persisted as Partial<RouteStore> | undefined;
        const attachment = migrateRouteAttachment(state?.routeAttachment, state?.selectedRouteId);
        return {
          ...current,
          ...state,
          routes: (state?.routes ?? current.routes).map(normalizeRoute),
          routeAttachment: attachment,
          selectedRouteId: attachment.routeId,
        };
      },
    },
  ),
);
