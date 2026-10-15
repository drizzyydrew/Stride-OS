export type OutdoorLiveActivityType =
  | 'running'
  | 'walking'
  | 'run_walk'
  | 'cycling'
  | 'indoor_cycling'
  | 'hiking'
  | 'downhill_skiing'
  | 'cross_country_skiing'
  | 'snowboarding'
  | 'ski_touring'
  | 'snowboard_touring'
  | 'mobility'
  | 'active_recovery';

export type LiveActivityControlState =
  | 'ready'
  | 'pause_pending'
  | 'resume_pending'
  | 'complete_pending';

export type LiveActivitySessionIdentity = {
  workoutInstanceId?: string;
  sessionId?: string;
  sessionSource?: string;
};

export function liveActivityCommandMatchesSession(
  command: LiveActivitySessionIdentity,
  target?: { sessionId: string; sessionSource: string },
): boolean {
  if (!target) return true;
  if (!command.workoutInstanceId && !command.sessionId && !command.sessionSource) return true;
  return (command.workoutInstanceId ?? command.sessionId) === target.sessionId
    && command.sessionSource === target.sessionSource;
}

export type OutdoorLiveActivitySnapshot = {
  sessionId?: string;
  workoutInstanceId?: string;
  sessionSource?: 'running' | 'outdoor';
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
  elevationGainMeters?: number;
  elevationLossMeters?: number;
  unitSystem?: 'imperial' | 'metric';
  cadenceValue?: number;
  cadenceUnit?: 'spm' | 'rpm';
  cadenceObservedAt?: number;
  powerWatts?: number;
  powerKind?: 'measured' | 'device_estimated' | 'model_estimated';
  powerObservedAt?: number;
  heartRateObservedAt?: number;
};

export type NormalizedOutdoorLiveActivityPayload = {
  runName: string;
  workoutInstanceId: string;
  sessionId: string;
  sessionSource: 'running' | 'outdoor';
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
  metricUnit: '/mi' | '/km' | 'mph' | 'km/h';
  distanceValue: string;
  distanceUnit: 'mi' | 'km';
  cadenceValue?: number;
  cadenceUnit?: 'spm' | 'rpm';
  cadenceObservedAt?: number;
  powerWatts?: number;
  powerKind?: 'measured' | 'device_estimated' | 'model_estimated';
  powerObservedAt?: number;
  heartRateObservedAt?: number;
  currentInterval: string;
  nextTransition: string;
  navigationInstruction: string;
  cueText: string;
  controlState: LiveActivityControlState;
  elevationDisplay: string;
  descentDisplay: string;
};

export function normalizeOutdoorLiveActivitySnapshot(
  snapshot: OutdoorLiveActivitySnapshot,
  status?: string,
): NormalizedOutdoorLiveActivityPayload {
  const speedBased = snapshot.activityType === 'cycling'
    || snapshot.activityType === 'indoor_cycling'
    || snapshot.activityType === 'downhill_skiing'
    || snapshot.activityType === 'cross_country_skiing'
    || snapshot.activityType === 'snowboarding'
    || snapshot.activityType === 'ski_touring'
    || snapshot.activityType === 'snowboard_touring';
  const metric = snapshot.unitSystem === 'metric';
  const pace = snapshot.averagePace?.trim() || '--:--';
  const metricValue = speedBased
    ? formatSpeed(snapshot.averageSpeedMph == null ? undefined : snapshot.averageSpeedMph * (metric ? 1.609344 : 1))
    : metric ? metricPace(pace) : pace;

  return {
    runName: snapshot.activityName.trim() || defaultActivityName(snapshot.activityType),
    workoutInstanceId: snapshot.workoutInstanceId?.trim() || snapshot.sessionId?.trim() || '',
    sessionId: snapshot.sessionId?.trim() || snapshot.workoutInstanceId?.trim() || '',
    sessionSource: snapshot.sessionSource ?? 'outdoor',
    activityType: snapshot.activityType,
    elapsedSeconds: Math.max(0, Math.round(snapshot.elapsedSeconds)),
    distanceMiles: Math.max(0, snapshot.distanceMiles),
    // Legacy native binaries always interpret this field as minutes per mile.
    averagePace: snapshot.averagePace?.trim() || '--:--',
    heartRate: Math.max(0, Math.round(snapshot.heartRateBpm ?? 0)),
    zoneLabel: snapshot.zoneLabel?.trim() || 'Zone --',
    zoneStatus: snapshot.zoneStatus?.trim() || 'unknown',
    status: status ?? (snapshot.isPaused ? 'Paused' : 'Active'),
    isPaused: snapshot.isPaused,
    metricLabel: speedBased ? 'SPEED' : 'PACE',
    metricValue,
    metricUnit: speedBased ? metric ? 'km/h' : 'mph' : metric ? '/km' : '/mi',
    distanceValue: (Math.max(0, snapshot.distanceMiles) * (metric ? 1.609344 : 1)).toFixed(2),
    distanceUnit: metric ? 'km' : 'mi',
    cadenceValue: finiteNonnegative(snapshot.cadenceValue),
    cadenceUnit: snapshot.cadenceUnit,
    cadenceObservedAt: snapshot.cadenceObservedAt,
    powerWatts: finiteNonnegative(snapshot.powerWatts),
    powerKind: snapshot.powerKind,
    powerObservedAt: snapshot.powerObservedAt,
    heartRateObservedAt: snapshot.heartRateObservedAt,
    currentInterval: snapshot.currentInterval?.trim() || '',
    nextTransition: snapshot.nextTransition?.trim() || '',
    navigationInstruction: snapshot.navigationInstruction?.trim() || '',
    cueText: snapshot.cueText?.trim() || '',
    controlState: snapshot.controlState ?? 'ready',
    elevationDisplay: formatElevation(snapshot.elevationGainMeters, metric),
    descentDisplay: formatElevation(snapshot.elevationLossMeters, metric),
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
  case 'cycling':
  case 'indoor_cycling': return 'Ride';
  case 'mobility': return 'Mobility';
  case 'active_recovery': return 'Active Recovery';
  case 'hiking': return 'Hike';
  case 'downhill_skiing': return 'Downhill Ski';
  case 'cross_country_skiing': return 'Cross-Country Ski';
  case 'snowboarding': return 'Snowboard';
  case 'ski_touring': return 'Ski Touring';
  case 'snowboard_touring': return 'Snowboard Touring';
  default: return 'Training Run';
  }
}

function formatElevation(value: number | undefined, metric = false): string {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return '';
  return `${Math.round((value as number) * (metric ? 1 : 3.28084))} ${metric ? 'm' : 'ft'}`;
}

function metricPace(pace: string): string {
  const match = /^(\d+):(\d{2})$/.exec(pace);
  if (!match) return '--:--';
  const seconds = Math.round((Number(match[1]) * 60 + Number(match[2])) / 1.609344);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function finiteNonnegative(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
