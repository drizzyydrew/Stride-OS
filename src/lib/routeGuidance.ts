export type GuidancePoint = {
  latitude: number;
  longitude: number;
};

export type RouteNavigationMode = 'off' | 'walking' | 'cycling';
export type RouteGuidanceKind = 'disabled' | 'turn_by_turn' | 'breadcrumb';
export type RouteGuidanceProvider = 'mapkit' | 'saved_route';

export type RouteGuidanceStep = {
  id: string;
  instruction: string;
  distanceMeters: number;
  expectedTravelTimeSeconds: number;
  start: GuidancePoint;
  end: GuidancePoint;
};

export type RouteGuidancePlan = {
  mode: RouteNavigationMode;
  kind: RouteGuidanceKind;
  provider: RouteGuidanceProvider;
  geometry: GuidancePoint[];
  steps: RouteGuidanceStep[];
  supportsTurnAnnouncements: boolean;
  supportsRerouting: boolean;
  limitation: string | null;
};

export type RouteGuidanceProgress = {
  nearestDistanceMeters: number;
  isOffRoute: boolean;
  offRouteSampleCount: number;
  nextStepIndex: number | null;
  nextInstruction: string | null;
  distanceToNextStepMeters: number | null;
};

const EARTH_RADIUS_METERS = 6_371_000;
const OFF_ROUTE_THRESHOLD_METERS: Record<Exclude<RouteNavigationMode, 'off'>, number> = {
  walking: 45,
  cycling: 75,
};
const OFF_ROUTE_REQUIRED_SAMPLES = 3;

export function metersBetweenGuidancePoints(a: GuidancePoint, b: GuidancePoint): number {
  const dLat = degreesToRadians(b.latitude - a.latitude);
  const dLng = degreesToRadians(b.longitude - a.longitude);
  const lat1 = degreesToRadians(a.latitude);
  const lat2 = degreesToRadians(b.latitude);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function createBreadcrumbGuidancePlan(
  geometry: GuidancePoint[],
  mode: RouteNavigationMode,
): RouteGuidancePlan {
  if (mode === 'off') {
    return {
      mode,
      kind: 'disabled',
      provider: 'saved_route',
      geometry: [...geometry],
      steps: [],
      supportsTurnAnnouncements: false,
      supportsRerouting: false,
      limitation: null,
    };
  }

  return {
    mode,
    kind: 'breadcrumb',
    provider: 'saved_route',
    geometry: [...geometry],
    steps: [],
    supportsTurnAnnouncements: false,
    supportsRerouting: false,
    limitation:
      'Follow the saved route line. Turn-by-turn directions are unavailable because this route does not include routable steps.',
  };
}

export function createTurnByTurnGuidancePlan(input: {
  mode: Exclude<RouteNavigationMode, 'off'>;
  geometry: GuidancePoint[];
  steps: RouteGuidanceStep[];
  provider?: RouteGuidanceProvider;
  supportsRerouting?: boolean;
}): RouteGuidancePlan {
  const steps = input.steps.filter(step =>
    step.instruction.trim().length > 0
    && isFinitePoint(step.start)
    && isFinitePoint(step.end),
  );
  if (steps.length === 0) return createBreadcrumbGuidancePlan(input.geometry, input.mode);

  return {
    mode: input.mode,
    kind: 'turn_by_turn',
    provider: input.provider ?? 'mapkit',
    geometry: [...input.geometry],
    steps,
    supportsTurnAnnouncements: true,
    supportsRerouting: input.supportsRerouting ?? true,
    limitation: null,
  };
}

export function createSavedRouteTurnGuidancePlan(
  geometry: GuidancePoint[],
  mode: RouteNavigationMode,
): RouteGuidancePlan {
  if (mode === 'off' || geometry.length < 2) return createBreadcrumbGuidancePlan(geometry, mode);
  const steps = generatedStepsFromGeometry(geometry, mode);
  if (!steps.length) return createBreadcrumbGuidancePlan(geometry, mode);
  return createTurnByTurnGuidancePlan({
    mode,
    geometry,
    steps,
    provider: 'saved_route',
    supportsRerouting: false,
  });
}

export function updateRouteGuidanceProgress(input: {
  point: GuidancePoint;
  plan: RouteGuidancePlan;
  previous?: RouteGuidanceProgress | null;
}): RouteGuidanceProgress {
  const { point, plan } = input;
  const nearestDistanceMeters = distanceToPolylineMeters(point, plan.geometry);
  const threshold = plan.mode === 'off' ? Number.POSITIVE_INFINITY : OFF_ROUTE_THRESHOLD_METERS[plan.mode];
  const previousSamples = input.previous?.offRouteSampleCount ?? 0;
  const offRouteSampleCount = nearestDistanceMeters > threshold ? previousSamples + 1 : 0;
  const isOffRoute = offRouteSampleCount >= OFF_ROUTE_REQUIRED_SAMPLES;

  if (plan.kind !== 'turn_by_turn' || plan.steps.length === 0) {
    return {
      nearestDistanceMeters,
      isOffRoute,
      offRouteSampleCount,
      nextStepIndex: null,
      nextInstruction: plan.kind === 'breadcrumb' ? 'Follow saved route' : null,
      distanceToNextStepMeters: null,
    };
  }

  const previousStepIndex = input.previous?.nextStepIndex ?? 0;
  let nextStepIndex = Math.max(0, Math.min(previousStepIndex, plan.steps.length - 1));
  while (
    nextStepIndex < plan.steps.length - 1
    && metersBetweenGuidancePoints(point, plan.steps[nextStepIndex].end) <= 20
  ) {
    nextStepIndex += 1;
  }
  const nextStep = plan.steps[nextStepIndex];

  return {
    nearestDistanceMeters,
    isOffRoute,
    offRouteSampleCount,
    nextStepIndex,
    nextInstruction: nextStep.instruction,
    distanceToNextStepMeters: Math.round(metersBetweenGuidancePoints(point, nextStep.end)),
  };
}

export function formatTurnAnnouncement(instruction: string, distanceMeters: number): string {
  const cleanInstruction = instruction.trim().replace(/\s+/g, ' ');
  if (!cleanInstruction) return '';
  if (distanceMeters <= 35) return cleanInstruction;
  if (distanceMeters < 160.934) {
    const feet = Math.max(50, Math.round((distanceMeters * 3.28084) / 50) * 50);
    return `In ${feet} feet, ${lowercaseFirst(cleanInstruction)}`;
  }
  const miles = distanceMeters / 1609.344;
  return `In ${miles < 1 ? miles.toFixed(1) : miles.toFixed(1)} miles, ${lowercaseFirst(cleanInstruction)}`;
}

export function turnAnnouncementPhase(distanceMeters: number): 'approach' | 'near' | 'now' {
  if (distanceMeters <= 35) return 'now';
  if (distanceMeters < 160.934) return 'near';
  return 'approach';
}

function distanceToPolylineMeters(point: GuidancePoint, geometry: GuidancePoint[]): number {
  if (geometry.length === 0) return Number.POSITIVE_INFINITY;
  if (geometry.length === 1) return metersBetweenGuidancePoints(point, geometry[0]);
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < geometry.length; index += 1) {
    nearest = Math.min(nearest, distanceToSegmentMeters(point, geometry[index - 1], geometry[index]));
  }
  return nearest;
}

function distanceToSegmentMeters(point: GuidancePoint, start: GuidancePoint, end: GuidancePoint): number {
  const refLat = degreesToRadians((start.latitude + end.latitude + point.latitude) / 3);
  const project = (value: GuidancePoint) => ({
    x: degreesToRadians(value.longitude) * EARTH_RADIUS_METERS * Math.cos(refLat),
    y: degreesToRadians(value.latitude) * EARTH_RADIUS_METERS,
  });
  const p = project(point);
  const a = project(start);
  const b = project(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const ratio = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + ratio * dx), p.y - (a.y + ratio * dy));
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function radiansToDegrees(value: number): number {
  return value * 180 / Math.PI;
}

function bearingDegrees(a: GuidancePoint, b: GuidancePoint): number {
  const lat1 = degreesToRadians(a.latitude);
  const lat2 = degreesToRadians(b.latitude);
  const deltaLng = degreesToRadians(b.longitude - a.longitude);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (radiansToDegrees(Math.atan2(y, x)) + 360) % 360;
}

function signedTurnDegrees(inbound: number, outbound: number): number {
  return ((outbound - inbound + 540) % 360) - 180;
}

function turnInstruction(turnDegrees: number): string | null {
  const magnitude = Math.abs(turnDegrees);
  if (magnitude < 28) return null;
  const direction = turnDegrees > 0 ? 'right' : 'left';
  if (magnitude >= 135) return `Make a sharp ${direction}`;
  if (magnitude >= 70) return `Turn ${direction}`;
  return `Bear ${direction}`;
}

function geometryDistance(points: readonly GuidancePoint[], startIndex: number, endIndex: number): number {
  let distance = 0;
  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    distance += metersBetweenGuidancePoints(points[index - 1]!, points[index]!);
  }
  return distance;
}

function generatedStepsFromGeometry(
  geometry: readonly GuidancePoint[],
  mode: Exclude<RouteNavigationMode, 'off'>,
): RouteGuidanceStep[] {
  const steps: RouteGuidanceStep[] = [];
  let segmentStartIndex = 0;
  const expectedSpeedMetersPerSecond = mode === 'cycling' ? 5.5 : 2.2;

  for (let index = 1; index < geometry.length - 1; index += 1) {
    const previous = geometry[index - 1];
    const current = geometry[index];
    const next = geometry[index + 1];
    if (!previous || !current || !next) continue;
    if (metersBetweenGuidancePoints(previous, current) < 8 || metersBetweenGuidancePoints(current, next) < 8) continue;
    const instruction = turnInstruction(signedTurnDegrees(
      bearingDegrees(previous, current),
      bearingDegrees(current, next),
    ));
    if (!instruction) continue;
    const distanceMeters = Math.round(geometryDistance(geometry, segmentStartIndex, index));
    steps.push({
      id: `saved-route-turn-${steps.length + 1}`,
      instruction,
      distanceMeters,
      expectedTravelTimeSeconds: Math.round(distanceMeters / expectedSpeedMetersPerSecond),
      start: geometry[segmentStartIndex]!,
      end: current,
    });
    segmentStartIndex = index;
  }

  const finishIndex = geometry.length - 1;
  const finalDistance = Math.round(geometryDistance(geometry, segmentStartIndex, finishIndex));
  steps.push({
    id: 'saved-route-finish',
    instruction: steps.length ? 'Continue to finish' : 'Continue straight to finish',
    distanceMeters: finalDistance,
    expectedTravelTimeSeconds: Math.round(finalDistance / expectedSpeedMetersPerSecond),
    start: geometry[segmentStartIndex]!,
    end: geometry[finishIndex]!,
  });

  return steps;
}

function lowercaseFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function isFinitePoint(point: GuidancePoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}
