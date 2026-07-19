export const MARKER_EDGE_INSET = 0.01;

export type NormalizedMarkerPoint = { x: number; y: number };
export type MarkerStageSize = { width: number; height: number };
export type MarkerDragDelta = { dx: number; dy: number };

export function clampMarkerCoordinate(value: number, inset: number = MARKER_EDGE_INSET): number {
  return Math.max(inset, Math.min(1 - inset, value));
}

export function normalizedMarkerFromDrag(
  start: NormalizedMarkerPoint,
  delta: MarkerDragDelta,
  size: MarkerStageSize,
  inset: number = MARKER_EDGE_INSET,
): NormalizedMarkerPoint {
  return {
    x: clampMarkerCoordinate(start.x + delta.dx / Math.max(1, size.width), inset),
    y: clampMarkerCoordinate(start.y + delta.dy / Math.max(1, size.height), inset),
  };
}
