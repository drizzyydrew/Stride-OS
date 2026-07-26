// ─── Indoor heart-rate sampling ─────────────────────────────────────────────
//
// Samples are timestamped at capture and held only for the active ride. The
// summary is time-weighted across observed intervals; it never fills missing
// spans with a made-up BPM. Poor coverage leaves the average explicitly
// unavailable while retaining source/gap metadata for honest display.

import type { HeartRateSummary, HeartRateZoneSeconds } from '../types/activity';

export type IndoorHeartRateSample = {
  timestamp: number;
  bpm: number;
  source: 'healthkit';
};

export const MAX_INDOOR_HR_SAMPLES = 720;
export const MAX_HR_SAMPLE_GAP_SECONDS = 30;
export const MIN_HR_COVERAGE_RATIO = 0.6;

export type HeartRateZoneRange = {
  zone: 1 | 2 | 3 | 4 | 5;
  minBPM?: number | null;
  maxBPM?: number | null;
};

function validSample(sample: IndoorHeartRateSample): boolean {
  return Number.isFinite(sample.timestamp)
    && Number.isFinite(sample.bpm)
    && sample.bpm > 0;
}

export function appendIndoorHeartRateSample(
  samples: IndoorHeartRateSample[],
  sample: IndoorHeartRateSample | null,
  maxSamples = MAX_INDOOR_HR_SAMPLES,
): IndoorHeartRateSample[] {
  if (!sample || !validSample(sample)) return samples;
  const prior = samples[samples.length - 1];
  // The poll can return the same latest HealthKit observation more than once.
  if (prior && prior.timestamp === sample.timestamp && prior.bpm === sample.bpm) return samples;
  const next = [...samples, sample].sort((a, b) => a.timestamp - b.timestamp);
  return next.slice(Math.max(0, next.length - Math.max(1, maxSamples)));
}

function zoneForBpm(bpm: number, zones: HeartRateZoneRange[]): 1 | 2 | 3 | 4 | 5 | null {
  return zones.find(zone =>
    (zone.minBPM == null || bpm >= zone.minBPM)
    && (zone.maxBPM == null || bpm <= zone.maxBPM),
  )?.zone ?? null;
}

export function summarizeIndoorHeartRate(input: {
  samples: IndoorHeartRateSample[];
  startedAtMs: number;
  endedAtMs: number;
  zones?: HeartRateZoneRange[];
  maxGapSeconds?: number;
  minimumCoverageRatio?: number;
}): HeartRateSummary | undefined {
  const sessionSeconds = Math.max(0, Math.round((input.endedAtMs - input.startedAtMs) / 1000));
  const samples = input.samples
    .filter(validSample)
    .filter(sample => sample.timestamp >= input.startedAtMs && sample.timestamp <= input.endedAtMs)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (samples.length === 0) return undefined;

  const maxGapSeconds = input.maxGapSeconds ?? MAX_HR_SAMPLE_GAP_SECONDS;
  const intervalCapMs = Math.max(1, maxGapSeconds) * 1000;
  let weightedBpmSeconds = 0;
  let coverageSeconds = 0;
  let largestGapSeconds = 0;
  const zoneSeconds: HeartRateZoneSeconds = {};

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]!;
    const nextBoundary = Math.min(input.endedAtMs, samples[index + 1]?.timestamp ?? input.endedAtMs);
    const rawGapMs = Math.max(0, nextBoundary - sample.timestamp);
    largestGapSeconds = Math.max(largestGapSeconds, Math.round(rawGapMs / 1000));
    const observedMs = Math.min(rawGapMs, intervalCapMs);
    const observedSeconds = observedMs / 1000;
    if (observedSeconds <= 0) continue;
    coverageSeconds += observedSeconds;
    weightedBpmSeconds += sample.bpm * observedSeconds;
    const zone = zoneForBpm(sample.bpm, input.zones ?? []);
    if (zone) zoneSeconds[zone] = (zoneSeconds[zone] ?? 0) + observedSeconds;
  }

  const roundedCoverage = Math.round(coverageSeconds);
  const coverageRatio = sessionSeconds > 0 ? Math.min(1, coverageSeconds / sessionSeconds) : 0;
  const averageReliable = coverageSeconds > 0 && coverageRatio >= (input.minimumCoverageRatio ?? MIN_HR_COVERAGE_RATIO);
  const max = Math.max(...samples.map(sample => sample.bpm));
  return {
    source: 'healthkit',
    sampleCount: samples.length,
    coverageSeconds: roundedCoverage,
    sessionSeconds,
    coverageRatio: Math.round(coverageRatio * 1000) / 1000,
    largestGapSeconds,
    averageReliable,
    averageHeartRateBpm: averageReliable ? Math.round(weightedBpmSeconds / coverageSeconds) : undefined,
    maximumHeartRateBpm: max,
    zoneSeconds: Object.keys(zoneSeconds).length
      ? Object.fromEntries(Object.entries(zoneSeconds).map(([zone, seconds]) => [zone, Math.round(seconds)])) as HeartRateZoneSeconds
      : undefined,
  };
}
