// Returns how many points a workout removes from the recovery score.
// Higher load = more cost. Low base recovery amplifies the cost.
export function calculateRecoveryImpact(
  estimatedLoad:   number,
  currentRecovery: number,
): number {
  const baseImpact = estimatedLoad * 0.5;
  const modifier   =
    currentRecovery < 50 ? 1.25 :
    currentRecovery < 70 ? 1.10 : 1.00;

  return Math.max(0, Math.round(baseImpact * modifier));
}
