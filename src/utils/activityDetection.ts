import type { AutoPauseSample } from './autoPause';

export type ActivityDetectionMode = 'off' | 'suggest_running' | 'suggest_cycling' | 'suggest_running_and_cycling';
export type ActivityDetectionKind = 'running' | 'cycling';

export type DetectionState = {
  mode: ActivityDetectionMode;
  candidate: ActivityDetectionKind | null;
  candidateSinceMs: number | null;
  sampleCount: number;
  lastSuggestionAtMs: number | null;
};

export type DetectionDecision =
  | { action: 'none'; state: DetectionState }
  | { action: 'suggest'; state: DetectionState; kind: ActivityDetectionKind; title: string; body: string };

const COOLDOWN_MS = 45 * 60_000;
const REQUIRED_MS = 8 * 60_000;
const REQUIRED_SAMPLES = 8;

export function initialDetectionState(mode: ActivityDetectionMode): DetectionState {
  return { mode, candidate: null, candidateSinceMs: null, sampleCount: 0, lastSuggestionAtMs: null };
}

export function reduceActivityDetection(state: DetectionState, sample: AutoPauseSample): DetectionDecision {
  if (state.mode === 'off') return { action: 'none', state: clearCandidate(state) };
  if (state.lastSuggestionAtMs && sample.atMs - state.lastSuggestionAtMs < COOLDOWN_MS) {
    return { action: 'none', state: clearCandidate(state) };
  }
  const kind = classifySample(state.mode, sample);
  if (!kind) return { action: 'none', state: clearCandidate(state) };

  const sameCandidate = state.candidate === kind;
  const candidateSinceMs = sameCandidate ? state.candidateSinceMs ?? sample.atMs : sample.atMs;
  const sampleCount = sameCandidate ? state.sampleCount + 1 : 1;
  const next = { ...state, candidate: kind, candidateSinceMs, sampleCount };
  if (sampleCount >= REQUIRED_SAMPLES && sample.atMs - candidateSinceMs >= REQUIRED_MS) {
    return {
      action: 'suggest',
      kind,
      title: kind === 'running' ? 'Running detected' : 'Cycling detected',
      body: kind === 'running' ? 'Start tracking with StrideOS?' : 'Start an outdoor ride?',
      state: { ...clearCandidate(next), lastSuggestionAtMs: sample.atMs },
    };
  }
  return { action: 'none', state: next };
}

function classifySample(mode: ActivityDetectionMode, sample: AutoPauseSample): ActivityDetectionKind | null {
  if ((sample.horizontalAccuracyMeters ?? 0) > 45) return null;
  const speed = sample.speedMps ?? 0;
  const runningAllowed = mode === 'suggest_running' || mode === 'suggest_running_and_cycling';
  const cyclingAllowed = mode === 'suggest_cycling' || mode === 'suggest_running_and_cycling';
  if (
    runningAllowed &&
    speed >= 1.8 &&
    speed <= 5.8 &&
    (sample.motion === 'running' || (sample.cadenceRpm ?? 0) >= 140)
  ) return 'running';
  if (
    cyclingAllowed &&
    speed >= 4.0 &&
    speed <= 16.0 &&
    (sample.motion === 'cycling' || (sample.powerWatts ?? 0) > 40)
  ) return 'cycling';
  return null;
}

function clearCandidate(state: DetectionState): DetectionState {
  return { ...state, candidate: null, candidateSinceMs: null, sampleCount: 0 };
}
