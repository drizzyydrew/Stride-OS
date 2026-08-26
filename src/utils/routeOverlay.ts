import type { Activity, ActivityCoordinate } from '../types/activity';

export type NormalizedRoutePoint = {
  x: number;
  y: number;
};

export type NormalizedRouteOverlay = {
  points: NormalizedRoutePoint[];
  viewBox: { width: number; height: number };
  hasRoute: boolean;
};

export const ROUTE_PRIVACY_NOTE = 'Route shape can reveal where an activity occurred.';

function finiteCoordinate(point: ActivityCoordinate): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

export function activityHasShareableRoute(activity: Activity): boolean {
  const route = activity.metrics.routeCoordinates ?? [];
  return route.filter(finiteCoordinate).length >= 2 && !activity.indoor && activity.metrics.distanceSource !== 'treadmill_reported';
}

export function normalizeRouteForOverlay(
  route: readonly ActivityCoordinate[] | undefined,
  size: { width: number; height: number } = { width: 1080, height: 1080 },
  paddingRatio = 0.14,
): NormalizedRouteOverlay {
  const valid = (route ?? []).filter(finiteCoordinate);
  if (valid.length < 2) {
    return { points: [], viewBox: size, hasRoute: false };
  }

  const minLat = Math.min(...valid.map(point => point.latitude));
  const maxLat = Math.max(...valid.map(point => point.latitude));
  const minLon = Math.min(...valid.map(point => point.longitude));
  const maxLon = Math.max(...valid.map(point => point.longitude));
  const lonSpan = Math.max(maxLon - minLon, 0.000001);
  const latSpan = Math.max(maxLat - minLat, 0.000001);
  const safePadding = Math.max(0, Math.min(0.35, paddingRatio));
  const availableWidth = size.width * (1 - safePadding * 2);
  const availableHeight = size.height * (1 - safePadding * 2);
  const routeAspect = lonSpan / latSpan;
  const canvasAspect = availableWidth / availableHeight;
  const drawWidth = routeAspect > canvasAspect ? availableWidth : availableHeight * routeAspect;
  const drawHeight = routeAspect > canvasAspect ? availableWidth / routeAspect : availableHeight;
  const offsetX = (size.width - drawWidth) / 2;
  const offsetY = (size.height - drawHeight) / 2;
  const step = Math.max(1, Math.floor(valid.length / 220));

  return {
    points: valid
      .filter((_, index) => index % step === 0 || index === valid.length - 1)
      .map(point => ({
        x: offsetX + ((point.longitude - minLon) / lonSpan) * drawWidth,
        y: offsetY + (1 - ((point.latitude - minLat) / latSpan)) * drawHeight,
      })),
    viewBox: size,
    hasRoute: true,
  };
}

export function routePointsToSvgPolyline(points: readonly NormalizedRoutePoint[]): string {
  return points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}
