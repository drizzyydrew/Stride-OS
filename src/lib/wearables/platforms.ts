export type WearablePlatformId =
  | 'apple_watch'
  | 'polar_ble'
  | 'garmin_ble'
  | 'coros_ble'
  | 'garmin_connect_iq'
  | 'coros_cloud'
  | 'fitbit_google'
  | 'wear_os';

export type WearableIntegrationStatus =
  | 'ready_in_native_build'
  | 'works_if_device_broadcasts_ble'
  | 'needs_vendor_credentials'
  | 'needs_separate_watch_app';

export type WearablePlatformSupport = {
  id: WearablePlatformId;
  label: string;
  status: WearableIntegrationStatus;
  primaryPath: 'watchos' | 'bluetooth' | 'vendor_api' | 'wear_os_app';
  liveMetrics: string[];
  setupNeed: string;
};

export const WATCH_PLATFORM_SUPPORT: WearablePlatformSupport[] = [
  {
    id: 'apple_watch',
    label: 'Apple Watch',
    status: 'ready_in_native_build',
    primaryPath: 'watchos',
    liveMetrics: ['Heart rate', 'workout state'],
    setupNeed: 'Install the companion watch app from the iOS build and allow Health access on Apple Watch.',
  },
  {
    id: 'polar_ble',
    label: 'Bluetooth HR straps',
    status: 'works_if_device_broadcasts_ble',
    primaryPath: 'bluetooth',
    liveMetrics: ['Heart rate'],
    setupNeed: 'Wake the strap, keep other fitness apps disconnected, then connect from Gear.',
  },
  {
    id: 'garmin_ble',
    label: 'Garmin watch broadcast',
    status: 'works_if_device_broadcasts_ble',
    primaryPath: 'bluetooth',
    liveMetrics: ['Heart rate'],
    setupNeed: 'Enable wrist heart-rate broadcast on the watch, then connect from Gear.',
  },
  {
    id: 'coros_ble',
    label: 'COROS watch broadcast',
    status: 'works_if_device_broadcasts_ble',
    primaryPath: 'bluetooth',
    liveMetrics: ['Heart rate'],
    setupNeed: 'Use if that COROS model exposes standard Bluetooth heart-rate broadcast.',
  },
  {
    id: 'garmin_connect_iq',
    label: 'Garmin watch app',
    status: 'needs_separate_watch_app',
    primaryPath: 'vendor_api',
    liveMetrics: ['Watch app metrics'],
    setupNeed: 'Requires a Garmin Connect IQ app and Garmin developer review before StrideOS can run on the watch.',
  },
  {
    id: 'coros_cloud',
    label: 'COROS account sync',
    status: 'needs_vendor_credentials',
    primaryPath: 'vendor_api',
    liveMetrics: ['Completed activities'],
    setupNeed: 'Requires COROS API approval, OAuth credentials, redirect URI, and privacy policy review.',
  },
  {
    id: 'fitbit_google',
    label: 'Fitbit account sync',
    status: 'needs_vendor_credentials',
    primaryPath: 'vendor_api',
    liveMetrics: ['Completed activities', 'heart-rate history'],
    setupNeed: 'Requires Google/Fitbit API credentials and user OAuth consent.',
  },
  {
    id: 'wear_os',
    label: 'Pixel and Wear OS watches',
    status: 'needs_separate_watch_app',
    primaryPath: 'wear_os_app',
    liveMetrics: ['Health Services exercise metrics'],
    setupNeed: 'Requires an Android/Wear OS companion app using Health Services; not part of the iOS TestFlight build.',
  },
];

export function statusLabel(status: WearableIntegrationStatus): string {
  switch (status) {
  case 'ready_in_native_build': return 'Native build';
  case 'works_if_device_broadcasts_ble': return 'Bluetooth';
  case 'needs_vendor_credentials': return 'Needs vendor access';
  case 'needs_separate_watch_app': return 'Needs watch app';
  }
}

export function enabledForCurrentIOSShell(platform: WearablePlatformSupport): boolean {
  return platform.status === 'ready_in_native_build'
    || platform.status === 'works_if_device_broadcasts_ble';
}
