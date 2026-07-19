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
