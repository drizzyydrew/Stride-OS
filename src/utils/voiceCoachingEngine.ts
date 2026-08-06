const KM_PER_MILE = 1.609344;

export type DistanceSplitVoiceState = {
  // Distance-update boundary count already announced this run. With a half-mile
  // interval, 1 = 0.5 mi, 2 = 1.0 mi, and so on.
  lastSplitIndex: number;
  // Moving-time (seconds) at the moment the last boundary was crossed, used to
  // compute the pace of the next split/update segment.
  lastSplitElapsedSec: number;
};

export const DEFAULT_DISTANCE_SPLIT_STATE: DistanceSplitVoiceState = {
  lastSplitIndex: 0,
  lastSplitElapsedSec: 0,
};

// Speech-friendly pace: "8 minutes 30 seconds" (expo-speech reads this
// naturally, unlike "8:30" which some voices render as a clock time).
function speakablePace(secPerUnit: number): string | null {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0) return null;
  const total = Math.round(secPerUnit);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const minutes = m > 0 ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '';
  const seconds = s > 0 ? `${s} ${s === 1 ? 'second' : 'seconds'}` : '';
  return [minutes, seconds].filter(Boolean).join(' ') || null;
}

function speakableDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  if (h === 0 && s > 0) parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ') || null;
}

function formatDistanceLabel(distanceUnits: number, unitWord: string): string {
  const rounded = Number.isInteger(distanceUnits)
    ? String(distanceUnits)
    : distanceUnits.toFixed(1).replace(/\.0$/, '');
  if (distanceUnits === 0.5) return `Half ${unitWord}`;
  const plural = distanceUnits === 1 ? unitWord : `${unitWord}s`;
  return `${rounded} ${plural}`;
}

// Emits one cue each time the configured mile/kilometer boundary is crossed,
// announcing distance, segment split pace, average pace, and elapsed moving time.
// Pure/stateful-by-value so it can run inside the run store's location reducer —
// which means split updates fire regardless of which run UI is mounted and from
// the background GPS task.
export function evaluateDistanceSplitCue(input: {
  state: DistanceSplitVoiceState;
  distanceMiles: number;
  elapsedMovingSec: number;
  units: 'imperial' | 'metric';
  interval: 'half' | 'one';
}): { state: DistanceSplitVoiceState; text?: string } {
  const { state, units } = input;
  if (!Number.isFinite(input.distanceMiles) || input.distanceMiles < 0) return { state };
  const distanceUnits = units === 'metric'
    ? input.distanceMiles * KM_PER_MILE
    : input.distanceMiles;
  const intervalUnits = input.interval === 'half' ? 0.5 : 1;
  const currentIndex = Math.floor((distanceUnits + 1e-9) / intervalUnits);
  if (!Number.isFinite(currentIndex) || currentIndex <= state.lastSplitIndex) {
    return { state };
  }

  const previousBoundary = state.lastSplitIndex * intervalUnits;
  const currentBoundary = currentIndex * intervalUnits;
  const unitsCovered = currentBoundary - previousBoundary;
  const splitElapsed = input.elapsedMovingSec - state.lastSplitElapsedSec;
  const splitPaceSecPerUnit = unitsCovered > 0 && splitElapsed > 0
    ? splitElapsed / unitsCovered
    : 0;
  const averagePaceSecPerUnit = currentBoundary > 0 && input.elapsedMovingSec > 0
    ? input.elapsedMovingSec / currentBoundary
    : 0;
  const unitWord = units === 'metric' ? 'kilometer' : 'mile';
  const label = formatDistanceLabel(currentBoundary, unitWord);
  const paceText = speakablePace(splitPaceSecPerUnit);
  const averageText = speakablePace(averagePaceSecPerUnit);
  const elapsedText = speakableDuration(input.elapsedMovingSec);
  const metrics = [
    paceText ? `Split ${paceText} per ${unitWord}` : null,
    averageText ? `average ${averageText} per ${unitWord}` : null,
    elapsedText ? `${elapsedText} elapsed` : null,
  ].filter(Boolean);
  const text = metrics.length ? `${label}. ${metrics.join(', ')}.` : `${label}.`;

  return {
    state: { lastSplitIndex: currentIndex, lastSplitElapsedSec: input.elapsedMovingSec },
    text,
  };
}

export type HeartRateZoneSample = 'below' | 'in' | 'above' | 'unknown';

export type HeartRateVoiceState = {
  previousZone: HeartRateZoneSample;
  consecutiveOutOfRangeSamples: number;
  lastCueElapsedSeconds: number;
};

export type HeartRateVoiceCue = {
  state: HeartRateVoiceState;
  text?: string;
};

export const DEFAULT_HEART_RATE_VOICE_STATE: HeartRateVoiceState = {
  previousZone: 'unknown',
  consecutiveOutOfRangeSamples: 0,
  lastCueElapsedSeconds: -Number.POSITIVE_INFINITY,
};

export function evaluateHeartRateVoiceCue(input: {
  state: HeartRateVoiceState;
  zone: HeartRateZoneSample;
  elapsedSeconds: number;
  samplesRequired?: number;
  cooldownSeconds?: number;
}): HeartRateVoiceCue {
  const samplesRequired = input.samplesRequired ?? 3;
  const cooldownSeconds = input.cooldownSeconds ?? 180;
  const isOut = input.zone === 'above' || input.zone === 'below';
  const consecutiveOutOfRangeSamples = isOut
    ? input.state.consecutiveOutOfRangeSamples + 1
    : 0;
  const cooledDown = input.elapsedSeconds - input.state.lastCueElapsedSeconds >= cooldownSeconds;
  const baseState: HeartRateVoiceState = {
    previousZone: input.zone,
    consecutiveOutOfRangeSamples,
    lastCueElapsedSeconds: input.state.lastCueElapsedSeconds,
  };

  if (input.zone === 'in' && input.state.previousZone !== 'in' && input.state.previousZone !== 'unknown' && cooledDown) {
    return {
      state: { previousZone: 'in', consecutiveOutOfRangeSamples: 0, lastCueElapsedSeconds: input.elapsedSeconds },
      text: 'You’re back in your target heart-rate zone.',
    };
  }

  if (input.zone === 'above' && consecutiveOutOfRangeSamples >= samplesRequired && cooledDown) {
    return {
      state: { previousZone: 'above', consecutiveOutOfRangeSamples: 0, lastCueElapsedSeconds: input.elapsedSeconds },
      text: 'Your heart rate is above today’s target. Ease the pace slightly.',
    };
  }

  if (input.zone === 'below' && consecutiveOutOfRangeSamples >= samplesRequired && cooledDown) {
    return {
      state: { previousZone: 'below', consecutiveOutOfRangeSamples: 0, lastCueElapsedSeconds: input.elapsedSeconds },
      text: 'You’re below today’s target. Increase the effort gently if that feels appropriate.',
    };
  }

  if (input.zone === 'unknown') {
    return {
      state: {
        ...baseState,
        consecutiveOutOfRangeSamples: 0,
      },
    };
  }

  return { state: baseState };
}
