export function clampScrubFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function scrubFractionFromX(x: number, width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return clampScrubFraction(x / width);
}

export type ScrubInteractionState = 'idle' | 'dragging';

export function nextScrubInteractionState(
  state: ScrubInteractionState,
  event: 'start' | 'end' | 'cancel',
): ScrubInteractionState {
  if (event === 'start') return 'dragging';
  if (state === 'dragging' && (event === 'end' || event === 'cancel')) return 'idle';
  return state;
}
