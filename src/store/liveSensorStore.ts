import { create } from 'zustand';

import {
  arbitrateDistance,
  arbitrateHeartRate,
  type ArbitedMetric,
  type BleMetricReading,
} from '../lib/ble/arbiter';
import type { BleEquipmentReading } from '../lib/ble/manager';
import type { BleDeviceSummary } from '../lib/ble/deviceClassifier';

const MAX_LIVE_READINGS = 120;

export type LiveSensorDevice = BleDeviceSummary & {
  connected: boolean;
  connectedAt: number;
  lastSeenAt: number;
  lastError?: string;
};

type LiveSensorStore = {
  devices: Record<string, LiveSensorDevice>;
  readings: BleEquipmentReading[];
  markDeviceConnected: (device: BleDeviceSummary, at?: number) => void;
  markDeviceDisconnected: (deviceId: string, at?: number) => void;
  markDeviceError: (deviceId: string, message: string, at?: number) => void;
  recordBleReading: (reading: BleEquipmentReading) => void;
  clearDeviceReadings: (deviceId: string) => void;
  clearAllLiveSensors: () => void;
};

export const useLiveSensorStore = create<LiveSensorStore>()((set) => ({
  devices: {},
  readings: [],

  markDeviceConnected: (device, at = Date.now()) => set(state => ({
    devices: {
      ...state.devices,
      [device.id]: {
        ...device,
        connected: true,
        connectedAt: state.devices[device.id]?.connectedAt ?? at,
        lastSeenAt: at,
        lastError: undefined,
      },
    },
  })),

  markDeviceDisconnected: (deviceId, at = Date.now()) => set(state => {
    const existing = state.devices[deviceId];
    if (!existing) return state;
    return {
      devices: {
        ...state.devices,
        [deviceId]: { ...existing, connected: false, lastSeenAt: at },
      },
      readings: state.readings.filter(reading => reading.deviceId !== deviceId),
    };
  }),

  markDeviceError: (deviceId, message, at = Date.now()) => set(state => {
    const existing = state.devices[deviceId];
    if (!existing) return state;
    return {
      devices: {
        ...state.devices,
        [deviceId]: { ...existing, lastSeenAt: at, lastError: message },
      },
    };
  }),

  recordBleReading: (reading) => set(state => ({
    devices: state.devices[reading.deviceId]
      ? {
        ...state.devices,
        [reading.deviceId]: {
          ...state.devices[reading.deviceId],
          lastSeenAt: reading.observedAt,
          lastError: undefined,
        },
      }
      : state.devices,
    readings: [...state.readings.filter(item =>
      !(item.deviceId === reading.deviceId && item.metric === reading.metric && item.capability === reading.capability),
    ), reading].slice(-MAX_LIVE_READINGS),
  })),

  clearDeviceReadings: deviceId => set(state => ({
    readings: state.readings.filter(reading => reading.deviceId !== deviceId),
  })),

  clearAllLiveSensors: () => set({ devices: {}, readings: [] }),
}));

export function selectLiveHeartRate(
  readings: readonly BleMetricReading[],
  now = Date.now(),
): ArbitedMetric {
  return arbitrateHeartRate(readings, now);
}

export function selectLiveDistance(
  readings: readonly BleMetricReading[],
  now = Date.now(),
): ArbitedMetric {
  return arbitrateDistance(readings, now);
}

export function selectLatestLiveMetric(
  readings: readonly BleMetricReading[],
  metric: BleMetricReading['metric'],
  now = Date.now(),
  staleAfterMs = 5000,
): ArbitedMetric {
  const best = readings
    .filter(item => item.metric === metric && Number.isFinite(item.value))
    .filter(item => now - item.observedAt <= staleAfterMs)
    .sort((a, b) => b.observedAt - a.observedAt)[0];
  return best
    ? { value: best.value, source: best.source, stale: false }
    : { value: null, source: null, stale: true, reason: `no_current_${metric}_source` };
}
