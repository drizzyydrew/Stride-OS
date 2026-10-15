import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type StrideWatchStatus = {
  isSupported: boolean;
  isPaired: boolean;
  isWatchAppInstalled: boolean;
  isReachable: boolean;
  activationState: 'activated' | 'inactive' | 'notActivated' | 'unsupported' | 'unknown' | string;
  lastMessageAt: number;
  lastError?: string | null;
  // Runtime diagnostics (phone side).
  lastCommandType?: string | null;
  lastCommandAt?: number;
  lastCommandMethod?: 'sendMessage' | 'transferUserInfo' | 'queued' | 'none' | string | null;
  lastAckAt?: number;
  lastAckCommand?: string | null;
  lastAckAccepted?: boolean | null;
  lastAckReason?: string | null;
  lastWatchStateAt?: number;
  lastWatchState?: string | null;
  supportedWorkoutKinds?: string[];
};

export type StrideWatchAckEvent = {
  type: 'commandAck';
  command: string;
  accepted: boolean;
  reason?: string;
  workoutInstanceId?: string;
  healthKitState?: string;
  timestamp: number;
};

export type StrideWatchWorkoutKind = 'run' | 'strength' | 'mobility' | 'cycling'
  | 'walking' | 'hiking' | 'downhill_skiing' | 'cross_country_skiing'
  | 'snowboarding' | 'ski_touring' | 'snowboard_touring';

export type StrideWatchTelemetryEvent = {
  workoutInstanceId: string;
  workoutKind?: string;
  timestamp: number;
  cadenceSpm?: number;
  cadenceRpm?: number;
  powerWatts?: number;
  powerKind?: 'device_estimated' | 'measured';
  powerSport?: 'running' | 'cycling';
};

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
  heartRateTimestamp?: number;
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

type StrideWatchEventName = 'onWatchStatus' | 'onWatchHeartRate' | 'onWatchWorkoutState' | 'onWatchError' | 'onWatchAck' | 'onWatchTelemetry' | 'onPhoneCadence';

type StrideWatchConnectivityNativeModule = {
  // Expo modules are their own event emitters. They are NOT registered in
  // react-native's legacy native-module registry, so an emitter built from that
  // registry is null and never receives events.
  addListener: (eventName: StrideWatchEventName, listener: (event: any) => void) => Subscription;
  isSupported: () => boolean;
  startPhoneCadence?: (workoutInstanceId: string) => Promise<boolean>;
  stopPhoneCadence?: (workoutInstanceId: string) => void;
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
  pauseRun: (workoutInstanceId?: string | null) => Promise<StrideWatchStatus>;
  pauseWorkout: (workoutInstanceId?: string | null) => Promise<StrideWatchStatus>;
  resumeRun: (workoutInstanceId?: string | null) => Promise<StrideWatchStatus>;
  resumeWorkout: (workoutInstanceId?: string | null) => Promise<StrideWatchStatus>;
  endRun: (workoutInstanceId?: string | null) => Promise<StrideWatchStatus>;
  endWorkout: (workoutInstanceId?: string | null) => Promise<StrideWatchStatus>;
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

function subscribe(eventName: StrideWatchEventName, listener: (event: any) => void): Subscription | null {
  const nativeModule = getNativeModule();
  if (!nativeModule || typeof nativeModule.addListener !== 'function') return null;
  try {
    return nativeModule.addListener(eventName, listener);
  } catch {
    return null;
  }
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

export async function pauseStrideWatchRun(workoutInstanceId?: string | null): Promise<StrideWatchStatus> {
  return pauseStrideWatchWorkout(workoutInstanceId);
}

export async function pauseStrideWatchWorkout(workoutInstanceId?: string | null): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.pauseWorkout(workoutInstanceId ?? null));
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export async function resumeStrideWatchRun(workoutInstanceId?: string | null): Promise<StrideWatchStatus> {
  return resumeStrideWatchWorkout(workoutInstanceId);
}

export async function resumeStrideWatchWorkout(workoutInstanceId?: string | null): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.resumeWorkout(workoutInstanceId ?? null));
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

export async function endStrideWatchRun(workoutInstanceId?: string | null): Promise<StrideWatchStatus> {
  return endStrideWatchWorkout(workoutInstanceId);
}

export async function endStrideWatchWorkout(workoutInstanceId?: string | null): Promise<StrideWatchStatus> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return FALLBACK_STATUS;
  try {
    return normalizeStatus(await nativeModule.endWorkout(workoutInstanceId ?? null));
  } catch (error) {
    return { ...getStrideWatchStatus(), lastError: messageFromError(error) };
  }
}

/** Exact-ID recovery path deliberately propagates delivery failures for retry. */
export async function endStrideWatchWorkoutIfMatching(workoutInstanceId: string): Promise<void> {
  if (!workoutInstanceId) throw new Error('Watch cleanup requires a recording ID');
  const nativeModule = getNativeModule();
  if (!nativeModule) return;
  const status = getStrideWatchStatus();
  if (!status.isPaired || !status.isWatchAppInstalled) return;
  await nativeModule.endWorkout(workoutInstanceId);
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
  return subscribe('onWatchHeartRate', event => {
    const heartRate = Number(event?.heartRate);
    if (!Number.isFinite(heartRate) || heartRate <= 0 || !Number.isFinite(event?.timestamp)) return;
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
  });
}

export function addStrideWatchStatusListener(
  listener: (status: StrideWatchStatus) => void,
): Subscription | null {
  return subscribe('onWatchStatus', event => {
    listener(normalizeStatus(event));
  });
}

export function addStrideWatchWorkoutStateListener(
  listener: (event: StrideWatchWorkoutStateEvent) => void,
): Subscription | null {
  return subscribe('onWatchWorkoutState', event => {
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
      heartRateTimestamp: typeof event?.heartRateTimestamp === 'number' && Number.isFinite(event.heartRateTimestamp) ? event.heartRateTimestamp : undefined,
      heartRateZone: typeof event?.heartRateZone === 'string' ? event.heartRateZone : undefined,
      pendingSyncCount: Number.isFinite(Number(event?.pendingSyncCount)) ? Number(event.pendingSyncCount) : undefined,
      queued: Boolean(event?.queued),
      timestamp: Number.isFinite(Number(event?.timestamp)) ? Number(event.timestamp) : Date.now(),
      source: 'apple_watch',
    });
  });
}

export function addStrideWatchTelemetryListener(listener: (event: StrideWatchTelemetryEvent) => void): Subscription | null {
  return subscribe('onWatchTelemetry', event => {
    if (typeof event?.workoutInstanceId !== 'string' || !Number.isFinite(event?.timestamp)) return;
    listener({
      workoutInstanceId: event.workoutInstanceId,
      workoutKind: typeof event.workoutKind === 'string' ? event.workoutKind : undefined,
      timestamp: event.timestamp,
      cadenceSpm: typeof event.cadenceSpm === 'number' && Number.isFinite(event.cadenceSpm) ? event.cadenceSpm : undefined,
      cadenceRpm: typeof event.cadenceRpm === 'number' && Number.isFinite(event.cadenceRpm) ? event.cadenceRpm : undefined,
      powerWatts: typeof event.powerWatts === 'number' && Number.isFinite(event.powerWatts) ? event.powerWatts : undefined,
      powerKind: event.powerKind === 'device_estimated' || event.powerKind === 'measured' ? event.powerKind : undefined,
      powerSport: event.powerSport === 'running' || event.powerSport === 'cycling' ? event.powerSport : undefined,
    });
  });
}

export function addPhoneCadenceListener(listener: (event: { workoutInstanceId: string; timestamp: number; cadenceSpm: number }) => void): Subscription | null {
  return subscribe('onPhoneCadence', event => {
    if (typeof event?.workoutInstanceId !== 'string' || !Number.isFinite(event?.timestamp)
      || typeof event?.cadenceSpm !== 'number' || !Number.isFinite(event.cadenceSpm) || event.cadenceSpm < 0) return;
    listener(event);
  });
}

export async function startPhoneCadence(workoutInstanceId: string): Promise<boolean> {
  try { return await getNativeModule()?.startPhoneCadence?.(workoutInstanceId) ?? false; } catch { return false; }
}

export function stopPhoneCadence(workoutInstanceId: string): void {
  try { getNativeModule()?.stopPhoneCadence?.(workoutInstanceId); } catch { /* Optional sensor. */ }
}

export function addStrideWatchErrorListener(
  listener: (event: StrideWatchErrorEvent) => void,
): Subscription | null {
  return subscribe('onWatchError', event => {
    listener({
      type: 'error',
      message: typeof event?.message === 'string' ? event.message : 'Apple Watch connection error.',
      timestamp: Number.isFinite(Number(event?.timestamp)) ? Number(event.timestamp) : Date.now(),
    });
  });
}

export function addStrideWatchAckListener(
  listener: (event: StrideWatchAckEvent) => void,
): Subscription | null {
  return subscribe('onWatchAck', event => {
    listener({
      type: 'commandAck',
      command: typeof event?.command === 'string' ? event.command : 'unknown',
      accepted: Boolean(event?.accepted),
      reason: typeof event?.reason === 'string' ? event.reason : undefined,
      workoutInstanceId: typeof event?.workoutInstanceId === 'string' ? event.workoutInstanceId : undefined,
      healthKitState: typeof event?.healthKitState === 'string' ? event.healthKitState : undefined,
      timestamp: Number.isFinite(Number(event?.timestamp)) ? Number(event.timestamp) : Date.now(),
    });
  });
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
    lastCommandType: typeof input?.lastCommandType === 'string' ? input.lastCommandType : null,
    lastCommandAt: finiteOrZero(input?.lastCommandAt),
    lastCommandMethod: typeof input?.lastCommandMethod === 'string' ? input.lastCommandMethod : null,
    lastAckAt: finiteOrZero(input?.lastAckAt),
    lastAckCommand: typeof input?.lastAckCommand === 'string' ? input.lastAckCommand : null,
    lastAckAccepted: typeof input?.lastAckAccepted === 'boolean' ? input.lastAckAccepted : null,
    lastAckReason: typeof input?.lastAckReason === 'string' ? input.lastAckReason : null,
    lastWatchStateAt: finiteOrZero(input?.lastWatchStateAt),
    lastWatchState: typeof input?.lastWatchState === 'string' ? input.lastWatchState : null,
    supportedWorkoutKinds: Array.isArray(input?.supportedWorkoutKinds) ? input.supportedWorkoutKinds.filter(kind => typeof kind === 'string') : [],
  };
}

function finiteOrZero(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Apple Watch command failed.';
}
