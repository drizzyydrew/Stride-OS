import { Platform } from 'react-native';

type BleManagerCtor = new () => {
  destroy: () => void;
  startDeviceScan: (...args: unknown[]) => void;
  stopDeviceScan: () => void;
};

let manager: InstanceType<BleManagerCtor> | null = null;

export function isBleSupportedEnvironment(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function getBleUnavailableReason(): string | null {
  return isBleSupportedEnvironment() ? null : 'Bluetooth equipment pairing is unavailable on this platform.';
}

export function getBleManager(): InstanceType<BleManagerCtor> | null {
  if (!isBleSupportedEnvironment()) return null;
  if (manager) return manager;
  try {
    // Dynamic require keeps unsupported native runtimes from crashing before
    // the BLE module is linked. Device validation remains required.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-ble-plx') as { BleManager: BleManagerCtor };
    manager = new mod.BleManager();
    return manager;
  } catch {
    return null;
  }
}

export function destroyBleManager(): void {
  manager?.destroy();
  manager = null;
}
