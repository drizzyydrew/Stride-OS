export type AutoPauseActivity = 'running' | 'cycling';
export type AutoPauseMode = 'off' | 'running_only' | 'cycling_only' | 'running_and_cycling';
export type AutoPauseReason = 'gps_stationary' | 'motion_stationary' | 'telemetry_stationary';

export type AutoPauseSample = {
  atMs: number;
  speedMps?: number | null;
  displacementMeters?: number | null;
  horizontalAccuracyMeters?: number | null;
  motion?: 'stationary' | 'walking' | 'running' | 'cycling' | 'automotive' | 'unknown';
  cadenceRpm?: number | null;
  powerWatts?: number | null;
};

export type AutoPauseState = {
  activity: AutoPauseActivity;
  mode: AutoPauseMode;
  paused: boolean;
  manualPaused: boolean;
  candidateSinceMs: number | null;
  resumeCandidateSinceMs: number | null;
  stationarySamples: number;
  movingSamples: number;
  lastDecisionAtMs: number | null;
  lastReason?: AutoPauseReason;
};

export type AutoPauseDecision =
  | { action: 'none'; state: AutoPauseState }
  | { action: 'auto_pause'; state: AutoPauseState; reason: AutoPauseReason }
  | { action: 'auto_resume'; state: AutoPauseState };

const PARAMS = {
  running: {
    pauseSpeedMps: 0.45,
    resumeSpeedMps: 0.75,
    pauseWindowMs: 1_000,
    resumeWindowMs: 1_000,
    requiredSamples: 2,
    resumeSamples: 2,
    accuracyMaxMeters: 35,
    displacementMaxMeters: 3,
    cadenceResumeRpm: 55,
  },
  cycling: {
    pauseSpeedMps: 0.55,
    resumeSpeedMps: 1.3,
    pauseWindowMs: 2_000,
    resumeWindowMs: 2_000,
    requiredSamples: 2,
    resumeSamples: 2,
    accuracyMaxMeters: 45,
    displacementMaxMeters: 5,
    cadenceResumeRpm: 25,
  },
} as const;

export function initialAutoPauseState(activity: AutoPauseActivity, mode: AutoPauseMode): AutoPauseState {
  return {
    activity,
    mode,
    paused: false,
    manualPaused: false,
    candidateSinceMs: null,
    resumeCandidateSinceMs: null,
    stationarySamples: 0,
    movingSamples: 0,
    lastDecisionAtMs: null,
  };
}

export function isAutoPauseEnabled(mode: AutoPauseMode, activity: AutoPauseActivity): boolean {
  return mode === 'running_and_cycling'
    || (mode === 'running_only' && activity === 'running')
    || (mode === 'cycling_only' && activity === 'cycling');
}

export function reduceAutoPause(state: AutoPauseState, sample: AutoPauseSample): AutoPauseDecision {
  const params = PARAMS[state.activity];
  if (!isAutoPauseEnabled(state.mode, state.activity) || state.manualPaused) {
    return { action: 'none', state: resetCandidates(state) };
  }
  if ((sample.horizontalAccuracyMeters ?? 0) > params.accuracyMaxMeters) {
    return { action: 'none', state: resetCandidates(state) };
  }

  const speed = sample.speedMps;
  const lowSpeed = typeof speed === 'number' && speed >= 0 && speed <= params.pauseSpeedMps;
  const resumeSpeed = typeof speed === 'number' && speed >= params.resumeSpeedMps;
  const lowDisplacement = typeof sample.displacementMeters === 'number'
    ? sample.displacementMeters <= params.displacementMaxMeters
    : lowSpeed;
  const stationaryMotion = sample.motion === 'stationary' || sample.motion === 'unknown' || sample.motion == null;
  const movingMotion = sample.motion === state.activity || sample.motion === 'running' || sample.motion === 'walking';
  const cadenceMoving = typeof sample.cadenceRpm === 'number' && sample.cadenceRpm >= params.cadenceResumeRpm;
  const powerMoving = state.activity === 'cycling' && typeof sample.powerWatts === 'number' && sample.powerWatts > 35;

  if (!state.paused) {
    const stationary = lowSpeed && lowDisplacement && stationaryMotion && !cadenceMoving && !powerMoving;
    const candidateSinceMs = stationary ? state.candidateSinceMs ?? sample.atMs : null;
    const stationarySamples = stationary ? state.stationarySamples + 1 : 0;
    const next = { ...state, candidateSinceMs, stationarySamples, movingSamples: 0 };
    if (
      stationary &&
      candidateSinceMs != null &&
      stationarySamples >= params.requiredSamples &&
      sample.atMs - candidateSinceMs >= params.pauseWindowMs
    ) {
      return {
        action: 'auto_pause',
        reason: sample.motion === 'stationary' ? 'motion_stationary' : 'gps_stationary',
        state: {
          ...next,
          paused: true,
          candidateSinceMs: null,
          stationarySamples: 0,
          lastDecisionAtMs: sample.atMs,
          lastReason: sample.motion === 'stationary' ? 'motion_stationary' : 'gps_stationary',
        },
      };
    }
    return { action: 'none', state: next };
  }

  const moving = resumeSpeed || cadenceMoving || powerMoving || (movingMotion && !lowSpeed);
  const resumeCandidateSinceMs = moving ? state.resumeCandidateSinceMs ?? sample.atMs : null;
  const movingSamples = moving ? state.movingSamples + 1 : 0;
  const next = { ...state, resumeCandidateSinceMs, movingSamples, stationarySamples: 0 };
  if (
    moving &&
    resumeCandidateSinceMs != null &&
    movingSamples >= params.resumeSamples &&
    sample.atMs - resumeCandidateSinceMs >= params.resumeWindowMs
  ) {
    return {
      action: 'auto_resume',
      state: {
        ...next,
        paused: false,
        resumeCandidateSinceMs: null,
        movingSamples: 0,
        lastDecisionAtMs: sample.atMs,
      },
    };
  }
  return { action: 'none', state: next };
}

function resetCandidates(state: AutoPauseState): AutoPauseState {
  return {
    ...state,
    candidateSinceMs: null,
    resumeCandidateSinceMs: null,
    stationarySamples: 0,
    movingSamples: 0,
  };
}
