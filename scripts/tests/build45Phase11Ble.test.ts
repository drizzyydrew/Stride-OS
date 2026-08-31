import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { arbitrateDistance, arbitrateHeartRate, rejectFabricatedCyclingDistance } from '../../src/lib/ble/arbiter';
import { base64ToBytes } from '../../src/lib/ble/codec';
import { capabilityLabel, classifyBleEquipment } from '../../src/lib/ble/deviceClassifier';
import { cscDelta, parseCscMeasurement } from '../../src/lib/ble/profiles/csc';
import { parseFtmsIndoorBikeData, parseFtmsTreadmillData } from '../../src/lib/ble/profiles/ftms';
import { parseHeartRateMeasurement } from '../../src/lib/ble/profiles/heartRate';
import { parseCyclingPowerMeasurement } from '../../src/lib/ble/profiles/power';
import { parseRscMeasurement } from '../../src/lib/ble/profiles/rsc';
import { getBleManager, getBleUnavailableReason } from '../../src/lib/ble/manager';
import { enabledForCurrentIOSShell, statusLabel, WATCH_PLATFORM_SUPPORT } from '../../src/lib/wearables/platforms';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('BLE heart-rate parser handles 8-bit and 16-bit measurements', () => {
  assert.equal(parseHeartRateMeasurement([0x00, 150])?.bpm, 150);
  assert.equal(parseHeartRateMeasurement([0x01, 0x2c, 0x01])?.bpm, 300);
  assert.equal(parseHeartRateMeasurement([0x00, 0])?.bpm, undefined);
  assert.deepEqual(base64ToBytes('AJY='), [0x00, 150]);
});

test('BLE equipment classifier maps standard fitness services to app equipment kinds', () => {
  const hr = classifyBleEquipment({ id: 'hr-1', name: 'Polar H10', serviceUUIDs: ['180D'] });
  const treadmill = classifyBleEquipment({ id: 'tm-1', name: 'Home Treadmill', serviceUUIDs: ['00001826-0000-1000-8000-00805F9B34FB'] });
  const footPod = classifyBleEquipment({ id: 'fp-1', name: 'Stryd Footpod', serviceUUIDs: ['1814'] });
  const power = classifyBleEquipment({ id: 'pm-1', name: 'Power Meter', serviceUUIDs: ['1818'] });

  assert.equal(hr.kind, 'hr_strap');
  assert.equal(treadmill.kind, 'treadmill');
  assert.equal(footPod.kind, 'foot_pod');
  assert.equal(power.kind, 'power_meter');
  assert.equal(capabilityLabel(hr.capabilities[0]!), 'Heart rate');
});

test('FTMS treadmill and indoor bike parsers preserve measured distance source fields', () => {
  const treadmill = parseFtmsTreadmillData([0x04, 0x00, 0xe8, 0x03, 0xd2, 0x04, 0x00]);
  const bike = parseFtmsIndoorBikeData([0x46, 0x00, 0xc4, 0x09, 0xb4, 0x00, 0x88, 0x13, 0x00, 0xdc, 0x00]);

  assert.equal(treadmill?.speedKph, 10);
  assert.equal(treadmill?.distanceMeters, 1234);
  assert.equal(bike?.speedKph, 25);
  assert.equal(bike?.cadenceRpm, 90);
  assert.equal(bike?.distanceMeters, 5000);
  assert.equal(bike?.powerWatts, 220);
});

test('RSC, CSC, and power parsers handle distance, cadence, rollover, and power without HR leakage', () => {
  const rsc = parseRscMeasurement([0x03, 0x00, 0x03, 180, 100, 0, 0xd2, 0x04, 0x00, 0x00]);
  const previousCsc = parseCscMeasurement([0x03, 0xfe, 0xff, 0xff, 0xff, 0x00, 0x04, 0xfe, 0xff, 0x00, 0x04]);
  const currentCsc = parseCscMeasurement([0x03, 0x02, 0x00, 0x00, 0x00, 0x00, 0x08, 0x08, 0x00, 0x00, 0x08]);
  const power = parseCyclingPowerMeasurement([0x00, 0x00, 0xfa, 0x00]);

  assert.equal(rsc?.speedMetersPerSecond, 3);
  assert.equal(rsc?.cadenceStepsPerMinute, 180);
  assert.equal(rsc?.strideLengthMeters, 1);
  assert.equal(rsc?.distanceMeters, 123.4);
  assert.ok((cscDelta(previousCsc!, currentCsc!, 2.1).distanceMeters ?? 0) > 6);
  assert.ok((cscDelta(previousCsc!, currentCsc!, 2.1).cadenceRpm ?? 0) > 0);
  assert.equal(power?.powerWatts, 250);
});

test('BLE arbitration prioritizes measured distance, marks stale gaps, and refuses fabricated cycling distance', () => {
  const now = 100_000;
  const distance = arbitrateDistance([
    { metric: 'distance', value: 1000, source: 'manual', observedAt: now },
    { metric: 'distance', value: 1200, source: 'foot_pod', observedAt: now },
    { metric: 'distance', value: 900, source: 'confirmed_speed_estimate', observedAt: now },
  ], now);
  const stale = arbitrateDistance([
    { metric: 'distance', value: 1200, source: 'ftms_trainer', observedAt: now - 10_000 },
  ], now);
  const hr = arbitrateHeartRate([
    { metric: 'heartRate', value: 151, source: 'apple_watch', observedAt: now },
    { metric: 'heartRate', value: 144, source: 'ble_hr', observedAt: now },
  ], now);
  const watchHr = arbitrateHeartRate([
    { metric: 'heartRate', value: 151, source: 'apple_watch', observedAt: now },
  ], now);

  assert.equal(distance.value, 1200);
  assert.equal(distance.distanceSource, 'foot_pod');
  assert.equal(stale.stale, true);
  assert.equal(hr.value, 144);
  assert.equal(watchHr.value, 151);
  assert.equal(watchHr.source, 'apple_watch');
  assert.equal(rejectFabricatedCyclingDistance([
    { metric: 'heartRate', value: 144, source: 'ble_hr', observedAt: now },
    { metric: 'power', value: 250, source: 'power_meter', observedAt: now },
  ]), true);
});

test('Phase 11 source contracts configure BLE safely and preserve web fallback', () => {
  const packageJson = read('package.json');
  const appJson = read('app.json');
  const nativeManager = read('src/lib/ble/manager.native.ts');
  const webManager = read('src/lib/ble/manager.ts');
  const gear = read('app/(tabs)/more/gear.tsx');
  const activeRun = read('app/(tabs)/training/index.tsx');
  const watchConfig = read('targets/StrideOSWatch/expo-target.config.js');
  const watchInfoPlist = read('targets/StrideOSWatch/Info.plist');
  const watchIconContents = read('targets/StrideOSWatch/Assets.xcassets/AppIcon.appiconset/Contents.json');
  const watchManager = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const watchModule = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');

  assert.match(packageJson, /react-native-ble-plx/);
  assert.match(packageJson, /stride-watch-connectivity/);
  assert.match(appJson, /bluetoothAlwaysPermission/);
  assert.match(appJson, /"isBackgroundEnabled": false/);
  assert.match(nativeManager, /require\('react-native-ble-plx'\)/);
  assert.match(nativeManager, /startBleEquipmentScan/);
  assert.match(nativeManager, /connectToBleEquipment/);
  assert.match(nativeManager, /monitorCharacteristicForService/);
  assert.doesNotMatch(webManager, /react-native-ble-plx/);
  assert.equal(getBleManager(), null);
  assert.match(getBleUnavailableReason() ?? '', /native app/);
  assert.match(gear, /Scan for Bluetooth Equipment|manual fallback/i);
  assert.match(gear, /connectToBleEquipment/);
  assert.match(gear, /WATCH_PLATFORM_SUPPORT/);
  assert.match(activeRun, /startStrideWatchRun/);
  assert.match(activeRun, /Apple Watch live/);
  assert.match(watchConfig, /type: 'watch'/);
  assert.match(watchConfig, /icon: '\.\.\/\.\.\/assets\/images\/icon\.png'/);
  assert.match(watchConfig, /HealthKit/);
  assert.match(watchInfoPlist, /CFBundleIconName/);
  assert.match(watchInfoPlist, /CFBundleIconFiles/);
  assert.match(watchIconContents, /App-Icon-1024x1024@1x\.png/);
  assert.match(watchManager, /HKWorkoutSession/);
  assert.match(watchManager, /HKLiveWorkoutBuilder/);
  assert.match(watchModule, /WatchConnectivity/);
});

test('wearable support matrix distinguishes shippable BLE/watchOS from vendor-specific app work', () => {
  const apple = WATCH_PLATFORM_SUPPORT.find(platform => platform.id === 'apple_watch');
  const polar = WATCH_PLATFORM_SUPPORT.find(platform => platform.id === 'polar_ble');
  const garminApp = WATCH_PLATFORM_SUPPORT.find(platform => platform.id === 'garmin_connect_iq');
  const wearOs = WATCH_PLATFORM_SUPPORT.find(platform => platform.id === 'wear_os');

  assert.equal(apple?.status, 'ready_in_native_build');
  assert.equal(apple && enabledForCurrentIOSShell(apple), true);
  assert.equal(polar?.status, 'works_if_device_broadcasts_ble');
  assert.equal(polar && enabledForCurrentIOSShell(polar), true);
  assert.equal(garminApp?.status, 'needs_separate_watch_app');
  assert.equal(wearOs?.primaryPath, 'wear_os_app');
  assert.equal(statusLabel('needs_vendor_credentials'), 'Needs vendor access');
});
