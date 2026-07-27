import type { TrainingPhase } from '../../types/training';

export type TrainingLoadDecision = 'progress' | 'maintain' | 'regress' | 'deload' | 'repeat' | 'rebuild';

export type DeloadBlockLength = 3 | 4;

export type DeloadPolicy = {
  buildWeeks: DeloadBlockLength;
  deloadWeeks: 1;
  defaultVolumeFactor: number;
  minVolumeFactor: number;
  maxVolumeFactor: number;
  blockMultipliers: readonly number[];
};

export type DeloadDecisionInput = {
  weekInBlock?: number;
  currentWeek?: number;
  phase?: TrainingPhase;
  blockLength?: DeloadBlockLength;
  volumeFactor?: number;
};

export type DeloadDecision = {
  weekInBlock: number;
  blockNumber: number;
  isDeload: boolean;
  isLoadingPeak: boolean;
  volumeFactor: number;
  blockMultiplier: number;
  effectivePhase: TrainingPhase;
  rationale: string;
};

export const DEFAULT_DELOAD_POLICY: DeloadPolicy = {
  buildWeeks: 3,
  deloadWeeks: 1,
  defaultVolumeFactor: 0.7,
  minVolumeFactor: 0.65,
  maxVolumeFactor: 0.75,
  // Preserve Build 44's default mesocycle loading shape while centralizing it.
  blockMultipliers: [0.9, 0.95, 1, 0.65],
};

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeDeloadVolumeFactor(
  volumeFactor = DEFAULT_DELOAD_POLICY.defaultVolumeFactor,
  policy = DEFAULT_DELOAD_POLICY,
): number {
  return clampFinite(volumeFactor, policy.minVolumeFactor, policy.maxVolumeFactor, policy.defaultVolumeFactor);
}

export function getMesocycleLength(blockLength: DeloadBlockLength = DEFAULT_DELOAD_POLICY.buildWeeks): number {
  return blockLength + DEFAULT_DELOAD_POLICY.deloadWeeks;
}

export function getWeekInBlock(currentWeek: number, blockLength: DeloadBlockLength = DEFAULT_DELOAD_POLICY.buildWeeks): number {
  const mesocycleLength = getMesocycleLength(blockLength);
  const safeWeek = Math.max(1, Math.floor(Number.isFinite(currentWeek) ? currentWeek : 1));
  return ((safeWeek - 1) % mesocycleLength) + 1;
}

export function shouldApplyDeload(
  currentWeek: number,
  phase?: TrainingPhase,
  blockLength: DeloadBlockLength = DEFAULT_DELOAD_POLICY.buildWeeks,
): boolean {
  if (phase === 'taper') return false;
  if (phase === 'deload') return true;
  return getWeekInBlock(currentWeek, blockLength) === getMesocycleLength(blockLength);
}

export function resolvePhaseWithDeload(
  currentWeek: number,
  plannedPhase: TrainingPhase,
  blockLength: DeloadBlockLength = DEFAULT_DELOAD_POLICY.buildWeeks,
): TrainingPhase {
  if (plannedPhase === 'taper') return 'taper';
  return shouldApplyDeload(currentWeek, plannedPhase, blockLength) ? 'deload' : plannedPhase;
}

export function resolveDeloadDecision(
  input: DeloadDecisionInput,
  policy = DEFAULT_DELOAD_POLICY,
): DeloadDecision {
  const blockLength = input.blockLength ?? policy.buildWeeks;
  const mesocycleLength = getMesocycleLength(blockLength);
  const currentWeek = Math.max(1, Math.floor(Number.isFinite(input.currentWeek) ? input.currentWeek! : 1));
  const weekInBlock = input.weekInBlock
    ? clampFinite(Math.floor(input.weekInBlock), 1, mesocycleLength, getWeekInBlock(currentWeek, blockLength))
    : getWeekInBlock(currentWeek, blockLength);
  const phase = input.phase ?? 'base';
  const isDeload = phase === 'deload' || (phase !== 'taper' && weekInBlock === mesocycleLength);
  const blockMultiplier = blockLength === DEFAULT_DELOAD_POLICY.buildWeeks
    ? policy.blockMultipliers[weekInBlock - 1] ?? policy.blockMultipliers[policy.blockMultipliers.length - 1]!
    : (isDeload ? normalizeDeloadVolumeFactor(input.volumeFactor, policy) : 1);
  const volumeFactor = isDeload
    ? normalizeDeloadVolumeFactor(input.volumeFactor, policy)
    : 1;

  return {
    weekInBlock,
    blockNumber: Math.ceil(currentWeek / mesocycleLength),
    isDeload,
    isLoadingPeak: weekInBlock === mesocycleLength - 1 && !isDeload,
    volumeFactor,
    blockMultiplier,
    effectivePhase: phase === 'taper' ? 'taper' : (isDeload ? 'deload' : phase),
    rationale: isDeload
      ? `Deload week: reduce total volume to about ${Math.round(volumeFactor * 100)}% while preserving easy movement quality.`
      : 'Loading week: progress only when completion, recovery, and readiness support it.',
  };
}
