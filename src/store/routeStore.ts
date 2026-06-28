import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteInterval = {
  label: string;
  distanceMiles: number;
  point: RoutePoint;
};

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
  points: RoutePoint[];
};

type RouteStore = {
  routes: RunRoute[];
  selectedRouteId: string | null;
  addRoute: (route: Omit<RunRoute, 'id'>) => string;
  removeRoute: (id: string) => void;
  selectRoute: (id: string | null) => void;
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
      selectedRouteId: null,
      addRoute: (route) => {
        const id = `route-${Date.now()}`;
        set((state) => ({
          routes: [{ ...route, id }, ...state.routes],
          selectedRouteId: id,
        }));
        return id;
      },
      removeRoute: (id) => set((state) => ({
        routes: state.routes.filter((route) => route.id !== id),
        selectedRouteId: state.selectedRouteId === id ? null : state.selectedRouteId,
      })),
      selectRoute: (id) => set({ selectedRouteId: id }),
    }),
    {
      name: 'route-store',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const state = persisted as Partial<RouteStore> | undefined;
        return {
          ...current,
          ...state,
          routes: (state?.routes ?? current.routes).map(normalizeRoute),
        };
      },
    },
  ),
);
