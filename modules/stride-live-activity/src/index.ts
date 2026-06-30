import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type StrideRunLiveActivityPayload = {
  runName: string;
  elapsedSeconds: number;
  distanceMiles: number;
  averagePace: string;
  heartRate: number;
  zoneLabel: string;
  zoneStatus: 'in' | 'near' | 'out' | 'unknown' | string;
  status: 'Running' | 'Paused' | 'Finished' | string;
  isPaused?: boolean;
};

export type StrideStrengthLiveActivityPayload = {
  workoutName: string;
  elapsedSeconds: number;
  currentExercise: string;
  nextExercise: string;
  setsCompleted: number;
  totalSets: number;
  isPaused?: boolean;
};

type StrideLiveActivityModule = {
  isAvailable: () => boolean;
  start: (
    runName: string,
    elapsedSeconds: number,
    distanceMiles: number,
    averagePace: string,
    heartRate: number,
    zoneLabel: string,
    zoneStatus: string,
    status: string,
    isPaused: boolean,
  ) => Promise<string | null>;
  update: (
    elapsedSeconds: number,
    distanceMiles: number,
    averagePace: string,
    heartRate: number,
    zoneLabel: string,
    zoneStatus: string,
    status: string,
    isPaused: boolean,
  ) => Promise<void>;
  end: (
    elapsedSeconds: number,
    distanceMiles: number,
    averagePace: string,
    heartRate: number,
    zoneLabel: string,
    zoneStatus: string,
    status: string,
  ) => Promise<void>;
  startStrength: (
    workoutName: string,
    elapsedSeconds: number,
    currentExercise: string,
    nextExercise: string,
    setsCompleted: number,
    totalSets: number,
  ) => Promise<string | null>;
  updateStrength: (
    elapsedSeconds: number,
    currentExercise: string,
    nextExercise: string,
    setsCompleted: number,
    totalSets: number,
    isPaused: boolean,
  ) => Promise<void>;
  endStrength: () => Promise<void>;
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

export async function startStrideRunLiveActivity(payload: StrideRunLiveActivityPayload): Promise<string | null> {
  const nativeModule = getNativeModule();
  if (!nativeModule || !isStrideRunLiveActivityAvailable()) return null;
  return nativeModule.start(
    payload.runName,
    Math.max(0, Math.round(payload.elapsedSeconds)),
    Math.max(0, payload.distanceMiles),
    payload.averagePace,
    Math.max(0, Math.round(payload.heartRate || 0)),
    payload.zoneLabel,
    payload.zoneStatus,
    payload.status,
    payload.isPaused ?? false,
  );
}

export async function updateStrideRunLiveActivity(payload: StrideRunLiveActivityPayload): Promise<void> {
  const nativeModule = getNativeModule();
  if (!nativeModule || !isStrideRunLiveActivityAvailable()) return;
  await nativeModule.update(
    Math.max(0, Math.round(payload.elapsedSeconds)),
    Math.max(0, payload.distanceMiles),
    payload.averagePace,
    Math.max(0, Math.round(payload.heartRate || 0)),
    payload.zoneLabel,
    payload.zoneStatus,
    payload.status,
    payload.isPaused ?? false,
  );
}

export async function endStrideRunLiveActivity(payload: StrideRunLiveActivityPayload): Promise<void> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return;
  await nativeModule.end(
    Math.max(0, Math.round(payload.elapsedSeconds)),
    Math.max(0, payload.distanceMiles),
    payload.averagePace,
    Math.max(0, Math.round(payload.heartRate || 0)),
    payload.zoneLabel,
    payload.zoneStatus,
    payload.status,
  );
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
    payload.workoutName,
    Math.max(0, payload.elapsedSeconds),
    payload.currentExercise,
    payload.nextExercise,
    Math.max(0, payload.setsCompleted),
    Math.max(1, payload.totalSets),
  );
}

export async function updateStrengthLiveActivity(payload: StrideStrengthLiveActivityPayload): Promise<void> {
  const nativeModule = getNativeModule();
  if (!nativeModule || !isStrideRunLiveActivityAvailable()) return;
  await nativeModule.updateStrength(
    Math.max(0, payload.elapsedSeconds),
    payload.currentExercise,
    payload.nextExercise,
    Math.max(0, payload.setsCompleted),
    Math.max(1, payload.totalSets),
    payload.isPaused ?? false,
  );
}

export async function endStrengthLiveActivity(): Promise<void> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return;
  await nativeModule.endStrength();
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
