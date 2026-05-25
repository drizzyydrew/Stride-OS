// ─── Model assumptions ────────────────────────────────────────────────────────
//
// Recovery = readiness to train. Four contributors, max 100:
//
//   Base (20):        minimum floor so an athlete is never at zero from sleep
//                     and HR alone.
//
//   Sleep score (0–40): optimal at ≥8h. Degrades non-linearly below 7h.
//                     8h+ → 40pts, 7h → 30pts, 6h → 15pts, <5h → near 0.
//
//   HR score (0–30):  elevated resting HR is a reliable stress/illness signal.
//                     0 BPM above baseline → 30pts. Each +1 BPM costs 5pts.
//                     At +6 BPM the HR contribution reaches zero.
//
//   Fatigue drag (−0–30): accumulated training load suppresses readiness.
//                     drag = fatigueScore × 0.30
//
//   Easy load bonus (+0–10): aerobic base work improves recovery by promoting
//                     blood flow, mitochondrial density, and metabolite clearance.
//                     recentEasyLoad is the 7-day sum of easy/very_easy TSS.
//                     Caps at +10 so it can't overwhelm the other signals.

export type RecoveryInput = {
  sleepHours:     number;
  restingHRDelta: number;  // BPM above normal resting HR; negative values are ignored
  fatigueScore:   number;  // 0–100 (may already be time-decayed by the caller)
  recentEasyLoad: number;  // 7-day sum of easy + very_easy estimatedLoad values
};

function sleepScore(hours: number): number {
  if (hours >= 8.0) return 40;
  if (hours >= 7.0) return 30 + (hours - 7) * 10;   // 30–40 in this band
  if (hours >= 6.0) return 15 + (hours - 6) * 15;   // 15–30 in this band
  return Math.max(0, hours * 2.5);                   // 0–15 below 6h
}

function hrScore(delta: number): number {
  if (delta <= 0) return 30;
  return Math.max(0, 30 - delta * 5);
}

export function calculateRecoveryScore({
  sleepHours,
  restingHRDelta,
  fatigueScore,
  recentEasyLoad,
}: RecoveryInput): number {
  const fatigueDrag = fatigueScore * 0.30;
  const easyBonus   = Math.min(10, recentEasyLoad * 0.10);

  return Math.max(0, Math.min(100, Math.round(
    20 + sleepScore(sleepHours) + hrScore(restingHRDelta) - fatigueDrag + easyBonus,
  )));
}
