import { useEffect } from 'react';
import { Platform } from 'react-native';

import {
  activateStrideWatchConnectivity,
  addStrideWatchErrorListener,
  addStrideWatchHeartRateListener,
  addStrideWatchStatusListener,
  addStrideWatchWorkoutStateListener,
} from '../../../modules/stride-watch-connectivity/src';
import { useLiveSensorStore } from '../../store/liveSensorStore';

const APPLE_WATCH_DEVICE = {
  id: 'apple_watch',
  name: 'Apple Watch',
  serviceUUIDs: [],
  capabilities: ['heart_rate' as const],
  kind: 'other' as const,
};

export default function WatchWorkoutBridge() {
  const markDeviceConnected = useLiveSensorStore(s => s.markDeviceConnected);
  const markDeviceDisconnected = useLiveSensorStore(s => s.markDeviceDisconnected);
  const markDeviceError = useLiveSensorStore(s => s.markDeviceError);
  const recordBleReading = useLiveSensorStore(s => s.recordBleReading);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;

    const statusSub = addStrideWatchStatusListener(status => {
      if (!status.isPaired || !status.isWatchAppInstalled) {
        markDeviceDisconnected(APPLE_WATCH_DEVICE.id);
      }
    });

    const heartRateSub = addStrideWatchHeartRateListener(event => {
      markDeviceConnected(APPLE_WATCH_DEVICE, event.timestamp);
      recordBleReading({
        deviceId: APPLE_WATCH_DEVICE.id,
        deviceName: APPLE_WATCH_DEVICE.name,
        capability: 'heart_rate',
        metric: 'heartRate',
        value: event.heartRate,
        source: 'apple_watch',
        observedAt: event.timestamp,
      });
      if (event.distanceMeters != null && event.distanceMeters >= 0) {
        recordBleReading({
          deviceId: APPLE_WATCH_DEVICE.id,
          deviceName: APPLE_WATCH_DEVICE.name,
          capability: 'heart_rate',
          metric: 'distance',
          value: event.distanceMeters,
          source: 'apple_watch',
          observedAt: event.timestamp,
        });
      }
    });

    const workoutStateSub = addStrideWatchWorkoutStateListener(event => {
      if (event.state === 'ended' || event.state === 'idle') {
        markDeviceDisconnected(APPLE_WATCH_DEVICE.id, event.timestamp);
      } else {
        markDeviceConnected(APPLE_WATCH_DEVICE, event.timestamp);
      }
      if (event.heartRate != null && event.heartRate > 0) {
        recordBleReading({
          deviceId: APPLE_WATCH_DEVICE.id,
          deviceName: APPLE_WATCH_DEVICE.name,
          capability: 'heart_rate',
          metric: 'heartRate',
          value: event.heartRate,
          source: 'apple_watch',
          observedAt: event.timestamp,
        });
      }
      if (event.distanceMeters != null && event.distanceMeters >= 0) {
        recordBleReading({
          deviceId: APPLE_WATCH_DEVICE.id,
          deviceName: APPLE_WATCH_DEVICE.name,
          capability: 'heart_rate',
          metric: 'distance',
          value: event.distanceMeters,
          source: 'apple_watch',
          observedAt: event.timestamp,
        });
      }
    });

    const errorSub = addStrideWatchErrorListener(event => {
      markDeviceError(APPLE_WATCH_DEVICE.id, event.message, event.timestamp);
    });

    activateStrideWatchConnectivity().catch(() => undefined);

    return () => {
      statusSub?.remove();
      heartRateSub?.remove();
      workoutStateSub?.remove();
      errorSub?.remove();
    };
  }, [markDeviceConnected, markDeviceDisconnected, markDeviceError, recordBleReading]);

  return null;
}
