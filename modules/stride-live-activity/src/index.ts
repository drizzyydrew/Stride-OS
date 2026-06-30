import { Platform } from 'react-native';
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
  ) => Promise<string | null>;
  update: (
    elapsedSeconds: number,
    distanceMiles: number,
    averagePace: string,
    heartRate: number,
    zoneLabel: string,
    zoneStatus: string,
    status: string,
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
};

let cachedNativeModule: StrideLiveActivityModule | null | undefined;

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
