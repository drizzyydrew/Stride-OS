import type { FeatureTourId } from './featureTours';

export type FeatureTourEventName =
  | 'feature_tour_started'
  | 'feature_tour_step_viewed'
  | 'feature_tour_completed'
  | 'feature_tour_skipped'
  | 'feature_tour_replayed';

export type FeatureTourEvent = {
  name: FeatureTourEventName;
  tourId: FeatureTourId;
  tourVersion: number;
  stepId?: string;
  stepNumber?: number;
  entrySource?: 'first_use' | 'replay' | 'manual';
  createdAt: number;
};

type Listener = (event: FeatureTourEvent) => void;

const listeners = new Set<Listener>();

export function recordFeatureTourEvent(event: Omit<FeatureTourEvent, 'createdAt'>): FeatureTourEvent {
  const fullEvent = { ...event, createdAt: Date.now() };
  listeners.forEach(listener => listener(fullEvent));
  return fullEvent;
}

export function subscribeFeatureTourEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
