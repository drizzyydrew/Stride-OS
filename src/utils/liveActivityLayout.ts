import type { OutdoorLiveActivityType } from '../lib/liveActivityContracts';

export type LiveActivityLayoutKind =
  | 'outdoor_run'
  | 'treadmill'
  | 'run_walk'
  | 'intervals'
  | 'walking'
  | 'cycling'
  | 'recovery'
  | 'strength';

export type LiveActivityMetricConfig = {
  kind: LiveActivityLayoutKind;
  title: string;
  icon: string;
  primaryMetric: 'pace' | 'speed' | 'timer' | 'sets';
  showsDistance: boolean;
  showsHeartRate: boolean;
  showsGpsPace: boolean;
  guidanceSlot: 'none' | 'interval' | 'navigation' | 'minimal';
};

export function liveActivityMetricConfig(input: {
  activityType: OutdoorLiveActivityType | 'treadmill' | 'intervals' | 'mobility' | 'active_recovery' | 'strength' | string;
  indoor?: boolean;
}): LiveActivityMetricConfig {
  if (input.activityType === 'strength') {
    return config('strength', 'Strength', 'dumbbell.fill', 'sets', false, false, false, 'minimal');
  }
  if (input.activityType === 'treadmill' || (input.activityType === 'running' && input.indoor)) {
    return config('treadmill', 'Treadmill Run', 'figure.run', 'pace', true, true, false, 'interval');
  }
  if (input.activityType === 'run_walk') {
    return config('run_walk', 'Run / Walk', 'figure.run', 'pace', true, true, true, 'interval');
  }
  if (input.activityType === 'intervals') {
    return config('intervals', 'Intervals', 'timer', 'pace', true, true, true, 'interval');
  }
  if (input.activityType === 'cycling' || input.activityType === 'indoor_cycling') {
    return config('cycling', input.activityType === 'indoor_cycling' ? 'Indoor Ride' : 'Ride', 'bicycle', 'speed', true, true, false, 'navigation');
  }
  if (input.activityType === 'walking' || input.activityType === 'hiking') {
    return config('walking', input.activityType === 'hiking' ? 'Hike' : 'Walk', 'figure.walk', 'pace', true, true, true, 'navigation');
  }
  if (input.activityType === 'mobility' || input.activityType === 'active_recovery') {
    return config('recovery', 'Recovery', 'figure.cooldown', 'timer', false, false, false, 'minimal');
  }
  return config('outdoor_run', 'Training Run', 'figure.run', 'pace', true, true, true, 'navigation');
}

function config(
  kind: LiveActivityLayoutKind,
  title: string,
  icon: string,
  primaryMetric: LiveActivityMetricConfig['primaryMetric'],
  showsDistance: boolean,
  showsHeartRate: boolean,
  showsGpsPace: boolean,
  guidanceSlot: LiveActivityMetricConfig['guidanceSlot'],
): LiveActivityMetricConfig {
  return { kind, title, icon, primaryMetric, showsDistance, showsHeartRate, showsGpsPace, guidanceSlot };
}
