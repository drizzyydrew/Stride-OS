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

export type RunLiveActivitySnapshot = {
  elapsedSeconds: number;
  distanceMiles: number;
  averagePace: string;
  heartRateBpm: number | null;
  zoneLabel: string;
  zoneStatus: string;
  isPaused: boolean;
};

function payloadFromSnapshot(snapshot: RunLiveActivitySnapshot, status?: string): StrideRunLiveActivityPayload {
  return {
    runName: 'Training Run',
    elapsedSeconds: snapshot.elapsedSeconds,
    distanceMiles: snapshot.distanceMiles,
    averagePace: snapshot.averagePace || '--:--',
    heartRate: snapshot.heartRateBpm ?? 0,
    zoneLabel: snapshot.zoneLabel || 'Zone --',
    zoneStatus: snapshot.zoneStatus || 'unknown',
    status: status ?? (snapshot.isPaused ? 'Paused' : 'Running'),
    isPaused: snapshot.isPaused,
  };
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
  handlers: Partial<Record<StrideControlAction, () => void>>,
): () => void {
  const id = setInterval(() => {
    const command = getPendingRunControlCommand();
    if (!command) return;
    const handler = handlers[command.action];
    // Only consume commands this poller owns — a run poller must not eat a
    // strength command (and vice versa) if both are ever active together.
    if (!handler) return;
    clearPendingRunControlCommand(command.id);
    const ageMs = Date.now() - command.createdAt * 1000;
    if (ageMs > COMMAND_MAX_AGE_MS) return;
    handler();
  }, COMMAND_POLL_INTERVAL_MS);
  return () => clearInterval(id);
}

export {
  addRunIntentListener,
  clearPendingRunControlCommand,
  getPendingRunControlCommand,
  type StrideRunControlCommand,
};
