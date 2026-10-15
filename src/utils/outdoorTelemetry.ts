import type { ActivityMetrics, CadenceSample, HeartRateSample, PowerSample } from '../types/activity';
import { summarizeHeartRate } from './indoorHeartRate';

export type OutdoorTelemetry = {
  rawHeartRateSamples: HeartRateSample[];
  cadenceSamples: CadenceSample[];
  powerSamples: PowerSample[];
};

export const EMPTY_OUTDOOR_TELEMETRY: OutdoorTelemetry = {
  rawHeartRateSamples: [], cadenceSamples: [], powerSamples: [],
};

export const LIVE_TELEMETRY_MAX_AGE_MS = 10_000;
const MAX_SAMPLES_PER_METRIC = 86_400;

export function selectLiveTelemetry(observed: OutdoorTelemetry, startedAt: number, now: number) {
  const fresh = <T extends { timestamp: number }>(values: T[]) => values.filter(value => isFreshObservation(value.timestamp, startedAt, now));
  const heartRateSample = fresh(observed.rawHeartRateSamples).sort((a, b) =>
    (a.source === 'heart_rate_monitor' ? 0 : a.source === 'apple_watch' ? 1 : 2)
    - (b.source === 'heart_rate_monitor' ? 0 : b.source === 'apple_watch' ? 1 : 2) || b.timestamp - a.timestamp)[0];
  const cadenceSample = fresh(observed.cadenceSamples).sort((a, b) =>
    (a.source === 'phone_motion' ? 2 : a.source === 'apple_watch' ? 1 : 0)
    - (b.source === 'phone_motion' ? 2 : b.source === 'apple_watch' ? 1 : 0) || b.timestamp - a.timestamp)[0];
  const rank = { measured: 0, device_estimated: 1, model_estimated: 2 };
  const powerSample = fresh(observed.powerSamples).sort((a, b) => rank[a.kind] - rank[b.kind] || b.timestamp - a.timestamp)[0];
  return { heartRateBpm: heartRateSample?.bpm ?? null, heartRateSample, cadenceSample, powerSample };
}

export function isFreshObservation(timestamp: number, startedAt: number, now: number, maxAgeMs = LIVE_TELEMETRY_MAX_AGE_MS): boolean {
  return Number.isFinite(timestamp) && timestamp >= startedAt && timestamp <= now
    && now - timestamp <= maxAgeMs;
}

function mergeSamples<T extends { timestamp: number; source: string }>(
  existing: T[], incoming: T[], valid: (sample: T) => boolean, startedAt: number, now: number,
): T[] {
  const next = new Map(existing.map(sample => [`${sample.timestamp}:${sample.source}`, sample]));
  for (const sample of incoming) {
    if (isFreshObservation(sample.timestamp, startedAt, now) && valid(sample)) {
      next.set(`${sample.timestamp}:${sample.source}`, sample);
    }
  }
  return [...next.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_SAMPLES_PER_METRIC);
}

export function appendTelemetrySamples(existing: OutdoorTelemetry, incoming: Partial<OutdoorTelemetry>, startedAt: number, now: number): OutdoorTelemetry {
  return {
    rawHeartRateSamples: mergeSamples(existing.rawHeartRateSamples, incoming.rawHeartRateSamples ?? [],
      sample => Number.isFinite(sample.bpm) && sample.bpm > 0, startedAt, now),
    cadenceSamples: mergeSamples(existing.cadenceSamples, incoming.cadenceSamples ?? [], sample => {
      const cadence = sample.kind === 'steps' ? sample.cadenceSpm : sample.cadenceRpm;
      return Number.isFinite(cadence) && cadence >= 0;
    }, startedAt, now),
    powerSamples: mergeSamples(existing.powerSamples, incoming.powerSamples ?? [],
      sample => Number.isFinite(sample.watts) && sample.watts >= 0
        && (sample.kind !== 'model_estimated' || Boolean(sample.modelVersion?.trim())), startedAt, now),
  };
}

export function outdoorTelemetryMetrics(state: OutdoorTelemetry & {
  startedAt: number | null;
  recordingPauses: { startTime: number; endTime: number }[];
  isPaused: boolean;
  pausedAt: number | null;
}, endedAt = Date.now()): Partial<ActivityMetrics> {
  const rawPauses = state.isPaused && state.pausedAt != null
    ? [...state.recordingPauses, { startTime: state.pausedAt, endTime: endedAt }] : state.recordingPauses;
  const recordingPauses: typeof rawPauses = [];
  for (const pause of rawPauses.filter(pause => Number.isFinite(pause.startTime) && Number.isFinite(pause.endTime))
    .map(pause => ({ startTime: Math.max(state.startedAt ?? -Infinity, pause.startTime), endTime: Math.min(endedAt, pause.endTime) }))
    .filter(pause => pause.endTime > pause.startTime).sort((a, b) => a.startTime - b.startTime)) {
    const previous = recordingPauses.at(-1);
    if (previous && pause.startTime <= previous.endTime) previous.endTime = Math.max(previous.endTime, pause.endTime);
    else recordingPauses.push(pause);
  }
  const activeMs = state.startedAt == null ? 0 : Math.max(0, endedAt - state.startedAt
    - recordingPauses.reduce((sum, pause) => sum + pause.endTime - pause.startTime, 0));
  // One source per scalar, no synthetic zero filling, no carry across a pause.
  function average(values: { timestamp: number; value: number; source: string }[], sourceRank: (source: string) => number) {
    const valid = values.filter(sample => state.startedAt != null && Number.isFinite(sample.timestamp)
      && sample.timestamp >= state.startedAt && sample.timestamp <= endedAt
      && Number.isFinite(sample.value) && sample.value >= 0
      && !recordingPauses.some(pause => sample.timestamp >= pause.startTime && sample.timestamp < pause.endTime));
    const source = valid.map(sample => sample.source).sort((a, b) => sourceRank(a) - sourceRank(b) || a.localeCompare(b))[0];
    const samples = valid.filter(sample => sample.source === source).sort((a, b) => a.timestamp - b.timestamp);
    let weighted = 0;
    let coverageMs = 0;
    samples.forEach((sample, index) => {
      const nextPause = recordingPauses.find(pause => pause.startTime >= sample.timestamp)?.startTime ?? Infinity;
      const duration = Math.max(0, Math.min(samples[index + 1]?.timestamp ?? endedAt,
        sample.timestamp + LIVE_TELEMETRY_MAX_AGE_MS, nextPause, endedAt) - sample.timestamp);
      weighted += duration * sample.value;
      coverageMs += duration;
    });
    return activeMs > 0 && coverageMs > 0 && coverageMs / activeMs >= 0.6 ? weighted / coverageMs : undefined;
  }
  const cadenceRank = (source: string) => source === 'phone_motion' ? 2 : source === 'apple_watch' ? 1 : 0;
  const cadenceSpm = average(state.cadenceSamples.filter(sample => sample.kind === 'steps')
    .map(sample => ({ ...sample, value: sample.cadenceSpm })), cadenceRank);
  const cadenceRpm = average(state.cadenceSamples.filter(sample => sample.kind === 'cycling')
    .map(sample => ({ ...sample, value: sample.cadenceRpm })), cadenceRank);
  function devicePower(sport: PowerSample['sport']) {
    const device = state.powerSamples.filter(sample => sample.sport === sport && sample.kind !== 'model_estimated');
    const kind = device.some(sample => sample.kind === 'measured') ? 'measured' : 'device_estimated';
    return average(device.filter(sample => sample.kind === kind).map(sample => ({ ...sample, value: sample.watts })),
      source => source === 'cycling_power_meter' ? 0 : source === 'apple_watch' ? 1 : 2);
  }
  const summary = state.startedAt == null ? undefined : summarizeHeartRate({
    samples: state.rawHeartRateSamples, startedAtMs: state.startedAt, endedAtMs: endedAt,
    pausedIntervals: recordingPauses,
  });
  return {
    rawHeartRateSamples: state.rawHeartRateSamples.length ? state.rawHeartRateSamples : undefined,
    cadenceSamples: state.cadenceSamples.length ? state.cadenceSamples : undefined,
    powerSamples: state.powerSamples.length ? state.powerSamples : undefined,
    recordingPauses: recordingPauses.length ? recordingPauses : undefined,
    heartRateSummary: summary,
    averageHeartRateBpm: summary?.averageHeartRateBpm,
    maximumHeartRateBpm: summary?.maximumHeartRateBpm,
    cadenceSpm,
    cadenceRpm,
    runningPowerWatts: devicePower('running'),
    cyclingPowerWatts: devicePower('cycling'),
  };
}
