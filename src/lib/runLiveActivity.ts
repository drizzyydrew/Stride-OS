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
import { useActiveRunStore } from '../store/activeRunStore';
import { useSettingsStore } from '../store/settingsStore';
import { isFreshObservation, selectLiveTelemetry } from '../utils/outdoorTelemetry';

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
  unitSystem?: 'imperial' | 'metric';
  heartRateObservedAt?: number;
  cadenceValue?: number;
  cadenceUnit?: 'spm' | 'rpm';
  cadenceObservedAt?: number;
  powerWatts?: number;
  powerKind?: 'measured' | 'device_estimated' | 'model_estimated';
  powerObservedAt?: number;
};

function payloadFromSnapshot(snapshot: RunLiveActivitySnapshot, status?: string): StrideRunLiveActivityPayload {
  const run = useActiveRunStore.getState();
  const matches = run.isActive && run.workoutInstanceId != null
    && (snapshot.workoutInstanceId ?? snapshot.sessionId) === run.workoutInstanceId;
  const live = matches && run.startTime != null && !run.isPaused
    ? selectLiveTelemetry({ rawHeartRateSamples: run.lastHeartRateSample ? [run.lastHeartRateSample] : [],
      cadenceSamples: run.lastCadenceSample ? [run.lastCadenceSample] : [],
      powerSamples: run.lastPowerSample ? [run.lastPowerSample] : [] }, run.startTime, Date.now()) : null;
  const explicitHeartRateFresh = snapshot.heartRateObservedAt != null
    && isFreshObservation(snapshot.heartRateObservedAt, matches ? run.startTime! : 0, Date.now());
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
    heartRateBpm: explicitHeartRateFresh ? snapshot.heartRateBpm : live?.heartRateBpm ?? null,
    heartRateObservedAt: explicitHeartRateFresh ? snapshot.heartRateObservedAt : live?.heartRateSample?.timestamp,
    unitSystem: snapshot.unitSystem ?? useSettingsStore.getState().units,
    cadenceValue: live?.cadenceSample?.kind === 'steps' ? live.cadenceSample.cadenceSpm : snapshot.cadenceValue,
    cadenceUnit: live?.cadenceSample ? 'spm' : snapshot.cadenceUnit,
    cadenceObservedAt: live?.cadenceSample?.timestamp ?? snapshot.cadenceObservedAt,
    powerWatts: live?.powerSample?.watts ?? snapshot.powerWatts,
    powerKind: live?.powerSample?.kind ?? snapshot.powerKind,
    powerObservedAt: live?.powerSample?.timestamp ?? snapshot.powerObservedAt,
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
// Pause/resume and strength controls retain their existing freshness window.
// Stop instead requires exact recording ownership and durable acceptance.
const COMMAND_MAX_AGE_MS = 2 * 60 * 1000;

export function startControlCommandPolling(
  handlers: Partial<Record<StrideControlAction, (command: StrideRunControlCommand) => void | boolean | Promise<void | boolean>>>,
  target?: { sessionId: string; sessionSource: string },
): () => void {
  const consumedIds = new Set<string>();
  const inFlightStops = new Set<string>();
  let stopped = false;
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
    if (command.action === 'stop') {
      if (inFlightStops.has(command.id)) return;
      inFlightStops.add(command.id);
      void (async () => {
        try {
          const accepted = await handler(command);
          if (accepted !== true || stopped) return;
          consumedIds.add(command.id);
          clearPendingRunControlCommand(command.id);
        } catch (error) {
          console.warn('[Live Activity Stop retained]', error instanceof Error ? error.message : 'Retry pending');
        } finally {
          inFlightStops.delete(command.id);
        }
      })();
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
    stopped = true;
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
