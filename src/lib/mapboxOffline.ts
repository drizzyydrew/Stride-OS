import type { RunRoute, RoutePoint } from '../store/routeStore';
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL, isMapboxConfigured } from './mapboxConfig';

export type OfflineBounds = [[number, number], [number, number]];

export type OfflinePackProgress = {
  percentage: number;
};

export type RouteOfflineMapStatus = NonNullable<RunRoute['offlineMap']>['status'];

type MapboxModule = {
  default?: {
    setAccessToken?: (token: string) => Promise<string | null> | void;
    StyleURL?: Record<string, string>;
    offlineManager?: {
      createPack: (
        options: RouteOfflinePackOptions,
        progress?: (pack: unknown, status: unknown) => void,
        error?: (pack: unknown, error: unknown) => void,
      ) => Promise<void>;
      getPack?: (name: string) => Promise<unknown>;
      deletePack?: (name: string) => Promise<void>;
    };
  };
  setAccessToken?: (token: string) => Promise<string | null> | void;
  StyleURL?: Record<string, string>;
  offlineManager?: {
    createPack: (
      options: RouteOfflinePackOptions,
      progress?: (pack: unknown, status: unknown) => void,
      error?: (pack: unknown, error: unknown) => void,
    ) => Promise<void>;
    getPack?: (name: string) => Promise<unknown>;
    deletePack?: (name: string) => Promise<void>;
  };
};

export type RouteOfflinePackOptions = {
  name: string;
  styleURL: string;
  bounds: OfflineBounds;
  minZoom: number;
  maxZoom: number;
  metadata: {
    routeId: string;
    routeName: string;
    provider: 'mapbox';
    createdAt: number;
  };
};

export function routeOfflinePackName(routeId: string): string {
  const safeId = routeId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 72);
  return `strideos-route-${safeId}`;
}

export function routeOfflineBounds(points: RoutePoint[], paddingDegrees = 0.012): OfflineBounds | null {
  if (!points.length) return null;

  const latitudes = points.map(point => point.latitude);
  const longitudes = points.map(point => point.longitude);
  const round = (value: number) => Number(value.toFixed(6));
  const north = round(Math.max(...latitudes) + paddingDegrees);
  const south = round(Math.min(...latitudes) - paddingDegrees);
  const east = round(Math.max(...longitudes) + paddingDegrees);
  const west = round(Math.min(...longitudes) - paddingDegrees);

  return [[east, north], [west, south]];
}

export function routeOfflinePackOptions(route: RunRoute, now = Date.now()): RouteOfflinePackOptions | null {
  const bounds = routeOfflineBounds(route.points);
  if (!bounds) return null;

  return {
    name: routeOfflinePackName(route.id),
    styleURL: MAPBOX_STYLE_URL,
    bounds,
    minZoom: 10,
    maxZoom: 17,
    metadata: {
      routeId: route.id,
      routeName: route.name,
      provider: 'mapbox',
      createdAt: now,
    },
  };
}

export function routeOfflineStatusLabel(status: RouteOfflineMapStatus | undefined): string {
  switch (status) {
    case 'ready':
      return 'Offline map ready';
    case 'downloading':
      return 'Downloading offline map';
    case 'failed':
      return 'Offline map failed';
    case 'not_downloaded':
    default:
      return 'Offline map not saved';
  }
}

export function routeOfflineButtonLabel(status: RouteOfflineMapStatus | undefined): string {
  switch (status) {
    case 'ready':
      return 'Refresh Offline Map';
    case 'downloading':
      return 'Downloading...';
    case 'failed':
      return 'Retry Offline Map';
    case 'not_downloaded':
    default:
      return 'Download Offline Map';
  }
}

export function routeOfflineDeleteButtonLabel(status: RouteOfflineMapStatus | undefined): string {
  return status === 'ready' ? 'Delete Offline Map' : 'Remove Offline Map Record';
}

function progressPercentage(status: unknown): number {
  if (!status || typeof status !== 'object') return 0;
  const value = status as Record<string, unknown>;
  const percentage = Number(value.percentage);
  if (Number.isFinite(percentage) && percentage > 0) {
    return Math.max(0, Math.min(100, Math.round(percentage)));
  }
  const completed = Number(value.completedResourceCount ?? value.completedResources ?? 0);
  const required = Number(value.requiredResourceCount ?? value.requiredResources ?? 0);
  if (!Number.isFinite(completed) || !Number.isFinite(required) || required <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / required) * 100)));
}

function getMapboxModule(): Required<Pick<MapboxModule, 'offlineManager'>> & Pick<MapboxModule, 'setAccessToken'> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@rnmapbox/maps') as MapboxModule;
  const mapbox = module.default ?? module;
  const offlineManager = module.offlineManager ?? mapbox.offlineManager;
  if (!offlineManager) {
    throw new Error('Mapbox offline manager is unavailable in this build.');
  }
  return {
    offlineManager,
    setAccessToken: module.setAccessToken ?? mapbox.setAccessToken,
  };
}

export async function downloadRouteOfflinePack(
  route: RunRoute,
  onProgress?: (progress: OfflinePackProgress) => void,
): Promise<RouteOfflinePackOptions> {
  if (!isMapboxConfigured()) {
    throw new Error('Add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to enable offline route maps.');
  }

  const options = routeOfflinePackOptions(route);
  if (!options) {
    throw new Error('This route does not have enough points to download an offline map.');
  }

  const mapbox = getMapboxModule();
  await mapbox.setAccessToken?.(MAPBOX_ACCESS_TOKEN);

  try {
    await mapbox.offlineManager.deletePack?.(options.name);
  } catch {
    // The pack may not exist yet; createPack will surface real failures below.
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    mapbox.offlineManager.createPack(options, (_pack, status) => {
      const percentage = progressPercentage(status);
      onProgress?.({ percentage });
      if (percentage >= 100) finish();
    }, (_pack, error) => {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? 'Mapbox offline map download failed.')
        : 'Mapbox offline map download failed.';
      fail(message);
    }).catch(error => {
      fail(error instanceof Error ? error.message : 'Mapbox offline map download failed.');
    });
  });

  onProgress?.({ percentage: 100 });
  return options;
}

export async function deleteRouteOfflinePack(route: RunRoute): Promise<string> {
  const packName = route.offlineMap?.packName ?? routeOfflinePackName(route.id);
  if (!isMapboxConfigured()) {
    throw new Error('Mapbox is not configured in this build.');
  }

  const mapbox = getMapboxModule();
  await mapbox.setAccessToken?.(MAPBOX_ACCESS_TOKEN);
  await mapbox.offlineManager.deletePack?.(packName);
  return packName;
}
