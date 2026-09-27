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
  /** Distance along the route geometry to this step's turn point (saved-route steps). */
  endAlongMeters?: number;
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
  /** Athlete's position projected onto the route, meters from the start. */
  alongMeters?: number | null;
  /** Last position used for heading (wrong-way detection). */
  lastPoint?: GuidancePoint | null;
  wrongWaySampleCount?: number;
  isWrongWay?: boolean;
};

const EARTH_RADIUS_METERS = 6_371_000;
const OFF_ROUTE_THRESHOLD_METERS: Record<Exclude<RouteNavigationMode, 'off'>, number> = {
  walking: 45,
  cycling: 75,
};
const OFF_ROUTE_REQUIRED_SAMPLES = 3;
// Wrong way: heading more than this far from the route direction, sustained,
// while actually moving (GPS jitter while standing still has random heading).
const WRONG_WAY_DEGREES = 120;
const WRONG_WAY_REQUIRED_SAMPLES = 3;
const WRONG_WAY_MIN_MOVE_METERS = 5;
// Turn detection over a physical window instead of adjacent vertices, so dense
// snapped geometry (small jogs, curve vertices) can't produce a false or
// opposite-direction turn right before the real one.
const TURN_WINDOW_METERS = 25;
const TURN_CLUSTER_METERS = 30;
const STEP_ADVANCE_TOLERANCE_METERS = 15;
// Along-route search window (keeps out-and-back routes from snapping to the
// other leg of the course).
const ALONG_SEARCH_BACK_METERS = 60;
const ALONG_SEARCH_AHEAD_METERS = 500;

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
    const along = plan.kind === 'breadcrumb' ? projectAlongRoute(point, plan.geometry, input.previous?.alongMeters ?? null) : null;
    const wrongWay = plan.kind === 'breadcrumb'
      ? evaluateWrongWay(point, plan.geometry, along, input.previous, isOffRoute)
      : { count: 0, isWrongWay: false };
    return {
      nearestDistanceMeters,
      isOffRoute,
      offRouteSampleCount,
      nextStepIndex: null,
      nextInstruction: isOffRoute
        ? 'Off route — return to the saved route'
        : wrongWay.isWrongWay
          ? 'Wrong direction — turn around'
          : plan.kind === 'breadcrumb' ? 'Follow saved route' : null,
      distanceToNextStepMeters: null,
      alongMeters: along,
      lastPoint: point,
      wrongWaySampleCount: wrongWay.count,
      isWrongWay: wrongWay.isWrongWay,
    };
  }

  const along = projectAlongRoute(point, plan.geometry, input.previous?.alongMeters ?? null);
  const wrongWay = evaluateWrongWay(point, plan.geometry, along, input.previous, isOffRoute);

  const previousStepIndex = input.previous?.nextStepIndex ?? 0;
  let nextStepIndex = Math.max(0, Math.min(previousStepIndex, plan.steps.length - 1));
  const usesAlong = along != null && plan.steps.every(step => typeof step.endAlongMeters === 'number');
  while (nextStepIndex < plan.steps.length - 1) {
    const step = plan.steps[nextStepIndex]!;
    // Saved-route steps advance by progress along the route, so cutting a
    // corner (never coming within 20 m of the vertex) still moves on.
    const passed = usesAlong
      ? along! >= step.endAlongMeters! - STEP_ADVANCE_TOLERANCE_METERS
      : metersBetweenGuidancePoints(point, step.end) <= 20;
    if (!passed) break;
    nextStepIndex += 1;
  }
  const nextStep = plan.steps[nextStepIndex]!;
  const distanceToNextStepMeters = usesAlong
    ? Math.max(0, Math.round(nextStep.endAlongMeters! - along!))
    : Math.round(metersBetweenGuidancePoints(point, nextStep.end));

  return {
    nearestDistanceMeters,
    isOffRoute,
    offRouteSampleCount,
    nextStepIndex,
    nextInstruction: isOffRoute
      ? 'Off route — return to the saved route'
      : wrongWay.isWrongWay
        ? 'Wrong direction — turn around'
        : nextStep.instruction,
    distanceToNextStepMeters,
    alongMeters: along,
    lastPoint: point,
    wrongWaySampleCount: wrongWay.count,
    isWrongWay: wrongWay.isWrongWay,
  };
}

/** Cumulative distance (m) at each geometry vertex. */
function cumulativeDistances(geometry: readonly GuidancePoint[]): number[] {
  const out = [0];
  for (let i = 1; i < geometry.length; i += 1) {
    out.push(out[i - 1]! + metersBetweenGuidancePoints(geometry[i - 1]!, geometry[i]!));
  }
  return out;
}

/**
 * Projects a position onto the route and returns meters from the start. When
 * a previous along value exists, only segments near it are considered.
 */
function projectAlongRoute(
  point: GuidancePoint,
  geometry: readonly GuidancePoint[],
  previousAlong: number | null,
): number | null {
  if (geometry.length < 2) return null;
  const cumulative = cumulativeDistances(geometry);
  let best: { distance: number; along: number } | null = null;
  for (let i = 1; i < geometry.length; i += 1) {
    const segStart = cumulative[i - 1]!;
    const segEnd = cumulative[i]!;
    if (previousAlong != null && (segEnd < previousAlong - ALONG_SEARCH_BACK_METERS || segStart > previousAlong + ALONG_SEARCH_AHEAD_METERS)) {
      continue;
    }
    const projection = projectOntoSegment(point, geometry[i - 1]!, geometry[i]!);
    const along = segStart + projection.ratio * (segEnd - segStart);
    if (!best || projection.distance < best.distance) best = { distance: projection.distance, along };
  }
  return best ? best.along : null;
}

function routeBearingAt(geometry: readonly GuidancePoint[], alongMeters: number): number | null {
  const cumulative = cumulativeDistances(geometry);
  for (let i = 1; i < geometry.length; i += 1) {
    if (cumulative[i]! >= alongMeters && metersBetweenGuidancePoints(geometry[i - 1]!, geometry[i]!) > 0.5) {
      return bearingDegrees(geometry[i - 1]!, geometry[i]!);
    }
  }
  return null;
}

function evaluateWrongWay(
  point: GuidancePoint,
  geometry: readonly GuidancePoint[],
  along: number | null,
  previous: RouteGuidanceProgress | null | undefined,
  isOffRoute: boolean,
): { count: number; isWrongWay: boolean } {
  const previousCount = previous?.wrongWaySampleCount ?? 0;
  const last = previous?.lastPoint;
  if (isOffRoute || along == null || !last) return { count: 0, isWrongWay: false };
  const moved = metersBetweenGuidancePoints(last, point);
  // Not enough movement to know the heading: keep the current count.
  if (moved < WRONG_WAY_MIN_MOVE_METERS) {
    return { count: previousCount, isWrongWay: previousCount >= WRONG_WAY_REQUIRED_SAMPLES };
  }
  const routeBearing = routeBearingAt(geometry, along);
  if (routeBearing == null) return { count: 0, isWrongWay: false };
  const headingDelta = Math.abs(signedTurnDegrees(routeBearing, bearingDegrees(last, point)));
  const count = headingDelta > WRONG_WAY_DEGREES ? previousCount + 1 : 0;
  return { count, isWrongWay: count >= WRONG_WAY_REQUIRED_SAMPLES };
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
  return projectOntoSegment(point, start, end).distance;
}

function projectOntoSegment(point: GuidancePoint, start: GuidancePoint, end: GuidancePoint): { distance: number; ratio: number } {
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
  if (lengthSquared === 0) return { distance: Math.hypot(p.x - a.x, p.y - a.y), ratio: 0 };
  const ratio = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return { distance: Math.hypot(p.x - (a.x + ratio * dx), p.y - (a.y + ratio * dy)), ratio };
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
  if (magnitude < 35) return null;
  const direction = turnDegrees > 0 ? 'right' : 'left';
  if (magnitude >= 135) return `Make a sharp ${direction}`;
  if (magnitude >= 70) return `Turn ${direction}`;
  return `Bear ${direction}`;
}

/** Point on the geometry at a given distance from the start (linear interp). */
function pointAtAlong(
  geometry: readonly GuidancePoint[],
  cumulative: readonly number[],
  along: number,
): GuidancePoint {
  const target = Math.max(0, Math.min(cumulative[cumulative.length - 1]!, along));
  for (let i = 1; i < geometry.length; i += 1) {
    if (cumulative[i]! >= target) {
      const span = cumulative[i]! - cumulative[i - 1]!;
      const t = span > 0 ? (target - cumulative[i - 1]!) / span : 0;
      const a = geometry[i - 1]!;
      const b = geometry[i]!;
      return { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t };
    }
  }
  return geometry[geometry.length - 1]!;
}

function generatedStepsFromGeometry(
  geometry: readonly GuidancePoint[],
  mode: Exclude<RouteNavigationMode, 'off'>,
): RouteGuidanceStep[] {
  const expectedSpeedMetersPerSecond = mode === 'cycling' ? 5.5 : 2.2;
  const cumulative = cumulativeDistances(geometry);
  const total = cumulative[cumulative.length - 1] ?? 0;

  // 1. Candidate turns: bearing change measured over TURN_WINDOW_METERS before
  //    and after each vertex (robust to dense or zig-zag vertices).
  const candidates: { index: number; along: number; degrees: number }[] = [];
  for (let index = 1; index < geometry.length - 1; index += 1) {
    const along = cumulative[index]!;
    if (along < TURN_WINDOW_METERS || total - along < TURN_WINDOW_METERS) continue;
    const before = pointAtAlong(geometry, cumulative, along - TURN_WINDOW_METERS);
    const after = pointAtAlong(geometry, cumulative, along + TURN_WINDOW_METERS);
    const current = geometry[index]!;
    const degrees = signedTurnDegrees(bearingDegrees(before, current), bearingDegrees(current, after));
    if (Math.abs(degrees) >= 35) candidates.push({ index, along, degrees });
  }

  // 2. One turn per corner: within TURN_CLUSTER_METERS keep the strongest.
  const turns: typeof candidates = [];
  for (const candidate of candidates) {
    const last = turns[turns.length - 1];
    if (last && candidate.along - last.along <= TURN_CLUSTER_METERS) {
      if (Math.abs(candidate.degrees) > Math.abs(last.degrees)) turns[turns.length - 1] = candidate;
    } else {
      turns.push(candidate);
    }
  }

  const steps: RouteGuidanceStep[] = [];
  let segmentStartIndex = 0;
  for (const turn of turns) {
    const instruction = turnInstruction(turn.degrees);
    if (!instruction) continue;
    const distanceMeters = Math.round(turn.along - cumulative[segmentStartIndex]!);
    steps.push({
      id: `saved-route-turn-${steps.length + 1}`,
      instruction,
      distanceMeters,
      expectedTravelTimeSeconds: Math.round(distanceMeters / expectedSpeedMetersPerSecond),
      start: geometry[segmentStartIndex]!,
      end: geometry[turn.index]!,
      endAlongMeters: turn.along,
    });
    segmentStartIndex = turn.index;
  }

  const finishIndex = geometry.length - 1;
  const finalDistance = Math.round(total - cumulative[segmentStartIndex]!);
  steps.push({
    id: 'saved-route-finish',
    instruction: steps.length ? 'Continue to finish' : 'Continue straight to finish',
    distanceMeters: finalDistance,
    expectedTravelTimeSeconds: Math.round(finalDistance / expectedSpeedMetersPerSecond),
    start: geometry[segmentStartIndex]!,
    end: geometry[finishIndex]!,
    endAlongMeters: total,
  });

  return steps;
}

function lowercaseFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function isFinitePoint(point: GuidancePoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

// ─── Off-route / wrong-way announcements ─────────────────────────────────────
// Spoken once when the condition starts, then at most once per repeat window
// while it continues. (Previously the off-route cue repeated on every fix.)
export type GuidanceAlertKind = 'off_route' | 'wrong_way';
export type GuidanceAlertState = { kind: GuidanceAlertKind | null; lastSpokenAtMs: number | null };
export const GUIDANCE_ALERT_REPEAT_MS = 60_000;
export const INITIAL_GUIDANCE_ALERT_STATE: GuidanceAlertState = { kind: null, lastSpokenAtMs: null };

const GUIDANCE_ALERT_TEXT: Record<GuidanceAlertKind, string> = {
  off_route: "You're off route. Head back to the saved route.",
  wrong_way: 'Wrong direction. Turn around to follow the route.',
};

export function guidanceAlertCue(
  progress: Pick<RouteGuidanceProgress, 'isOffRoute' | 'isWrongWay'>,
  previous: GuidanceAlertState,
  nowMs: number,
): { cue: string | null; state: GuidanceAlertState } {
  const kind: GuidanceAlertKind | null = progress.isOffRoute ? 'off_route' : progress.isWrongWay ? 'wrong_way' : null;
  if (!kind) return { cue: null, state: INITIAL_GUIDANCE_ALERT_STATE };
  const due = previous.kind !== kind
    || previous.lastSpokenAtMs == null
    || nowMs - previous.lastSpokenAtMs >= GUIDANCE_ALERT_REPEAT_MS;
  if (!due) return { cue: null, state: previous };
  return { cue: GUIDANCE_ALERT_TEXT[kind], state: { kind, lastSpokenAtMs: nowMs } };
}

/** On-screen text for the current guidance state. */
export function guidanceDisplayText(progress: RouteGuidanceProgress | null | undefined): string | null {
  if (!progress) return null;
  if (progress.isOffRoute || progress.isWrongWay) return progress.nextInstruction;
  if (progress.nextInstruction && progress.distanceToNextStepMeters != null) {
    return formatTurnAnnouncement(progress.nextInstruction, progress.distanceToNextStepMeters);
  }
  return progress.nextInstruction;
}
