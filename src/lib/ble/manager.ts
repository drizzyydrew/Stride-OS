export function isBleSupportedEnvironment(): boolean {
  return false;
}

export function getBleUnavailableReason(): string | null {
  return 'Bluetooth equipment pairing is available in the native app. Web keeps manual fallback available.';
}

export function getBleManager(): null {
  return null;
}

export function destroyBleManager(): void {
  // Web fallback: no native manager to destroy.
}
