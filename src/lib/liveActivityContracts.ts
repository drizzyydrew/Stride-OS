export type OutdoorLiveActivityType =
  | 'running'
  | 'walking'
  | 'run_walk'
  | 'cycling'
  | 'hiking'
  | 'downhill_skiing'
  | 'cross_country_skiing';

export type LiveActivityControlState =
  | 'ready'
  | 'pause_pending'
  | 'resume_pending'
  | 'complete_pending';

export type OutdoorLiveActivitySnapshot = {
  activityName: string;
  activityType: OutdoorLiveActivityType;
  elapsedSeconds: number;
  distanceMiles: number;
  averagePace?: string;
  averageSpeedMph?: number;
  heartRateBpm: number | null;
  zoneLabel?: string;
  zoneStatus?: string;
  isPaused: boolean;
  currentInterval?: string;
  nextTransition?: string;
  navigationInstruction?: string;
  cueText?: string;
  controlState?: LiveActivityControlState;
};

export type NormalizedOutdoorLiveActivityPayload = {
  runName: string;
  activityType: OutdoorLiveActivityType;
  elapsedSeconds: number;
  distanceMiles: number;
  averagePace: string;
  heartRate: number;
  zoneLabel: string;
  zoneStatus: string;
  status: string;
  isPaused: boolean;
  metricLabel: 'PACE' | 'SPEED';
  metricValue: string;
  metricUnit: '/mi' | 'mph';
  currentInterval: string;
  nextTransition: string;
  navigationInstruction: string;
  cueText: string;
  controlState: LiveActivityControlState;
};

export function normalizeOutdoorLiveActivitySnapshot(
  snapshot: OutdoorLiveActivitySnapshot,
  status?: string,
): NormalizedOutdoorLiveActivityPayload {
  const speedBased = snapshot.activityType === 'cycling'
    || snapshot.activityType === 'downhill_skiing'
    || snapshot.activityType === 'cross_country_skiing';
  const metricValue = speedBased
    ? formatSpeed(snapshot.averageSpeedMph)
    : snapshot.averagePace?.trim() || '--:--';

  return {
    runName: snapshot.activityName.trim() || defaultActivityName(snapshot.activityType),
    activityType: snapshot.activityType,
    elapsedSeconds: Math.max(0, Math.round(snapshot.elapsedSeconds)),
    distanceMiles: Math.max(0, snapshot.distanceMiles),
    averagePace: metricValue,
    heartRate: Math.max(0, Math.round(snapshot.heartRateBpm ?? 0)),
    zoneLabel: snapshot.zoneLabel?.trim() || 'Zone --',
    zoneStatus: snapshot.zoneStatus?.trim() || 'unknown',
    status: status ?? (snapshot.isPaused ? 'Paused' : 'Active'),
    isPaused: snapshot.isPaused,
    metricLabel: speedBased ? 'SPEED' : 'PACE',
    metricValue,
    metricUnit: speedBased ? 'mph' : '/mi',
    currentInterval: snapshot.currentInterval?.trim() || '',
    nextTransition: snapshot.nextTransition?.trim() || '',
    navigationInstruction: snapshot.navigationInstruction?.trim() || '',
    cueText: snapshot.cueText?.trim() || '',
    controlState: snapshot.controlState ?? 'ready',
  };
}

export function shouldAcceptControlCommand(input: {
  pendingAction: string | null;
  pendingCreatedAtMs: number | null;
  nextAction: string;
  nowMs: number;
}): boolean {
  if (!input.pendingAction || input.pendingCreatedAtMs === null) return true;
  const ageMs = input.nowMs - input.pendingCreatedAtMs;
  if (ageMs < 0) return false;
  if (ageMs <= 15_000) return false;
  return true;
}

function formatSpeed(value: number | undefined): string {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return '--.-';
  return (value as number).toFixed(1);
}

function defaultActivityName(type: OutdoorLiveActivityType): string {
  switch (type) {
  case 'walking': return 'Walk';
  case 'run_walk': return 'Run / Walk';
  case 'cycling': return 'Ride';
  case 'hiking': return 'Hike';
  case 'downhill_skiing': return 'Downhill Ski';
  case 'cross_country_skiing': return 'Cross-Country Ski';
  default: return 'Training Run';
  }
}
