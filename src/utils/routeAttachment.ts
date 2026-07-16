export type RouteDirection = 'forward' | 'reverse';

export type RouteAttachmentState = {
  routeId: string | null;
  direction: RouteDirection;
  status: 'attached' | 'detached';
  attachedAt: number | null;
  detachedAt: number | null;
  lastDetachedRouteId: string | null;
};

export const EMPTY_ROUTE_ATTACHMENT: RouteAttachmentState = {
  routeId: null,
  direction: 'forward',
  status: 'detached',
  attachedAt: null,
  detachedAt: null,
  lastDetachedRouteId: null,
};

export function migrateRouteAttachment(
  attachment: Partial<RouteAttachmentState> | undefined,
  legacySelectedRouteId: string | null | undefined,
): RouteAttachmentState {
  const routeId = attachment?.routeId ?? legacySelectedRouteId ?? null;
  if (!routeId) {
    return {
      ...EMPTY_ROUTE_ATTACHMENT,
      lastDetachedRouteId: attachment?.lastDetachedRouteId ?? null,
      detachedAt: attachment?.detachedAt ?? null,
    };
  }
  return {
    routeId,
    direction: attachment?.direction === 'reverse' ? 'reverse' : 'forward',
    status: 'attached',
    attachedAt: attachment?.attachedAt ?? null,
    detachedAt: null,
    lastDetachedRouteId: attachment?.lastDetachedRouteId ?? null,
  };
}

export function attachRouteState(routeId: string, now = Date.now()): RouteAttachmentState {
  return {
    routeId,
    direction: 'forward',
    status: 'attached',
    attachedAt: now,
    detachedAt: null,
    lastDetachedRouteId: null,
  };
}

export function detachRouteState(
  state: RouteAttachmentState,
  now = Date.now(),
): RouteAttachmentState {
  return {
    routeId: null,
    direction: 'forward',
    status: 'detached',
    attachedAt: null,
    detachedAt: now,
    lastDetachedRouteId: state.routeId ?? state.lastDetachedRouteId,
  };
}

export function reverseRouteState(state: RouteAttachmentState): RouteAttachmentState {
  if (!state.routeId || state.status !== 'attached') return state;
  return {
    ...state,
    direction: state.direction === 'forward' ? 'reverse' : 'forward',
  };
}

export function reverseDistanceFromStart(totalMiles: number, distanceMiles: number): number {
  return Math.max(0, totalMiles - distanceMiles);
}
