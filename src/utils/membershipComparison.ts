/** Product capabilities only; store prices and availability come from Apple. */
export const MEMBERSHIP_COMPARISON = [
  { feature: 'Record runs and open workouts', free: 'Included', pro: 'Included' },
  { feature: 'Log exercises, sets, weight and effort', free: 'Included', pro: 'Included' },
  { feature: 'Calendar, saved history and basic Insights', free: 'Included', pro: 'Included' },
  { feature: 'Exercise instructions and strength calculators', free: 'Included', pro: 'Included' },
  { feature: 'Share activities and manage your data', free: 'Included', pro: 'Included' },
  { feature: 'Follow an existing training plan', free: 'Included', pro: 'Included' },
  { feature: 'New personalized training plans', free: '—', pro: 'Included' },
  { feature: 'Custom routes and reusable workout builders', free: '—', pro: 'Included' },
  { feature: 'Plan and schedule adjustments', free: '—', pro: 'Included' },
  { feature: 'Performance forecasts', free: '—', pro: 'Included' },
  { feature: 'AI Coach', free: 'Not included*', pro: '20 messages/day*' },
  { feature: 'Movement Lab videos, playback and results', free: '—', pro: 'Included' },
] as const;
