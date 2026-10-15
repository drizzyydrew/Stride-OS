import type { WatchRecordingEvidence } from '../types/activity';

/** Only a native recording-state event with the exact session ID is evidence. */
export function watchRecordingForEvent(recordingId: string | null | undefined, event: {
  workoutInstanceId?: string;
  timestamp: number;
  state: string;
}): WatchRecordingEvidence | undefined {
  if (!recordingId || event.workoutInstanceId !== recordingId || !Number.isFinite(event.timestamp)
    || event.timestamp <= 0 || !['running', 'paused', 'ended'].includes(event.state)) return undefined;
  return { workoutInstanceId: recordingId, confirmedAt: event.timestamp, state: event.state as WatchRecordingEvidence['state'] };
}
