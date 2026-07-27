// ─── Recalculation pipeline ────────────────────────────────────────────────
//
// One entry point, invoked automatically after every activity add/update/
// remove (see activityStore.ts) and by the manual Refresh control on the
// Activity screen — both call this exact function, so "refresh" never means
// something different than what already runs on its own. Synchronous and
// side-effect-safe: no dangling promises, no silent spinners. Records the
// outcome in recalculationStore so the UI can show a real last-updated time,
// success, or error state.

import { useRecalculationStore } from '../store/recalculationStore';
import { buildTrainingOutlook } from '../utils/trainingOutlook';
import { buildRecalculationDecisionSnapshot } from '../utils/training/recalculationDecisionSnapshot';
import type { Activity } from '../types/activity';

export type RecalculationReason =
  | 'activity_added'
  | 'activity_updated'
  | 'activity_removed'
  | 'manual_refresh'
  | 'adaptation_confirmed'
  | 'missed_session'
  | 'readiness_changed'
  | 'deload_transition'
  | 'phase_transition'
  | 'event_date_changed';

export function runRecalculation(
  reason: RecalculationReason,
  activities: readonly Activity[],
): void {
  const store = useRecalculationStore.getState();
  store.begin(reason);
  try {
    // Today this recomputes the ACWR snapshot from the normalized activity
    // store (the aggregate that isn't purely render-derived — useWeekPlan
    // reads calculateACWR() directly on every render, but background/
    // notification-triggered recalculation and the manual Refresh control
    // need a value that exists outside of a mounted screen). Later phases
    // hook fatigue/load recomputation into this same pass.
    const { acwr, decisionSnapshot } = buildRecalculationDecisionSnapshot(activities);
    const trainingOutlook = buildTrainingOutlook({ activities, decisionSnapshot });
    useRecalculationStore.getState().succeed(acwr, decisionSnapshot, trainingOutlook);
  } catch (error) {
    useRecalculationStore.getState().fail(error instanceof Error ? error.message : 'Recalculation failed.');
  }
}
