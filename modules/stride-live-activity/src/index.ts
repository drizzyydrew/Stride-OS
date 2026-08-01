import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type StrideRunLiveActivityPayload = {
  workoutInstanceId?: string;
  sessionId?: string;
  sessionSource?: 'running' | 'outdoor' | string;
  runName: string;
  activityType?: string;
  elapsedSeconds: number;
  distanceMiles: number;
  averagePace: string;
  heartRate: number;
  zoneLabel: string;
  zoneStatus: 'in' | 'near' | 'out' | 'unknown' | string;
  status: 'Running' | 'Paused' | 'Finished' | string;
  isPaused?: boolean;
  metricLabel?: string;
  metricValue?: string;
  metricUnit?: string;
  currentInterval?: string;
  nextTransition?: string;
  navigationInstruction?: string;
  cueText?: string;
  controlState?: 'ready' | 'pause_pending' | 'resume_pending' | 'complete_pending';
  elevationDisplay?: string;
  descentDisplay?: string;
};

export type StrideStrengthLiveActivityPayload = {
  workoutInstanceId?: string;
  sessionId?: string;
  sessionSource?: 'training_block' | 'preset' | string;
  workoutName: string;
  elapsedSeconds: number;
  currentExercise: string;
  nextExercise: string;
  setsCompleted: number;
  totalSets: number;
  isPaused?: boolean;
  prescription?: string;
  loadDisplay?: string;
  progressLabel?: string;
  controlState?: 'ready' | 'pause_pending' | 'resume_pending' | 'complete_pending';
};

export type AppleRouteDirectionsResult = {
  geometry: { latitude: number; longitude: number }[];
  steps: {
    id: string;
    instruction: string;
    distanceMeters: number;
    expectedTravelTimeSeconds: number;
    start: { latitude: number; longitude: number };
    end: { latitude: number; longitude: number };
  }[];
};

export type StrideControlAction =
  | 'pause'
  | 'resume'
  | 'stop'
  | 'strength_pause'
  | 'strength_resume'
  | 'strength_complete';

export type StrideRunControlCommand = {
  id: string;
  action: StrideControlAction;
  createdAt: number;
  sessionId?: string;
  sessionSource?: string;
  activityKitId?: string;
};

export type StrideLiveActivityDiagnostics = {
  areActivitiesEnabled: boolean;
  activeRunActivityCount: number;
  activeStrengthActivityCount: number;
  appGroupIdentifier: string;
  lastStartResult?: string;
  lastUpdateResult?: string;
  lastEndResult?: string;
  lastRequestError?: string;
};

const VALID_CONTROL_ACTIONS: readonly StrideControlAction[] = [
  'pause', 'resume', 'stop', 'strength_pause', 'strength_resume', 'strength_complete',
];

type StrideLiveActivityModule = {
  isAvailable: () => boolean;
  getPendingRunControlCommand?: () => StrideRunControlCommand | null;
  clearPendingRunControlCommand?: (id: string) => void;
  start: (
    sessionId: string,
    sessionSource: string,
    runName: string,
    activityType: string,
    elapsedSeconds: number,
    distanceMiles: number,
    averagePace: string,
    heartRate: number,
    zoneLabel: string,
    zoneStatus: string,
    status: string,
    isPaused: boolean,
    metricLabel: string,
    metricValue: string,
    metricUnit: string,
    currentInterval: string,
    nextTransition: string,
    navigationInstruction: string,
    cueText: string,
    controlState: string,
    elevationDisplay: string,
    descentDisplay: string,
  ) => Promise<string | null>;
  update: (
    sessionId: string,
    sessionSource: string,
    elapsedSeconds: number,
    distanceMiles: number,
    averagePace: string,
    heartRate: number,
    zoneLabel: string,
    zoneStatus: string,
    status: string,
    isPaused: boolean,
    metricLabel: string,
    metricValue: string,
    metricUnit: string,
    currentInterval: string,
    nextTransition: string,
    navigationInstruction: string,
    cueText: string,
    controlState: string,
    elevationDisplay: string,
    descentDisplay: string,
  ) => Promise<void>;
  end: (
    sessionId: string,
    sessionSource: string,
    elapsedSeconds: number,
    distanceMiles: number,
    averagePace: string,
    heartRate: number,
    zoneLabel: string,
    zoneStatus: string,
    status: string,
    metricLabel: string,
    metricValue: string,
    metricUnit: string,
    currentInterval: string,
    nextTransition: string,
    navigationInstruction: string,
    cueText: string,
  ) => Promise<void>;
  startStrength: (
    sessionId: string,
    sessionSource: string,
    workoutName: string,
    elapsedSeconds: number,
    currentExercise: string,
    nextExercise: string,
    setsCompleted: number,
    totalSets: number,
    prescription: string,
    loadDisplay: string,
    progressLabel: string,
    controlState: string,
  ) => Promise<string | null>;
  updateStrength: (
    sessionId: string,
    sessionSource: string,
    elapsedSeconds: number,
    currentExercise: string,
    nextExercise: string,
    setsCompleted: number,
    totalSets: number,
    isPaused: boolean,
    prescription: string,
    loadDisplay: string,
    progressLabel: string,
    controlState: string,
  ) => Promise<void>;
  endStrength: (sessionId?: string, sessionSource?: string) => Promise<void>;
  getDiagnostics?: () => StrideLiveActivityDiagnostics;
  getRouteDirections?: (
    coordinates: { latitude: number; longitude: number }[],
    transport: 'walking' | 'cycling',
  ) => Promise<AppleRouteDirectionsResult | null>;
};

let cachedNativeModule: StrideLiveActivityModule | null | undefined;
let cachedEmitter: NativeEventEmitter | null | undefined;

function getNativeModule(): StrideLiveActivityModule | null {
  if (Platform.OS !== 'ios') return null;
  if (cachedNativeModule !== undefined) return cachedNativeModule;
  try {
    cachedNativeModule = requireNativeModule<StrideLiveActivityModule>('StrideLiveActivity');
  } catch {
    cachedNativeModule = null;
  }
  return cachedNativeModule;
}

function getEmitter(): NativeEventEmitter | null {
  if (Platform.OS !== 'ios') return null;
  if (cachedEmitter !== undefined) return cachedEmitter;
  try {
    const nativeMod = NativeModules['StrideLiveActivity'];
    if (!nativeMod) { cachedEmitter = null; return null; }
    cachedEmitter = new NativeEventEmitter(nativeMod);
  } catch {
    cachedEmitter = null;
  }
  return cachedEmitter;
}

export function isStrideRunLiveActivityAvailable(): boolean {
  const nativeModule = getNativeModule();
  if (!nativeModule) return false;
  try {
    return nativeModule.isAvailable();
  } catch {
    return false;
  }
}

export function getStrideLiveActivityDiagnostics(): StrideLiveActivityDiagnostics {
  const nativeModule = getNativeModule();
  if (!nativeModule?.getDiagnostics) {
    return {
      areActivitiesEnabled: isStrideRunLiveActivityAvailable(),
      activeRunActivityCount: 0,
      activeStrengthActivityCount: 0,
      appGroupIdentifier: 'group.com.mooremovement.strideos',
      lastStartResult: nativeModule ? 'diagnostics_unavailable' : 'native_module_unavailable',
    };
  }
  try {
    return nativeModule.getDiagnostics();
  } catch (error) {
    return {
      areActivitiesEnabled: false,
      activeRunActivityCount: 0,
      activeStrengthActivityCount: 0,
      appGroupIdentifier: 'group.com.mooremovement.strideos',
      lastRequestError: error instanceof Error ? error.message : 'Diagnostics failed',
    };
  }
}

export function getPendingRunControlCommand(): StrideRunControlCommand | null {
  const nativeModule = getNativeModule();
  if (!nativeModule?.getPendingRunControlCommand) return null;
  try {
    const command = nativeModule.getPendingRunControlCommand();
    if (
      command &&
      typeof command.id === 'string' &&
      VALID_CONTROL_ACTIONS.includes(command.action)
    ) {
      return command;
    }
  } catch {
    return null;
  }
  return null;
}

export function clearPendingRunControlCommand(id: string): void {
  const nativeModule = getNativeModule();
  if (!nativeModule?.clearPendingRunControlCommand) return;
  try {
    nativeModule.clearPendingRunControlCommand(id);
  } catch {
    // Command cleanup is best-effort. The JS run state remains the source of truth.
  }
}

export async function startStrideRunLiveActivity(payload: StrideRunLiveActivityPayload): Promise<string | null> {
  const nativeModule = getNativeModule();
  if (!nativeModule || !isStrideRunLiveActivityAvailable()) return null;
  return nativeModule.start(
    payload.workoutInstanceId ?? payload.sessionId ?? '',
    payload.sessionSource ?? 'running',
    payload.runName,
    payload.activityType ?? 'running',
    Math.max(0, Math.round(payload.elapsedSeconds)),
    Math.max(0, payload.distanceMiles),
    payload.averagePace,
    Math.max(0, Math.round(payload.heartRate || 0)),
    payload.zoneLabel,
    payload.zoneStatus,
    payload.status,
    payload.isPaused ?? false,
    payload.metricLabel ?? 'PACE',
    payload.metricValue ?? payload.averagePace,
    payload.metricUnit ?? '/mi',
    payload.currentInterval ?? '',
    payload.nextTransition ?? '',
    payload.navigationInstruction ?? '',
    payload.cueText ?? '',
    payload.controlState ?? 'ready',
    payload.elevationDisplay ?? '',
    payload.descentDisplay ?? '',
  );
}

export async function updateStrideRunLiveActivity(payload: StrideRunLiveActivityPayload): Promise<void> {
  const nativeModule = getNativeModule();
  if (!nativeModule || !isStrideRunLiveActivityAvailable()) return;
  await nativeModule.update(
    payload.workoutInstanceId ?? payload.sessionId ?? '',
    payload.sessionSource ?? 'running',
    Math.max(0, Math.round(payload.elapsedSeconds)),
    Math.max(0, payload.distanceMiles),
    payload.averagePace,
    Math.max(0, Math.round(payload.heartRate || 0)),
    payload.zoneLabel,
    payload.zoneStatus,
    payload.status,
    payload.isPaused ?? false,
    payload.metricLabel ?? 'PACE',
    payload.metricValue ?? payload.averagePace,
    payload.metricUnit ?? '/mi',
    payload.currentInterval ?? '',
    payload.nextTransition ?? '',
    payload.navigationInstruction ?? '',
    payload.cueText ?? '',
    payload.controlState ?? 'ready',
    payload.elevationDisplay ?? '',
    payload.descentDisplay ?? '',
  );
}

export async function endStrideRunLiveActivity(payload: StrideRunLiveActivityPayload): Promise<void> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return;
  await nativeModule.end(
    payload.workoutInstanceId ?? payload.sessionId ?? '',
    payload.sessionSource ?? 'running',
    Math.max(0, Math.round(payload.elapsedSeconds)),
    Math.max(0, payload.distanceMiles),
    payload.averagePace,
    Math.max(0, Math.round(payload.heartRate || 0)),
    payload.zoneLabel,
    payload.zoneStatus,
    payload.status,
    payload.metricLabel ?? 'PACE',
    payload.metricValue ?? payload.averagePace,
    payload.metricUnit ?? '/mi',
    payload.currentInterval ?? '',
    payload.nextTransition ?? '',
    payload.navigationInstruction ?? '',
    payload.cueText ?? '',
  );
}

export async function getAppleRouteDirections(
  coordinates: { latitude: number; longitude: number }[],
  transport: 'walking' | 'cycling',
): Promise<AppleRouteDirectionsResult | null> {
  const nativeModule = getNativeModule();
  if (!nativeModule?.getRouteDirections || coordinates.length < 2) return null;
  return nativeModule.getRouteDirections(coordinates, transport);
}

// Phase 2: Run lock screen intent listeners
export function addRunIntentListener(
  event: 'onPauseIntent' | 'onResumeIntent' | 'onStopIntent',
  listener: () => void,
) {
  const emitter = getEmitter();
  if (!emitter) return { remove: () => {} };
  return emitter.addListener(event, listener) as { remove: () => void };
}

// Phase 3: Strength Live Activity
export async function startStrengthLiveActivity(payload: StrideStrengthLiveActivityPayload): Promise<string | null> {
  const nativeModule = getNativeModule();
  if (!nativeModule || !isStrideRunLiveActivityAvailable()) return null;
  return nativeModule.startStrength(
    payload.workoutInstanceId ?? payload.sessionId ?? '',
    payload.sessionSource ?? 'training_block',
    payload.workoutName,
    Math.max(0, payload.elapsedSeconds),
    payload.currentExercise,
    payload.nextExercise,
    Math.max(0, payload.setsCompleted),
    Math.max(1, payload.totalSets),
    payload.prescription ?? '',
    payload.loadDisplay ?? '',
    payload.progressLabel ?? '',
    payload.controlState ?? 'ready',
  );
}

export async function updateStrengthLiveActivity(payload: StrideStrengthLiveActivityPayload): Promise<void> {
  const nativeModule = getNativeModule();
  if (!nativeModule || !isStrideRunLiveActivityAvailable()) return;
  await nativeModule.updateStrength(
    payload.workoutInstanceId ?? payload.sessionId ?? '',
    payload.sessionSource ?? 'training_block',
    Math.max(0, payload.elapsedSeconds),
    payload.currentExercise,
    payload.nextExercise,
    Math.max(0, payload.setsCompleted),
    Math.max(1, payload.totalSets),
    payload.isPaused ?? false,
    payload.prescription ?? '',
    payload.loadDisplay ?? '',
    payload.progressLabel ?? '',
    payload.controlState ?? 'ready',
  );
}

export async function endStrengthLiveActivity(payload?: Pick<StrideStrengthLiveActivityPayload, 'workoutInstanceId' | 'sessionId' | 'sessionSource'>): Promise<void> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return;
  await nativeModule.endStrength(
    payload?.workoutInstanceId ?? payload?.sessionId ?? '',
    payload?.sessionSource ?? 'training_block',
  );
}

// Phase 3: Strength lock screen intent listeners
export function addStrengthIntentListener(
  event: 'onPauseStrengthIntent' | 'onResumeStrengthIntent' | 'onMarkSetCompleteIntent',
  listener: () => void,
) {
  const emitter = getEmitter();
  if (!emitter) return { remove: () => {} };
  return emitter.addListener(event, listener) as { remove: () => void };
}
