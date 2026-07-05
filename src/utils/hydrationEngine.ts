// Hydration and fueling planner for runners.
// Fluid, sodium, and carbohydrate are estimated separately, then reconciled into
// practical ranges. Outputs are starting points to test in training.

export type WeatherBand = 'cold' | 'mild' | 'warm' | 'hot' | 'very_hot';
export type Sweatiness = 'very_low' | 'low' | 'average' | 'high' | 'very_high';
export type Saltiness = 'low' | 'moderate' | 'salty' | 'very_salty';
export type CrampingFrequency = 'never' | 'rarely' | 'sometimes' | 'often';
export type FluidComfort = 'low' | 'moderate' | 'high';
export type HydrationGoal = 'finish' | 'strong' | 'race_limit';

// Qualitative GI-tolerance self-report, mapped to a conservative carbToleranceGh
// ceiling. Not a diagnosis — just a practical carb-intake starting point.
export type GiTolerance = 'low' | 'typical' | 'high';

export const GI_TOLERANCE_CARBS_GH: Record<GiTolerance, number> = {
  low:     40,
  typical: 60,
  high:    85,
};

export type HydrationCalculatorInput = {
  distanceMiles?: number;
  durationMin: number;
  bodyWeightKg: number;
  effort: number;
  weatherBand: WeatherBand;
  temperatureF?: number;
  humidityBand?: 'low' | 'moderate' | 'high' | 'very_high';
  sunExposure?: 'shade' | 'mixed' | 'full_sun';
  sweatiness: Sweatiness;
  sweatRateTestLh?: number;
  saltiness: Saltiness;
  sweatSodiumMgL?: number;
  cramping: CrampingFrequency;
  carbToleranceGh?: number;
  fluidComfort: FluidComfort;
  goal: HydrationGoal;
};

export type HydrationPlan = {
  confidence: {
    score: number;
    label: 'Rough estimate' | 'Good starting plan' | 'Highly personalized';
  };
  hourly: {
    carbsG: number;
    fluidL: number;
    fluidOz: number;
    sodiumMg: number;
    sodiumMgPerL: number;
  };
  range: {
    fluidLowL: number;
    fluidHighL: number;
    sodiumLowMg: number;
    sodiumHighMg: number;
    carbsLowG: number;
    carbsHighG: number;
  };
  totals: {
    carbsG: number;
    fluidL: number;
    fluidOz: number;
    sodiumMg: number;
    sweatLossL: number;
    projectedBodyWeightLossPct: number;
  };
  physiology: {
    sweatRateLh: number;
    sweatSodiumMgL: number;
    replacementFraction: number;
  };
  preRun?: {
    fluidMl: [number, number];
    sodiumMgPerL: [number, number];
    timing: string;
  };
  postRun: {
    estimatedFluidL: [number, number];
    sodiumGuidance: string;
  };
  execution: string[];
  warnings: string[];
  notes: string[];
};

export type HydrationResult = {
  totalWaterOz: number;
  carbsMinG: number;
  carbsRecommendedG: number;
  carbsMaxG: number;
  sodiumMg: number;
  intervalCount: number;
  tempMultiplier: number;
  carbRate: {
    minGPerHr: number;
    recommendedGPerHr: number;
    maxGPerHr: number;
  };
  perInterval: {
    waterOz: number;
    carbsMinG: number;
    carbsRecommendedG: number;
    carbsMaxG: number;
    sodiumMg: number;
  };
};

const L_TO_OZ = 33.814;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function round(n: number, places = 0) {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}

export function weatherBandForTemp(tempF: number): WeatherBand {
  if (tempF < 50) return 'cold';
  if (tempF < 65) return 'mild';
  if (tempF < 80) return 'warm';
  if (tempF < 90) return 'hot';
  return 'very_hot';
}

function effortFactor(effort: number) {
  if (effort <= 3) return 0.85;
  if (effort <= 6) return 1.0;
  if (effort <= 8) return 1.1;
  return 1.2;
}

const TEMP_FACTOR: Record<WeatherBand, number> = {
  cold: 0.75,
  mild: 0.9,
  warm: 1.05,
  hot: 1.25,
  very_hot: 1.45,
};

const HUMIDITY_FACTOR = {
  low: 0.95,
  moderate: 1,
  high: 1.1,
  very_high: 1.2,
} as const;

const SUN_FACTOR = {
  shade: 0.95,
  mixed: 1,
  full_sun: 1.08,
} as const;

const SWEAT_BASE: Record<Sweatiness, number> = {
  very_low: 0.35,
  low: 0.5,
  average: 0.75,
  high: 1.1,
  very_high: 1.5,
};

const SALT_BASE: Record<Saltiness, number> = {
  low: 500,
  moderate: 800,
  salty: 1100,
  very_salty: 1500,
};

const CRAMP_MOD: Record<CrampingFrequency, number> = {
  never: 0,
  rarely: 0,
  sometimes: 100,
  often: 200,
};

export function carbRateForDuration(durationMin: number): HydrationResult['carbRate'] {
  if (durationMin <= 30) return { minGPerHr: 0, recommendedGPerHr: 10, maxGPerHr: 30 };
  if (durationMin <= 60) return { minGPerHr: 0, recommendedGPerHr: 20, maxGPerHr: 50 };
  if (durationMin <= 90) return { minGPerHr: 20, recommendedGPerHr: 35, maxGPerHr: 60 };
  if (durationMin <= 120) return { minGPerHr: 30, recommendedGPerHr: 50, maxGPerHr: 70 };
  if (durationMin <= 180) return { minGPerHr: 45, recommendedGPerHr: 65, maxGPerHr: 90 };
  if (durationMin <= 360) return { minGPerHr: 60, recommendedGPerHr: 75, maxGPerHr: 90 };
  return { minGPerHr: 60, recommendedGPerHr: 75, maxGPerHr: 100 };
}

function carbTarget(input: HydrationCalculatorInput) {
  const hours = input.durationMin / 60;
  const band = carbRateForDuration(input.durationMin);
  let target = band.recommendedGPerHr;
  if (input.effort >= 7) target += 10;
  if (input.effort <= 3) target -= 10;
  if (input.goal === 'race_limit') target += 10;
  if (input.goal === 'finish') target -= 5;
  if (input.bodyWeightKg > 70 && hours >= 2) target += 5;

  const defaultMax = input.carbToleranceGh && input.carbToleranceGh >= 90 ? 120 : 90;
  const toleranceMax = input.carbToleranceGh ? input.carbToleranceGh + 10 : defaultMax;
  target = clamp(target, 0, Math.min(defaultMax, toleranceMax));

  return {
    target: round(target),
    low: round(clamp(target - 10, band.minGPerHr, band.maxGPerHr)),
    high: round(clamp(target + 10, band.minGPerHr, defaultMax)),
  };
}

function estimateSweatRate(input: HydrationCalculatorInput) {
  if (input.sweatRateTestLh && input.sweatRateTestLh > 0) {
    return clamp(input.sweatRateTestLh, 0.25, 3);
  }
  return clamp(
    SWEAT_BASE[input.sweatiness] *
      effortFactor(input.effort) *
      TEMP_FACTOR[input.weatherBand] *
      HUMIDITY_FACTOR[input.humidityBand ?? 'moderate'] *
      SUN_FACTOR[input.sunExposure ?? 'mixed'],
    0.25,
    2.5,
  );
}

function fluidReplacementFraction(input: HydrationCalculatorInput, sweatRateLh: number) {
  const h = input.durationMin / 60;
  let fraction = h < 1 ? 0.2 : h < 2 ? 0.45 : h < 4 ? 0.58 : 0.68;
  if (input.weatherBand === 'hot' || input.weatherBand === 'very_hot') fraction += 0.05;
  if (sweatRateLh >= 1.1) fraction += 0.05;
  if (input.fluidComfort === 'low') fraction -= 0.05;
  if (input.goal === 'race_limit') fraction += 0.05;
  if (input.goal === 'finish') fraction -= 0.05;
  return clamp(fraction, 0, 0.85);
}

function sodiumReplacementFraction(input: HydrationCalculatorInput, sweatRateLh: number) {
  const h = input.durationMin / 60;
  let fraction = h < 1.5 ? 0.15 : h < 3 ? 0.32 : h < 6 ? 0.5 : 0.6;
  if (input.weatherBand === 'hot' || input.weatherBand === 'very_hot') fraction += 0.05;
  if (input.saltiness === 'very_salty') fraction += 0.05;
  if (input.cramping === 'often') fraction += 0.05;
  if (input.saltiness === 'low') fraction -= 0.05;
  if (sweatRateLh < 0.5) fraction -= 0.05;
  return clamp(fraction, 0, 0.75);
}

export function calculateHydrationPlan(input: HydrationCalculatorInput): HydrationPlan {
  const durationHours = Math.max(0.1, input.durationMin / 60);
  const warnings: string[] = [];
  const notes: string[] = [];

  const carbs = carbTarget(input);
  const sweatRateLh = estimateSweatRate(input);
  const totalSweatLossL = sweatRateLh * durationHours;
  const replacementFraction = fluidReplacementFraction(input, sweatRateLh);

  let fluidTargetLh = sweatRateLh * replacementFraction;
  const maxFluid = sweatRateLh > 1.5 && ['hot', 'very_hot'].includes(input.weatherBand) ? 1.2 : 1.0;
  fluidTargetLh = clamp(fluidTargetLh, input.durationMin < 45 ? 0 : 0.2, maxFluid);

  const plannedFluidL = fluidTargetLh * durationHours;
  const projectedDeficitL = totalSweatLossL - plannedFluidL;
  const projectedBodyWeightLossPct = (projectedDeficitL / input.bodyWeightKg) * 100;

  const sweatSodiumMgL = input.sweatSodiumMgL
    ? clamp(input.sweatSodiumMgL, 100, 2500)
    : clamp(SALT_BASE[input.saltiness] + CRAMP_MOD[input.cramping], 200, 1800);
  const sodiumLossMgH = sweatRateLh * sweatSodiumMgL;
  let sodiumTargetMgH = sodiumLossMgH * sodiumReplacementFraction(input, sweatRateLh);
  const sodiumMax = input.durationMin >= 180 && input.saltiness !== 'low' ? 1500 : 1000;
  sodiumTargetMgH = clamp(sodiumTargetMgH, 0, sodiumMax);

  const sodiumMgPerL = fluidTargetLh > 0 ? sodiumTargetMgH / fluidTargetLh : 0;

  if (sweatRateLh > 1.5 && !input.sweatRateTestLh) {
    warnings.push('High sweat-loss scenario. A real sweat-rate test would make this plan more reliable.');
  }
  if (projectedBodyWeightLossPct < 0) {
    warnings.push('This may over-replace fluid. Reduce intake or increase sodium concentration.');
  }
  if (projectedBodyWeightLossPct > 4 && durationHours < 4) {
    warnings.push('Projected fluid deficit is high for this duration, especially if it is hot.');
  }
  if (projectedBodyWeightLossPct > 6) {
    warnings.push('Projected fluid deficit is very large. Recheck inputs and make sure you have fluid access.');
  }
  if (fluidTargetLh > sweatRateLh * 0.9 || fluidTargetLh > 1.2 || (fluidTargetLh > 0.9 && sodiumTargetMgH < 300)) {
    warnings.push('Avoid forcing fluid. High fluid intake can be risky if it exceeds sweat losses or is not matched with sodium.');
  }
  if (sodiumMgPerL > 1500) {
    warnings.push('Very high sodium concentration. Split sodium across drink, food, or capsules and test in training.');
  }
  if (input.carbToleranceGh && carbs.target > input.carbToleranceGh + 10) {
    warnings.push('Build toward this carb target in training. Start near your current tolerated intake.');
  }

  if (!input.sweatRateTestLh) notes.push('Sweat rate is estimated from weather, effort, and sweatiness.');
  if (!input.sweatSodiumMgL) notes.push('Sodium is estimated from saltiness and cramping history.');
  if (sodiumMgPerL < 300) notes.push('Low sodium concentration is usually fine for short, cool, low-sweat runs.');
  else if (sodiumMgPerL < 700) notes.push('Moderate sodium concentration.');
  else if (sodiumMgPerL < 1200) notes.push('High sodium concentration, useful for salty sweaters or hot/long runs.');

  const preRun = (
    input.durationMin > 90 ||
    input.weatherBand === 'hot' ||
    input.weatherBand === 'very_hot' ||
    sweatRateLh >= 1.1 ||
    input.effort >= 8
  )
    ? {
      fluidMl: [round(input.bodyWeightKg * 5), round(input.bodyWeightKg * 7)] as [number, number],
      sodiumMgPerL: [1000, 1500] as [number, number],
      timing: '60-90 min before. Finish most fluid 30-45 min before start.',
    }
    : undefined;

  const postLow = Math.max(0.2, projectedDeficitL * 1.2);
  const postHigh = Math.max(postLow, projectedDeficitL * 1.5);

  let confidenceScore = 40;
  if (input.sweatRateTestLh) confidenceScore += 20;
  if (input.sweatSodiumMgL) confidenceScore += 20;
  if (input.durationMin && input.weatherBand) confidenceScore += 10;
  if (input.carbToleranceGh) confidenceScore += 10;
  if (input.weatherBand === 'very_hot' && !input.sweatRateTestLh) confidenceScore -= 10;
  if (sweatRateLh > 1.5 && !input.sweatRateTestLh) confidenceScore -= 10;
  confidenceScore = clamp(confidenceScore, 0, 100);

  const confidenceLabel = confidenceScore >= 75
    ? 'Highly personalized'
    : confidenceScore >= 50
      ? 'Good starting plan'
      : 'Rough estimate';

  const fluidLowL = round(fluidTargetLh * 0.85, 2);
  const fluidHighL = round(fluidTargetLh * 1.15, 2);
  const sodiumLowMg = round(sodiumTargetMgH * 0.85);
  const sodiumHighMg = round(sodiumTargetMgH * 1.15);

  const execution = [
    `${round(fluidTargetLh * L_TO_OZ)} oz/h fluid, taken in small sips.`,
    `${carbs.target > 0 ? `Aim for ${carbs.low}-${carbs.high} g carbs/h.` : 'Carbs optional if you start well fueled.'}`,
    `${sodiumTargetMgH > 0 ? `${sodiumLowMg}-${sodiumHighMg} mg sodium/h across drink, food, or capsules.` : 'Sodium not required during this run unless conditions change.'}`,
  ];

  return {
    confidence: { score: confidenceScore, label: confidenceLabel },
    hourly: {
      carbsG: carbs.target,
      fluidL: round(fluidTargetLh, 2),
      fluidOz: round(fluidTargetLh * L_TO_OZ),
      sodiumMg: round(sodiumTargetMgH),
      sodiumMgPerL: round(sodiumMgPerL),
    },
    range: {
      fluidLowL,
      fluidHighL,
      sodiumLowMg,
      sodiumHighMg,
      carbsLowG: carbs.low,
      carbsHighG: carbs.high,
    },
    totals: {
      carbsG: round(carbs.target * durationHours),
      fluidL: round(plannedFluidL, 2),
      fluidOz: round(plannedFluidL * L_TO_OZ),
      sodiumMg: round(sodiumTargetMgH * durationHours),
      sweatLossL: round(totalSweatLossL, 2),
      projectedBodyWeightLossPct: round(projectedBodyWeightLossPct, 1),
    },
    physiology: {
      sweatRateLh: round(sweatRateLh, 2),
      sweatSodiumMgL: round(sweatSodiumMgL),
      replacementFraction: round(replacementFraction, 2),
    },
    preRun,
    postRun: {
      estimatedFluidL: [round(postLow, 1), round(postHigh, 1)],
      sodiumGuidance: 'If rapid recovery matters, include sodium or salty food. Avoid chugging plain water.',
    },
    execution,
    warnings,
    notes,
  };
}

// One short, plain-language sentence naming the biggest real driver behind
// this plan — coaching context, not a restatement of the numbers above it.
export function explainPlan(input: HydrationCalculatorInput, plan: HydrationPlan): string {
  const hot = input.weatherBand === 'hot' || input.weatherBand === 'very_hot';
  const long = input.durationMin >= 150;
  const hard = input.effort >= 8;
  const highSweat = plan.physiology.sweatRateLh >= 1.1;

  if (hot && (long || highSweat)) {
    return "It's warm and this is a longer effort, so sweat losses add up — plan for more fluid and sodium per hour than an easy day.";
  }
  if (hot) {
    return "It's warm out, which raises sweat losses even at an easy effort — fluid and sodium needs are a bit higher than a cool-weather run.";
  }
  if (long) {
    return 'This is a long effort, so getting fluid, sodium, and carbs in steadily matters more than hitting an exact number.';
  }
  if (hard) {
    return 'This is a hard effort, so sweat and fuel use run higher per hour than an easy day.';
  }
  if (input.goal === 'race_limit') {
    return "You're planning for race conditions, so this plan leans toward the higher end of what's typically tolerated.";
  }
  return 'This is a moderate effort in mild conditions — the plan below is a reasonable starting point to test in training.';
}

export function calcHydration(
  weightKg: number,
  durationMin: number,
  tempF: number,
): HydrationResult {
  const plan = calculateHydrationPlan({
    durationMin,
    bodyWeightKg: weightKg,
    effort: durationMin >= 90 ? 6 : 4,
    weatherBand: weatherBandForTemp(tempF),
    temperatureF: tempF,
    humidityBand: 'moderate',
    sunExposure: 'mixed',
    sweatiness: 'average',
    saltiness: 'moderate',
    cramping: 'rarely',
    fluidComfort: 'moderate',
    goal: 'strong',
  });
  const hours = durationMin / 60;
  const intervals = Math.max(1, Math.ceil(durationMin / 20));
  const carbRate = carbRateForDuration(durationMin);
  const totalWaterOz = plan.totals.fluidOz;
  const carbsMinG = plan.range.carbsLowG * hours;
  const carbsRecommendedG = plan.hourly.carbsG * hours;
  const carbsMaxG = plan.range.carbsHighG * hours;
  const sodiumMg = plan.totals.sodiumMg;
  const tempMultiplier = tempF <= 65 ? 1 : TEMP_FACTOR[weatherBandForTemp(tempF)] / TEMP_FACTOR.mild;

  return {
    totalWaterOz,
    carbsMinG,
    carbsRecommendedG,
    carbsMaxG,
    sodiumMg,
    intervalCount: intervals,
    tempMultiplier,
    carbRate,
    perInterval: {
      waterOz: totalWaterOz / intervals,
      carbsMinG: carbsMinG / intervals,
      carbsRecommendedG: carbsRecommendedG / intervals,
      carbsMaxG: carbsMaxG / intervals,
      sodiumMg: sodiumMg / intervals,
    },
  };
}

export function estimateEasyPaceSecPerMi(weeklyMileage: number): number {
  if (weeklyMileage < 15) return 660;
  if (weeklyMileage < 30) return 600;
  if (weeklyMileage < 50) return 540;
  return 480;
}

export function formatPaceMmSs(secPerMi: number): string {
  const mm = Math.floor(secPerMi / 60);
  const ss = Math.round(secPerMi % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export type RunType = 'fartlek' | 'tempo' | 'intervals' | 'long_run_strides';
export type FartlekParams = { totalMin: number };
export type TempoParams = { warmupMi: number; tempoMi: number; cooldownMi: number };
export type IntervalsParams = {
  warmupMi: number;
  reps: number;
  workMi: number;
  restMin: number;
  cooldownMi: number;
};
export type LongRunStridesParams = { distanceMi: number; strides: number };

export type DurationEstimate = {
  estimatedMin: number;
  estimatedMi: number;
  segments: { label: string; paceTarget: string; durationMin: number; distanceMi: number }[];
};

export function estimateFartlek(p: FartlekParams, easySecPerMi: number): DurationEstimate {
  const intervalSecPerMi = easySecPerMi * 0.78;
  const avgSecPerMi = easySecPerMi * 0.6 + intervalSecPerMi * 0.4;
  const distanceMi = (p.totalMin * 60) / avgSecPerMi;
  return {
    estimatedMin: p.totalMin,
    estimatedMi: round(distanceMi, 1),
    segments: [{ label: 'Fartlek', paceTarget: `${formatPaceMmSs(easySecPerMi)}-${formatPaceMmSs(intervalSecPerMi)} /mi`, durationMin: p.totalMin, distanceMi }],
  };
}

export function estimateTempo(p: TempoParams, easySecPerMi: number): DurationEstimate {
  const tempoSecPerMi = easySecPerMi * 0.85;
  const warmupMin = (p.warmupMi * easySecPerMi) / 60;
  const tempoMin = (p.tempoMi * tempoSecPerMi) / 60;
  const cooldownMin = (p.cooldownMi * easySecPerMi) / 60;
  return {
    estimatedMin: Math.round(warmupMin + tempoMin + cooldownMin),
    estimatedMi: round(p.warmupMi + p.tempoMi + p.cooldownMi, 1),
    segments: [
      { label: 'Warmup', paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`, durationMin: warmupMin, distanceMi: p.warmupMi },
      { label: 'Tempo', paceTarget: `${formatPaceMmSs(tempoSecPerMi)} /mi`, durationMin: tempoMin, distanceMi: p.tempoMi },
      { label: 'Cooldown', paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`, durationMin: cooldownMin, distanceMi: p.cooldownMi },
    ],
  };
}

export function estimateIntervals(p: IntervalsParams, easySecPerMi: number): DurationEstimate {
  const intervalSecPerMi = easySecPerMi * 0.78;
  const warmupMin = (p.warmupMi * easySecPerMi) / 60;
  const workMin = (p.workMi * intervalSecPerMi) / 60;
  const cooldownMin = (p.cooldownMi * easySecPerMi) / 60;
  const repsTotalMin = p.reps * (workMin + p.restMin);
  return {
    estimatedMin: Math.round(warmupMin + repsTotalMin + cooldownMin),
    estimatedMi: round(p.warmupMi + p.reps * p.workMi + p.cooldownMi, 1),
    segments: [
      { label: 'Warmup', paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`, durationMin: warmupMin, distanceMi: p.warmupMi },
      { label: `${p.reps}x${p.workMi} mi @ intervals`, paceTarget: `${formatPaceMmSs(intervalSecPerMi)} /mi`, durationMin: repsTotalMin, distanceMi: p.reps * p.workMi },
      { label: `Rest (${p.restMin} min between)`, paceTarget: 'walk/jog', durationMin: p.reps * p.restMin, distanceMi: 0 },
      { label: 'Cooldown', paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`, durationMin: cooldownMin, distanceMi: p.cooldownMi },
    ],
  };
}

export function estimateLongRunStrides(p: LongRunStridesParams, easySecPerMi: number): DurationEstimate {
  const mainMin = (p.distanceMi * easySecPerMi) / 60;
  const stridesMin = (p.strides * (20 + 45)) / 60;
  return {
    estimatedMin: Math.round(mainMin + stridesMin),
    estimatedMi: round(p.distanceMi, 1),
    segments: [
      { label: 'Long Run', paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`, durationMin: mainMin, distanceMi: p.distanceMi },
      { label: `${p.strides}x 20s strides`, paceTarget: 'fast/relaxed', durationMin: stridesMin, distanceMi: 0 },
    ],
  };
}
