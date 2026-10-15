import { useEffect, useRef, useState } from 'react';
import {
  addPhoneCadenceListener, addStrideWatchHeartRateListener, addStrideWatchTelemetryListener,
  startPhoneCadence, stopPhoneCadence,
} from '../../modules/stride-watch-connectivity/src';
import { getLatestHeartRateSample } from '../lib/healthKit';
import { useLiveSensorStore } from '../store/liveSensorStore';
import type { ActivityType, CadenceSample, HeartRateSample, PowerSample } from '../types/activity';
import {
  appendTelemetrySamples, EMPTY_OUTDOOR_TELEMETRY, selectLiveTelemetry,
  type OutdoorTelemetry,
} from '../utils/outdoorTelemetry';

type Input = {
  workoutInstanceId: string | null;
  startedAt: number | null;
  activityType: ActivityType;
  isActive: boolean;
  isPaused: boolean;
  healthKitEnabled: boolean;
  onSamples?: (id: string, samples: Partial<OutdoorTelemetry>) => void;
};

type LiveTelemetry = {
  heartRateBpm: number | null;
  heartRateSample?: HeartRateSample;
  cadenceSample?: CadenceSample;
  powerSample?: PowerSample;
};

/** Parent can mount this hook in Run without introducing another completion writer. */
export function useOutdoorTelemetry(input: Input): LiveTelemetry {
  const onSamples = useRef(input.onSamples);
  onSamples.current = input.onSamples;
  const [live, setLive] = useState<LiveTelemetry>({ heartRateBpm: null });

  useEffect(() => {
    const { workoutInstanceId: id, startedAt, activityType, isActive, isPaused, healthKitEnabled } = input;
    setLive({ heartRateBpm: null });
    if (!id || !startedAt || !isActive || isPaused) return;
    let cancelled = false;
    let polling = false;
    let observed: OutdoorTelemetry = EMPTY_OUTDOOR_TELEMETRY;
    const steps = activityType === 'running' || activityType === 'walking' || activityType === 'hiking';
    const cycling = activityType === 'cycling';
    const liveFrom = Date.now();

    const publish = () => {
      if (cancelled) return;
      setLive(selectLiveTelemetry(observed, liveFrom, Date.now()));
    };
    const ingest = (samples: Partial<OutdoorTelemetry>) => {
      if (cancelled) return;
      const valid = appendTelemetrySamples(EMPTY_OUTDOOR_TELEMETRY, samples, liveFrom, Date.now());
      if (!valid.rawHeartRateSamples.length && !valid.cadenceSamples.length && !valid.powerSamples.length) return;
      observed = appendTelemetrySamples(observed, valid, startedAt, Date.now());
      onSamples.current?.(id, valid);
      publish();
    };

    const hrSub = addStrideWatchHeartRateListener(event => {
      if (event.workoutInstanceId !== id) return;
      ingest({ rawHeartRateSamples: [{ timestamp: event.timestamp, bpm: event.heartRate, source: 'apple_watch' }] });
    });
    const watchSub = addStrideWatchTelemetryListener(event => {
      if (event.workoutInstanceId !== id) return;
      if (steps && event.cadenceSpm != null) ingest({ cadenceSamples: [{ kind: 'steps', timestamp: event.timestamp, cadenceSpm: event.cadenceSpm, source: 'apple_watch' }] });
      if (cycling && event.cadenceRpm != null) ingest({ cadenceSamples: [{ kind: 'cycling', timestamp: event.timestamp, cadenceRpm: event.cadenceRpm, source: 'apple_watch' }] });
      if (cycling && event.powerSport === 'cycling' && event.powerKind === 'measured' && event.powerWatts != null) {
        ingest({ powerSamples: [{ sport: 'cycling', timestamp: event.timestamp, watts: event.powerWatts, source: 'apple_watch', kind: 'measured' }] });
      }
      if (activityType === 'running' && event.powerSport === 'running' && event.powerKind === 'device_estimated' && event.powerWatts != null) {
        ingest({ powerSamples: [{ sport: 'running', timestamp: event.timestamp, watts: event.powerWatts, source: 'apple_watch', kind: 'device_estimated' }] });
      }
    });
    const cadenceSub = steps ? addPhoneCadenceListener(event => {
      if (event.workoutInstanceId === id) ingest({ cadenceSamples: [{ kind: 'steps', timestamp: event.timestamp, cadenceSpm: event.cadenceSpm, source: 'phone_motion' }] });
    }) : null;
    if (steps) void startPhoneCadence(id);

    const seen = new Map<string, number>();
    const sensorSub = useLiveSensorStore.subscribe(state => {
      for (const reading of state.readings) {
        if (!state.devices[reading.deviceId]?.connected || reading.source === 'apple_watch') continue;
        const key = `${reading.deviceId}:${reading.metric}:${reading.capability}`;
        if ((seen.get(key) ?? 0) >= reading.observedAt) continue;
        seen.set(key, reading.observedAt);
        if (reading.metric === 'heartRate' && reading.source === 'ble_hr') {
          ingest({ rawHeartRateSamples: [{ timestamp: reading.observedAt, bpm: reading.value, source: 'heart_rate_monitor' }] });
        } else if (steps && reading.metric === 'cadence' && reading.capability === 'running_speed_cadence' && reading.source === 'foot_pod') {
          ingest({ cadenceSamples: [{ kind: 'steps', timestamp: reading.observedAt, cadenceSpm: reading.value, source: 'foot_pod' }] });
        } else if (cycling && reading.metric === 'cadence' && reading.capability === 'cycling_speed_cadence') {
          ingest({ cadenceSamples: [{ kind: 'cycling', timestamp: reading.observedAt, cadenceRpm: reading.value, source: 'cycling_cadence_sensor' }] });
        } else if (cycling && reading.metric === 'power' && reading.capability === 'cycling_power' && reading.source === 'power_meter') {
          ingest({ powerSamples: [{ sport: 'cycling', timestamp: reading.observedAt, watts: reading.value, source: 'cycling_power_meter', kind: 'measured' }] });
        }
      }
    });
    async function pollHealthKit() {
      if (!healthKitEnabled || polling) return;
      polling = true;
      try {
        // Keep source observation time; never relabel a ten-minute-old BPM as live.
        const sample = await getLatestHeartRateSample(10 / 60);
        if (sample) ingest({ rawHeartRateSamples: [{ timestamp: sample.sampledAt, bpm: sample.bpm, source: 'healthkit' }] });
      } finally { polling = false; }
    }
    void pollHealthKit();
    const hrTimer = setInterval(() => void pollHealthKit(), 5_000);
    const timer = setInterval(publish, 1_000);
    return () => {
      cancelled = true;
      clearInterval(hrTimer);
      clearInterval(timer);
      hrSub?.remove(); watchSub?.remove(); cadenceSub?.remove(); sensorSub();
      if (steps) stopPhoneCadence(id);
    };
  }, [input.workoutInstanceId, input.startedAt, input.activityType, input.isActive, input.isPaused, input.healthKitEnabled]);

  return input.isActive && !input.isPaused ? live : { heartRateBpm: null };
}
