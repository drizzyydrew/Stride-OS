type RecommendationInput = {
  recoveryScore: number;
  fatigueScore: number;
  weeklyMileage: number;
};

export function getTrainingRecommendation({
  recoveryScore,
  fatigueScore,
  weeklyMileage,
}: RecommendationInput) {
  if (recoveryScore < 50 || fatigueScore > 75) {
    return {
      title: 'Recovery Priority',
      focus: 'Reduce load today',
      note: 'Keep intensity low. Easy aerobic work, mobility, or full rest is the smart play.',
    };
  }

  if (weeklyMileage < 25) {
    return {
      title: 'Aerobic Base',
      focus: 'Build durable volume',
      note: 'Prioritize Zone 2 running and consistent weekly mileage before adding harder work.',
    };
  }

  return {
    title: 'Quality Day',
    focus: 'Threshold or VO2 stimulus',
    note: 'You are ready for a controlled workout like Norwegian 4x4, threshold intervals, or strides.',
  };
}