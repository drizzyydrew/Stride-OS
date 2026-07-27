import {
  addRunIntentListener,
  clearPendingRunControlCommand,
  endStrideRunLiveActivity,
  getPendingRunControlCommand,
  startStrideRunLiveActivity,
  updateStrideRunLiveActivity,
  type StrideControlAction,
  type StrideRunControlCommand,
  type StrideRunLiveActivityPayload,
} from 'stride-live-activity';
import {
  liveActivityCommandMatchesSession,
  normalizeOutdoorLiveActivitySnapshot,
  type LiveActivityControlState,
  type OutdoorLiveActivitySnapshot,
  type OutdoorLiveActivityType,
} from './liveActivityContracts';

export type RunLiveActivitySnapshot = {
  sessionId?: string;
  workoutInstanceId?: string;
  sessionSource?: 'running' | 'outdoor';
  elapsedSeconds: number;
  distanceMiles: number;
  averagePace: string;
  heartRateBpm: number | null;
  zoneLabel: string;
  zoneStatus: string;
  isPaused: boolean;
  activityName?: string;
  activityType?: OutdoorLiveActivityType;
  averageSpeedMph?: number;
  currentInterval?: string;
  nextTransition?: string;
  navigationInstruction?: string;
  cueText?: string;
  controlState?: LiveActivityControlState;
};

function payloadFromSnapshot(snapshot: RunLiveActivitySnapshot, status?: string): StrideRunLiveActivityPayload {
  return normalizeOutdoorLiveActivitySnapshot({
    sessionId: snapshot.sessionId,
    workoutInstanceId: snapshot.workoutInstanceId,
    sessionSource: snapshot.sessionSource ?? 'running',
    activityName: snapshot.activityName ?? 'Training Run',
    activityType: snapshot.activityType ?? 'running',
    elapsedSeconds: snapshot.elapsedSeconds,
    distanceMiles: snapshot.distanceMiles,
    averagePace: snapshot.averagePace,
    averageSpeedMph: snapshot.averageSpeedMph,
    heartRateBpm: snapshot.heartRateBpm,
    zoneLabel: snapshot.zoneLabel,
    zoneStatus: snapshot.zoneStatus,
    isPaused: snapshot.isPaused,
    currentInterval: snapshot.currentInterval,
    nextTransition: snapshot.nextTransition,
    navigationInstruction: snapshot.navigationInstruction,
    cueText: snapshot.cueText,
    controlState: snapshot.controlState,
  }, status ?? (snapshot.isPaused ? 'Paused' : 'Active'));
}

export type { OutdoorLiveActivitySnapshot, OutdoorLiveActivityType };

export async function startOutdoorLiveActivity(snapshot: OutdoorLiveActivitySnapshot): Promise<void> {
  await startStrideRunLiveActivity(normalizeOutdoorLiveActivitySnapshot(snapshot));
}

export async function updateOutdoorLiveActivity(snapshot: OutdoorLiveActivitySnapshot): Promise<void> {
  await updateStrideRunLiveActivity(normalizeOutdoorLiveActivitySnapshot(snapshot));
}

export async function endOutdoorLiveActivity(snapshot: OutdoorLiveActivitySnapshot): Promise<void> {
  await endStrideRunLiveActivity(normalizeOutdoorLiveActivitySnapshot(snapshot, 'Finished'));
}

export async function startRunLiveActivity(snapshot: RunLiveActivitySnapshot): Promise<void> {
  await startStrideRunLiveActivity(payloadFromSnapshot(snapshot, 'Running'));
}

export async function updateRunLiveActivity(snapshot: RunLiveActivitySnapshot): Promise<void> {
  await updateStrideRunLiveActivity(payloadFromSnapshot(snapshot));
}

export async function endRunLiveActivity(snapshot: RunLiveActivitySnapshot): Promise<void> {
  await endStrideRunLiveActivity(payloadFromSnapshot(snapshot, 'Finished'));
}

// ─── Lock-screen control command polling ──────────────────────────────────────
//
// Lock-screen buttons are AppIntents that execute in the WIDGET process. They
// cannot post NotificationCenter events into the app (process-local), so they
// write a command into the App Group store instead. This poller is the app
// side of that bridge: while a workout is active, read the pending command
// every second, dispatch it to the matching handler, and clear it by id.
// Without this, lock-screen Pause/Stop/Complete never reach the app — the
// app's own per-second Live Activity updates then instantly overwrite the
// widget's optimistic state (the "pause immediately resumes" bug).

const COMMAND_POLL_INTERVAL_MS = 1000;
// Commands older than this are stale (e.g. from a previous session) — clear
// without dispatching so a dead "stop" can't kill a fresh run.
const COMMAND_MAX_AGE_MS = 2 * 60 * 1000;

export function startControlCommandPolling(
  handlers: Partial<Record<StrideControlAction, (command: StrideRunControlCommand) => void>>,
  target?: { sessionId: string; sessionSource: string },
): () => void {
  const consumedIds = new Set<string>();
  const id = setInterval(() => {
    const command = getPendingRunControlCommand();
    if (!command) return;
    const handler = handlers[command.action];
    // Only consume commands this poller owns — a run poller must not eat a
    // strength command (and vice versa) if both are ever active together.
    if (!handler) return;
    if (!liveActivityCommandMatchesSession(command, target)) return;
    if (consumedIds.has(command.id)) {
      clearPendingRunControlCommand(command.id);
      return;
    }
    consumedIds.add(command.id);
    const ageMs = Date.now() - command.createdAt * 1000;
    if (ageMs > COMMAND_MAX_AGE_MS) {
      clearPendingRunControlCommand(command.id);
      return;
    }
    handler(command);
    clearPendingRunControlCommand(command.id);
  }, COMMAND_POLL_INTERVAL_MS);
  return () => {
    clearInterval(id);
    consumedIds.clear();
  };
}

export {
  addRunIntentListener,
  clearPendingRunControlCommand,
  getPendingRunControlCommand,
  type StrideRunControlCommand,
};
