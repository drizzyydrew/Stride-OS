import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type StrideWatchStatus = {
  isSupported: boolean;
  isPaired: boolean;
  isWatchAppInstalled: boolean;
  isReachable: boolean;
  activationState: 'activated' | 'inactive' | 'notActivated' | 'unsupported' | 'unknown' | string;
  lastMessageAt: number;
  lastError?: string | null;
};

export type StrideWatchWorkoutKind = 'run' | 'strength' | 'mobility' | 'cycling';

export type StrideWatchHeartRateEvent = {
  type: 'heartRate';
  heartRate: number;
  workoutKind?: StrideWatchWorkoutKind | string;
  workoutInstanceId?: string;
  environment?: string;
  elapsedSeconds?: number;
  distanceMeters?: number;
  activeEnergyKilocalories?: number;
  heartRateZone?: string;
  timestamp: number;
  source?: 'apple_watch';
};

export type StrideWatchWorkoutStateEvent = {
  type: 'workoutState';
  state: 'running' | 'paused' | 'ended' | 'idle' | 'prepared' | string;
  workoutKind?: StrideWatchWorkoutKind | string;
  workoutInstanceId?: string;
  environment?: string;
  elapsedSeconds?: number;
  distanceMeters?: number;
  activeEnergyKilocalories?: number;
  heartRate?: number;
  heartRateZone?: string;
  pendingSyncCount?: number;
  queued?: boolean;
  timestamp: number;
  source?: 'apple_watch';
};

export type StrideWatchErrorEvent = {
  type: 'error';
  message: string;
  timestamp: number;
};

type Subscription = { remove: () => void };

type StrideWatchConnectivityNativeModule = {
  isSupported: () => boolean;
  snapshot: () => StrideWatchStatus;
  activate: () => Promise<StrideWatchStatus>;
  startRun: (
    workoutInstanceId?: string | null,
    title?: string | null,
    environment?: string | null,
    targetZone?: number | null,
  ) => Promise<StrideWatchStatus>;
  startWorkout: (
    workoutKind?: string | null,
    workoutInstanceId?: string | null,
    title?: string | null,
    environment?: string | null,
    targetZone?: number | null,
  ) => Promise<StrideWatchStatus>;
  pauseRun: () => Promise<StrideWatchStatus>;
  pauseWorkout: () => Promise<StrideWatchStatus>;
  resumeRun: () => Promise<StrideWatchStatus>;
  resumeWorkout: () => Promise<StrideWatchStatus>;
  endRun: () => Promise<StrideWatchStatus>;
  endWorkout: () => Promise<StrideWatchStatus>;
  setWorkoutContext: (
    unitSystem?: 'imperial' | 'metric' | string | null,
    maxHeartRateBpm?: number | null,
    targetZone?: number | null,
  ) => Promise<StrideWatchStatus>;
};

const FALLBACK_STATUS: StrideWatchStatus = {
  isSupported: false,
  isPaired: false,
  isWatchAppInstalled: false,
  isReachable: false,
  activationState: 'unsupported',
  lastMessageAt: 0,
  lastError: null,
};

let cachedNativeModule: StrideWatchConnectivityNativeModule | null | undefined;
let cachedEmitter: NativeEventEmitter | null | undefined;

function getNativeModule(): StrideWatchConnectivityNativeModule | null {
  if (Platform.OS !== 'ios') return null;
  if (cachedNativeModule !== undefined) return cachedNativeModule;
  try {
    cachedNativeModule = requireNativeModule<StrideWatchConnectivityNativeModule>('StrideWatchConnectivity');
  } catch {
    cachedNativeModule = null;
  }
  return cachedNativeModule;
}

function getEmitter(): NativeEventEmitter | null {
  if (Platform.OS !== 'ios') return null;
  if (cachedEmitter !== undefined) return cachedEmitter;
  try {
    const nativeModule = NativeModules['StrideWatchConnectivity'];
    cachedEmitter = nativeModule ? new NativeEventEmitter(nativeModule) : null;
  } catch {
    cachedEmitter = null;
  }
  return cachedEmitter;
}

export function isStrideWatchConnectivityAvailable(): boolean {
  const nativeModule = getNativeModule();
  if (!nativeModule) return false;
  try {
    return nativeModule.isSupported();
  } catch {
    return false;
  }
}

export function getStrideWatchStatus(): StrideWatchStatus {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(nativeModule.snapshot());
  } catch {
    return FALLBACK_STATUS;
  }
}

export async function activateStrideWatchConnectivity(): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.activate());
  } catch {
    return FALLBACK_STATUS;
  }
}

export async function startStrideWatchRun(options: {
  workoutInstanceId?: string | null;
  title?: string | null;
  environment?: 'outdoor' | 'indoor' | string | null;
  targetZone?: number | null;
} = {}): Promise<StrideWatchStatus> {
  return startStrideWatchWorkout({ ...options, workoutKind: 'run' });
}

export async function startStrideWatchWorkout(options: {
  workoutKind?: StrideWatchWorkoutKind | string | null;
  workoutInstanceId?: string | null;
  title?: string | null;
  environment?: 'outdoor' | 'indoor' | string | null;
  targetZone?: number | null;
} = {}): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.startWorkout(
      options.workoutKind ?? 'run',
      options.workoutInstanceId ?? null,
      options.title ?? null,
      options.environment ?? null,
      options.targetZone ?? null,
    ));
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export async function pauseStrideWatchRun(): Promise<StrideWatchStatus> {
  return pauseStrideWatchWorkout();
}

export async function pauseStrideWatchWorkout(): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.pauseWorkout());
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export async function resumeStrideWatchRun(): Promise<StrideWatchStatus> {
  return resumeStrideWatchWorkout();
}

export async function resumeStrideWatchWorkout(): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.resumeWorkout());
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export async function endStrideWatchRun(): Promise<StrideWatchStatus> {
  return endStrideWatchWorkout();
}

export async function endStrideWatchWorkout(): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.endWorkout());
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export async function setStrideWatchWorkoutContext(options: {
  unitSystem?: 'imperial' | 'metric' | string | null;
  maxHeartRateBpm?: number | null;
  targetZone?: number | null;
} = {}): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.setWorkoutContext(
      options.unitSystem ?? null,
      options.maxHeartRateBpm ?? null,
      options.targetZone ?? null,
    ));
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export function addStrideWatchHeartRateListener(
  listener: (event: StrideWatchHeartRateEvent) => void,
): Subscription | null {
  return getEmitter()?.addListener('onWatchHeartRate', event => {
    const heartRate = Number(event?.heartRate);
    if (!Number.isFinite(heartRate) || heartRate <= 0) return;
    listener({
      type: 'heartRate',
      heartRate,
      workoutKind: typeof event?.workoutKind === 'string' ? event.workoutKind : undefined,
      workoutInstanceId: typeof event?.workoutInstanceId === 'string' ? event.workoutInstanceId : undefined,
      environment: typeof event?.environment === 'string' ? event.environment : undefined,
      elapsedSeconds: Number.isFinite(Number(event?.elapsedSeconds)) ? Number(event.elapsedSeconds) : undefined,
      distanceMeters: Number.isFinite(Number(event?.distanceMeters)) ? Number(event.distanceMeters) : undefined,
      activeEnergyKilocalories: Number.isFinite(Number(event?.activeEnergyKilocalories)) ? Number(event.activeEnergyKilocalories) : undefined,
      heartRateZone: typeof event?.heartRateZone === 'string' ? event.heartRateZone : undefined,
      timestamp: Number.isFinite(Number(event?.timestamp)) ? Number(event.timestamp) : Date.now(),
      source: 'apple_watch',
    });
  }) ?? null;
}

export function addStrideWatchStatusListener(
  listener: (status: StrideWatchStatus) => void,
): Subscription | null {
  return getEmitter()?.addListener('onWatchStatus', event => {
    listener(normalizeStatus(event));
  }) ?? null;
}

export function addStrideWatchWorkoutStateListener(
  listener: (event: StrideWatchWorkoutStateEvent) => void,
): Subscription | null {
  return getEmitter()?.addListener('onWatchWorkoutState', event => {
    listener({
      type: 'workoutState',
      state: typeof event?.state === 'string' ? event.state : 'unknown',
      workoutKind: typeof event?.workoutKind === 'string' ? event.workoutKind : undefined,
      workoutInstanceId: typeof event?.workoutInstanceId === 'string' ? event.workoutInstanceId : undefined,
      environment: typeof event?.environment === 'string' ? event.environment : undefined,
      elapsedSeconds: Number.isFinite(Number(event?.elapsedSeconds)) ? Number(event.elapsedSeconds) : undefined,
      distanceMeters: Number.isFinite(Number(event?.distanceMeters)) ? Number(event.distanceMeters) : undefined,
      activeEnergyKilocalories: Number.isFinite(Number(event?.activeEnergyKilocalories)) ? Number(event.activeEnergyKilocalories) : undefined,
      heartRate: Number.isFinite(Number(event?.heartRate)) ? Number(event.heartRate) : undefined,
      heartRateZone: typeof event?.heartRateZone === 'string' ? event.heartRateZone : undefined,
      pendingSyncCount: Number.isFinite(Number(event?.pendingSyncCount)) ? Number(event.pendingSyncCount) : undefined,
      queued: Boolean(event?.queued),
      timestamp: Number.isFinite(Number(event?.timestamp)) ? Number(event.timestamp) : Date.now(),
      source: 'apple_watch',
    });
  }) ?? null;
}

export function addStrideWatchErrorListener(
  listener: (event: StrideWatchErrorEvent) => void,
): Subscription | null {
  return getEmitter()?.addListener('onWatchError', event => {
    listener({
      type: 'error',
      message: typeof event?.message === 'string' ? event.message : 'Apple Watch connection error.',
      timestamp: Number.isFinite(Number(event?.timestamp)) ? Number(event.timestamp) : Date.now(),
    });
  }) ?? null;
}

function normalizeStatus(input: Partial<StrideWatchStatus> | null | undefined): StrideWatchStatus {
  return {
    isSupported: Boolean(input?.isSupported),
    isPaired: Boolean(input?.isPaired),
    isWatchAppInstalled: Boolean(input?.isWatchAppInstalled),
    isReachable: Boolean(input?.isReachable),
    activationState: input?.activationState ?? 'unknown',
    lastMessageAt: Number.isFinite(Number(input?.lastMessageAt)) ? Number(input?.lastMessageAt) : 0,
    lastError: typeof input?.lastError === 'string' ? input.lastError : null,
  };
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Apple Watch command failed.';
}
