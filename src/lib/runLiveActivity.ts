import {
  addRunIntentListener,
  clearPendingRunControlCommand,
  endStrideRunLiveActivity,
  getPendingRunControlCommand,
  startStrideRunLiveActivity,
  updateStrideRunLiveActivity,
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

export {
  addRunIntentListener,
  clearPendingRunControlCommand,
  getPendingRunControlCommand,
  type StrideRunControlCommand,
};
