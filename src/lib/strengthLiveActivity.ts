import {
  addStrengthIntentListener,
  endStrengthLiveActivity as endNativeStrengthLiveActivity,
  startStrengthLiveActivity as startNativeStrengthLiveActivity,
  updateStrengthLiveActivity as updateNativeStrengthLiveActivity,
  type StrideStrengthLiveActivityPayload,
} from 'stride-live-activity';
import { useActiveStrengthSessionStore } from '../store/activeStrengthSessionStore';

export type StrengthLiveActivityPayload = StrideStrengthLiveActivityPayload;

/**
 * Build 38 callers historically packed the prescription and load into the
 * current-exercise string. Normalize that legacy shape here so every strength
 * source gets the same readable native contract while callers migrate.
 */
export function normalizeStrengthLiveActivityPayload(
  payload: StrengthLiveActivityPayload,
): StrengthLiveActivityPayload {
  const activeSession = useActiveStrengthSessionStore.getState().session;
  let currentExercise = payload.currentExercise.trim();
  let prescription = payload.prescription?.trim() ?? '';
  let loadDisplay = payload.loadDisplay?.trim() ?? '';

  const detailSeparator = currentExercise.indexOf(' · ');
  if (detailSeparator >= 0) {
    const detail = currentExercise.slice(detailSeparator + 3).trim();
    currentExercise = currentExercise.slice(0, detailSeparator).trim();
    const loadSeparator = detail.indexOf(' @ ');
    if (loadSeparator >= 0) {
      if (!prescription) prescription = detail.slice(0, loadSeparator).trim();
      if (!loadDisplay) loadDisplay = detail.slice(loadSeparator + 3).trim();
    } else if (!prescription) {
      prescription = detail;
    }
  }

  return {
    ...payload,
    sessionId: payload.sessionId
      ?? (activeSession ? strengthLiveActivitySessionId(activeSession) : ''),
    sessionSource: payload.sessionSource ?? activeSession?.source ?? 'training_block',
    currentExercise,
    prescription,
    loadDisplay,
    progressLabel: payload.progressLabel?.trim()
      || `${Math.max(0, payload.setsCompleted)}/${Math.max(1, payload.totalSets)} exercises`,
  };
}

export function strengthLiveActivitySessionId(session: {
  source: string;
  workoutId: string;
  startedAt: number;
}): string {
  return `${session.source}:${session.workoutId}:${session.startedAt}`;
}

export async function startStrengthLiveActivity(
  payload: StrengthLiveActivityPayload,
): Promise<string | null> {
  return startNativeStrengthLiveActivity(normalizeStrengthLiveActivityPayload(payload));
}

export async function updateStrengthLiveActivity(
  payload: StrengthLiveActivityPayload,
): Promise<void> {
  await updateNativeStrengthLiveActivity(normalizeStrengthLiveActivityPayload(payload));
}

export async function endStrengthLiveActivity(): Promise<void> {
  await endNativeStrengthLiveActivity();
}

export { addStrengthIntentListener };
