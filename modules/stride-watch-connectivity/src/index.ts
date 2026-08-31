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

export type StrideWatchHeartRateEvent = {
  type: 'heartRate';
  heartRate: number;
  workoutInstanceId?: string;
  elapsedSeconds?: number;
  timestamp: number;
  source?: 'apple_watch';
};

export type StrideWatchWorkoutStateEvent = {
  type: 'workoutState';
  state: 'running' | 'paused' | 'ended' | 'idle' | 'prepared' | string;
  workoutInstanceId?: string;
  elapsedSeconds?: number;
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
  pauseRun: () => Promise<StrideWatchStatus>;
  resumeRun: () => Promise<StrideWatchStatus>;
  endRun: () => Promise<StrideWatchStatus>;
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
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.startRun(
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
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.pauseRun());
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export async function resumeStrideWatchRun(): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.resumeRun());
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export async function endStrideWatchRun(): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.endRun());
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
      workoutInstanceId: typeof event?.workoutInstanceId === 'string' ? event.workoutInstanceId : undefined,
      elapsedSeconds: Number.isFinite(Number(event?.elapsedSeconds)) ? Number(event.elapsedSeconds) : undefined,
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
      workoutInstanceId: typeof event?.workoutInstanceId === 'string' ? event.workoutInstanceId : undefined,
      elapsedSeconds: Number.isFinite(Number(event?.elapsedSeconds)) ? Number(event.elapsedSeconds) : undefined,
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
