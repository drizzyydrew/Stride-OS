// ─── Hydration & Pace Estimation Engine ────────────────────────────────────────
//
// Formulas derived from athlete hydration spreadsheet:
//   Water (oz) = (weightLbs / 30) × (durationMin / 15)
//   Carbs min  = (durationMin / 60) × 60 g
//   Carbs max  = (durationMin / 60) × 120 g
//   Sodium     = (durationMin / 60) × 1000 mg
//
// Temperature adjustment: +5% per 5°F above 65°F, capped at +25% (90°F+).

export type HydrationResult = {
  totalWaterOz: number;
  carbsMinG:    number;
  carbsRecommendedG: number;
  carbsMaxG:    number;
  sodiumMg:     number;
  intervalCount: number;
  tempMultiplier: number;
  carbRate: {
    minGPerHr: number;
    recommendedGPerHr: number;
    maxGPerHr: number;
  };
  perInterval: {
    waterOz:   number;
    carbsMinG: number;
    carbsRecommendedG: number;
    carbsMaxG: number;
    sodiumMg:  number;
  };
};

export function calcHydration(
  weightKg:    number,
  durationMin: number,
  tempF:       number,
): HydrationResult {
  const lbs      = weightKg * 2.20462;
  const tempMult = tempF <= 65
    ? 1.0
    : 1 + Math.min((tempF - 65) / 5, 5) * 0.05;
  const carbRate = carbRateForDuration(durationMin);
  const hours = durationMin / 60;

  const totalWaterOz = (lbs / 30) * (durationMin / 15) * tempMult;
  const carbsMinG    = hours * carbRate.minGPerHr;
  const carbsRecommendedG = hours * carbRate.recommendedGPerHr;
  const carbsMaxG    = hours * carbRate.maxGPerHr;
  const sodiumMg     = hours * 1000 * tempMult;
  const intervals    = Math.max(1, Math.ceil(durationMin / 20));

  return {
    totalWaterOz,
    carbsMinG,
    carbsRecommendedG,
    carbsMaxG,
    sodiumMg,
    intervalCount: intervals,
    tempMultiplier: tempMult,
    carbRate,
    perInterval: {
      waterOz:   totalWaterOz / intervals,
      carbsMinG: carbsMinG   / intervals,
      carbsRecommendedG: carbsRecommendedG / intervals,
      carbsMaxG: carbsMaxG   / intervals,
      sodiumMg:  sodiumMg    / intervals,
    },
  };
}

export function carbRateForDuration(durationMin: number): HydrationResult['carbRate'] {
  if (durationMin <= 30) return { minGPerHr: 0, recommendedGPerHr: 10, maxGPerHr: 30 };
  if (durationMin <= 60) return { minGPerHr: 0, recommendedGPerHr: 20, maxGPerHr: 50 };
  if (durationMin <= 90) return { minGPerHr: 20, recommendedGPerHr: 30, maxGPerHr: 70 };
  if (durationMin <= 120) return { minGPerHr: 40, recommendedGPerHr: 60, maxGPerHr: 90 };
  if (durationMin <= 150) return { minGPerHr: 50, recommendedGPerHr: 80, maxGPerHr: 120 };
  if (durationMin <= 180) return { minGPerHr: 60, recommendedGPerHr: 90, maxGPerHr: 150 };
  if (durationMin <= 360) return { minGPerHr: 75, recommendedGPerHr: 100, maxGPerHr: 150 };
  return { minGPerHr: 75, recommendedGPerHr: 90, maxGPerHr: 120 };
}

// Rough easy pace estimate when no calibration data is available.
export function estimateEasyPaceSecPerMi(weeklyMileage: number): number {
  if (weeklyMileage < 15) return 660; // 11:00 /mi
  if (weeklyMileage < 30) return 600; // 10:00 /mi
  if (weeklyMileage < 50) return 540; //  9:00 /mi
  return 480;                          //  8:00 /mi
}

export function formatPaceMmSs(secPerMi: number): string {
  const mm = Math.floor(secPerMi / 60);
  const ss = Math.round(secPerMi % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// Duration estimation helpers used by Run Creator.

export type RunType = 'fartlek' | 'tempo' | 'intervals' | 'long_run_strides';

export type FartlekParams = { totalMin: number };
export type TempoParams   = { warmupMi: number; tempoMi: number; cooldownMi: number };
export type IntervalsParams = {
  warmupMi:   number;
  reps:       number;
  workMi:     number;
  restMin:    number;
  cooldownMi: number;
};
export type LongRunStridesParams = { distanceMi: number; strides: number };

export type DurationEstimate = {
  estimatedMin:  number;
  estimatedMi:   number;
  segments: { label: string; paceTarget: string; durationMin: number; distanceMi: number }[];
};

export function estimateFartlek(
  p: FartlekParams,
  easySecPerMi: number,
): DurationEstimate {
  const intervalSecPerMi = easySecPerMi * 0.78;
  const avgSecPerMi = easySecPerMi * 0.6 + intervalSecPerMi * 0.4;
  const distanceMi  = (p.totalMin * 60) / avgSecPerMi;
  return {
    estimatedMin: p.totalMin,
    estimatedMi:  Math.round(distanceMi * 10) / 10,
    segments: [
      {
        label:       'Fartlek',
        paceTarget:  `${formatPaceMmSs(easySecPerMi)}–${formatPaceMmSs(intervalSecPerMi)} /mi`,
        durationMin: p.totalMin,
        distanceMi,
      },
    ],
  };
}

export function estimateTempo(
  p: TempoParams,
  easySecPerMi: number,
): DurationEstimate {
  const tempoSecPerMi = easySecPerMi * 0.85;
  const warmupMin   = (p.warmupMi   * easySecPerMi)  / 60;
  const tempoMin    = (p.tempoMi    * tempoSecPerMi)  / 60;
  const cooldownMin = (p.cooldownMi * easySecPerMi)   / 60;
  const totalMin    = warmupMin + tempoMin + cooldownMin;
  const totalMi     = p.warmupMi + p.tempoMi + p.cooldownMi;
  return {
    estimatedMin: Math.round(totalMin),
    estimatedMi:  Math.round(totalMi * 10) / 10,
    segments: [
      { label: 'Warmup',   paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`,  durationMin: warmupMin,   distanceMi: p.warmupMi   },
      { label: 'Tempo',    paceTarget: `${formatPaceMmSs(tempoSecPerMi)} /mi`, durationMin: tempoMin,    distanceMi: p.tempoMi    },
      { label: 'Cooldown', paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`,  durationMin: cooldownMin, distanceMi: p.cooldownMi },
    ],
  };
}

export function estimateIntervals(
  p: IntervalsParams,
  easySecPerMi: number,
): DurationEstimate {
  const intervalSecPerMi = easySecPerMi * 0.78;
  const warmupMin   = (p.warmupMi   * easySecPerMi)    / 60;
  const workMin     = (p.workMi     * intervalSecPerMi) / 60;
  const cooldownMin = (p.cooldownMi * easySecPerMi)     / 60;
  const repsTotalMin = p.reps * (workMin + p.restMin);
  const totalMin    = warmupMin + repsTotalMin + cooldownMin;
  const totalMi     = p.warmupMi + p.reps * p.workMi + p.cooldownMi;
  return {
    estimatedMin: Math.round(totalMin),
    estimatedMi:  Math.round(totalMi * 10) / 10,
    segments: [
      { label: 'Warmup',   paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`,    durationMin: warmupMin,   distanceMi: p.warmupMi   },
      { label: `${p.reps}×${p.workMi} mi @ intervals`, paceTarget: `${formatPaceMmSs(intervalSecPerMi)} /mi`, durationMin: repsTotalMin, distanceMi: p.reps * p.workMi },
      { label: `Rest (${p.restMin} min between)`, paceTarget: 'walk/jog', durationMin: p.reps * p.restMin, distanceMi: 0 },
      { label: 'Cooldown', paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`,    durationMin: cooldownMin, distanceMi: p.cooldownMi },
    ],
  };
}

export function estimateLongRunStrides(
  p: LongRunStridesParams,
  easySecPerMi: number,
): DurationEstimate {
  const mainMin   = (p.distanceMi * easySecPerMi) / 60;
  const stridesMin = (p.strides * (20 + 45)) / 60;
  const totalMin  = mainMin + stridesMin;
  return {
    estimatedMin: Math.round(totalMin),
    estimatedMi:  Math.round(p.distanceMi * 10) / 10,
    segments: [
      { label: 'Long Run',                  paceTarget: `${formatPaceMmSs(easySecPerMi)} /mi`, durationMin: mainMin,    distanceMi: p.distanceMi },
      { label: `${p.strides}× 20s strides`, paceTarget: 'fast/relaxed',                         durationMin: stridesMin, distanceMi: 0            },
    ],
  };
}
