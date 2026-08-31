import type { BleMetricReading } from './arbiter';
import type { BleDeviceSummary } from './deviceClassifier';

export type BleScanHandle = {
  stop: () => void;
};

export type BleEquipmentReading = BleMetricReading & {
  deviceId: string;
  deviceName: string;
  capability: 'heart_rate' | 'running_speed_cadence' | 'cycling_speed_cadence' | 'cycling_power' | 'fitness_machine';
};

export type BleConnectionHandle = {
  device: BleDeviceSummary;
  disconnect: () => Promise<void>;
};

export type BleConnectOptions = {
  wheelCircumferenceMeters?: number;
  onReading?: (reading: BleEquipmentReading) => void;
  onDisconnect?: (deviceId: string) => void;
  onError?: (message: string) => void;
};

export function isBleSupportedEnvironment(): boolean {
  return false;
}

export function getBleUnavailableReason(): string | null {
  return 'Bluetooth equipment pairing is available in the native app. Web keeps manual fallback available.';
}

export function getBleManager(): null {
  return null;
}

export async function startBleEquipmentScan(
  _onDevice: (device: BleDeviceSummary) => void,
  onError?: (message: string) => void,
): Promise<BleScanHandle | null> {
  onError?.(getBleUnavailableReason() ?? 'Bluetooth is unavailable on this platform.');
  return null;
}

export async function connectToBleEquipment(
  _scannedDevice: BleDeviceSummary,
  _options: BleConnectOptions = {},
): Promise<BleConnectionHandle> {
  throw new Error(getBleUnavailableReason() ?? 'Bluetooth is unavailable on this platform.');
}

export async function disconnectBleEquipment(_deviceId: string): Promise<void> {
  // Web fallback: no native connection to disconnect.
}

export function getConnectedBleEquipment(): BleDeviceSummary[] {
  return [];
}

export function destroyBleManager(): void {
  // Web fallback: no native manager to destroy.
}
