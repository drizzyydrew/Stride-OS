import type { TelemetrySource } from '../types/activity';

export type TreadmillPhonePlacement = 'on_body' | 'resting_on_treadmill' | 'connected_sensor';

export type TreadmillMetricAvailability = {
  distance: TelemetrySource;
  pace: TelemetrySource;
  cadence: TelemetrySource;
  steps: TelemetrySource;
  autoPauseAvailable: boolean;
  explanation: string;
};

export function treadmillMetricAvailability(input: {
  placement: TreadmillPhonePlacement;
  connectedSource?: TelemetrySource | null;
}): TreadmillMetricAvailability {
  const connected = input.connectedSource && input.connectedSource !== 'unavailable'
    ? input.connectedSource
    : null;
  if (input.placement === 'connected_sensor' && connected) {
    return {
      distance: connected,
      pace: connected,
      cadence: connected === 'heart_rate_monitor' ? 'unavailable' : connected,
      steps: connected === 'foot_pod' || connected === 'apple_watch' ? connected : 'unavailable',
      autoPauseAvailable: connected !== 'heart_rate_monitor',
      explanation: 'Connected sensor is the active treadmill source.',
    };
  }
  if (input.placement === 'on_body') {
    return {
      distance: connected ?? 'phone_motion',
      pace: connected ?? 'phone_motion',
      cadence: connected ?? 'phone_motion',
      steps: connected ?? 'phone_motion',
      autoPauseAvailable: true,
      explanation: connected
        ? 'Connected sensor overrides phone-motion estimates.'
        : 'Phone motion can estimate treadmill movement because the phone is carried on body.',
    };
  }
  return {
    distance: connected ?? 'unavailable',
    pace: connected ?? 'unavailable',
    cadence: connected && connected !== 'heart_rate_monitor' ? connected : 'unavailable',
    steps: connected === 'foot_pod' || connected === 'apple_watch' ? connected : 'unavailable',
    autoPauseAvailable: Boolean(connected && connected !== 'heart_rate_monitor'),
    explanation: connected
      ? 'Metrics come from the connected source because the phone is stationary.'
      : 'Phone motion is unavailable while the phone rests on the treadmill.',
  };
}
