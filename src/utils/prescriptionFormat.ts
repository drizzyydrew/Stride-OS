import type { RepScheme } from '../types/strength';

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function range(min: number | undefined, max: number | undefined): string {
  if (!finitePositive(min)) return '';
  if (finitePositive(max) && max !== min) return `${min}–${max}`;
  return String(min);
}

function metersLabel(meters: number): string {
  if (meters >= 1000 && meters % 1000 === 0) return `${meters / 1000} km`;
  return `${meters} m`;
}

function secondsLabel(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds}s`;
}

function suffix(perSide?: boolean): string {
  return perSide ? ' per side' : '';
}

export function formatPrescription(scheme: RepScheme | undefined, fallbackReps?: string): string {
  if (!scheme) return fallbackReps ?? '';
  switch (scheme.kind) {
    case 'reps': {
      const label = (scheme.label ?? range(scheme.repsMin, scheme.repsMax)) || (fallbackReps ?? '');
      return `${label}${suffix(scheme.perSide)}`.trim();
    }
    case 'duration':
      return `${secondsLabel(scheme.secondsMin)}${finitePositive(scheme.secondsMax) && scheme.secondsMax !== scheme.secondsMin ? `–${secondsLabel(scheme.secondsMax)}` : ''}${suffix(scheme.perSide)}`;
    case 'distance':
      return `${metersLabel(scheme.metersMin)}${finitePositive(scheme.metersMax) && scheme.metersMax !== scheme.metersMin ? `–${metersLabel(scheme.metersMax)}` : ''}${suffix(scheme.perSide)}`;
    case 'reps_hold':
      return `${range(scheme.repsMin, scheme.repsMax)} reps + ${secondsLabel(scheme.holdSeconds)} hold${suffix(scheme.perSide)}`;
    case 'reps_tempo':
      return `${range(scheme.repsMin, scheme.repsMax)} reps @ ${scheme.tempo}${suffix(scheme.perSide)}`;
  }
}

export function formatPrescriptionWithSets(sets: number, scheme: RepScheme | undefined, fallbackReps?: string): string {
  const safeSets = Math.max(0, Math.round(Number.isFinite(sets) ? sets : 0));
  const prescription = formatPrescription(scheme, fallbackReps);
  return safeSets > 0 && prescription ? `${safeSets} × ${prescription}` : prescription;
}

function firstTwoNumbers(text: string): [number, number | undefined] | null {
  const match = text.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?/i);
  if (!match) return null;
  const first = Number(match[1]);
  const second = match[2] == null ? undefined : Number(match[2]);
  if (!finitePositive(first)) return null;
  return [first, finitePositive(second) ? second : undefined];
}

export function parsePrescriptionScheme(
  raw: string,
  context: { exerciseName?: string; notes?: string; tempo?: string } = {},
): RepScheme | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  const combined = `${context.exerciseName ?? ''} ${text} ${context.notes ?? ''}`.toLowerCase();
  const perSide = /\b(per side|per leg|each side|each leg)\b/.test(combined);
  const numbers = firstTwoNumbers(text);

  if (/\b(amrap|max reps)\b/i.test(text)) return { kind: 'reps', label: text, perSide };

  if (/(?:sec|secs|second|seconds|s)\b/i.test(text) && !/\breps?\b/i.test(text)) {
    if (!numbers) return undefined;
    return { kind: 'duration', secondsMin: numbers[0], secondsMax: numbers[1], perSide };
  }

  if (/(?:m|meter|meters|metre|metres)\b/i.test(text) && !/\bmin\b/i.test(text)) {
    if (!numbers) return undefined;
    return { kind: 'distance', metersMin: numbers[0], metersMax: numbers[1], perSide };
  }

  if (/\bhold|pause\b/i.test(combined) && numbers) {
    const holdMatch = combined.match(/(\d+)\s*(?:sec|secs|second|seconds|s)\s*(?:hold|pause)?|(?:hold|pause)\s*(?:for\s*)?(\d+)\s*(?:sec|secs|second|seconds|s)/i);
    const holdSeconds = Number(holdMatch?.[1] ?? holdMatch?.[2] ?? 2);
    if (finitePositive(holdSeconds)) {
      return { kind: 'reps_hold', repsMin: numbers[0], repsMax: numbers[1], holdSeconds, perSide };
    }
  }

  if (context.tempo && context.tempo !== 'Explosive: fast concentric' && numbers) {
    return { kind: 'reps_tempo', repsMin: numbers[0], repsMax: numbers[1], tempo: context.tempo, perSide };
  }

  if (numbers) return { kind: 'reps', repsMin: numbers[0], repsMax: numbers[1], perSide };
  return { kind: 'reps', label: text, perSide };
}

export type PrescriptionCategory =
  | 'static_stretch'
  | 'isometric'
  | 'dynamic_mobility'
  | 'strength'
  | 'carry'
  | 'balance'
  | 'plyometric'
  | 'aerobic_warmup'
  | 'loaded_strength_warmup'
  | 'bodyweight_warmup';

export type PrescriptionValidationResult = {
  valid: boolean;
  issues: string[];
};

export function validatePrescriptionForCategory(
  category: PrescriptionCategory,
  scheme: RepScheme | undefined,
  context: { loadTarget?: string; tempo?: string; exerciseName?: string } = {},
): PrescriptionValidationResult {
  const issues: string[] = [];
  const loadTarget = context.loadTarget?.toLowerCase() ?? '';
  const tempo = context.tempo?.toLowerCase() ?? '';

  if (category === 'static_stretch') {
    if (!scheme || scheme.kind !== 'duration') issues.push('static stretch must use a timed hold prescription');
    if (scheme?.kind === 'reps' || scheme?.kind === 'reps_hold' || scheme?.kind === 'reps_tempo') issues.push('static stretch must not be rendered as repetitions');
    if (scheme?.kind === 'reps_tempo' || /\d+\s*:\s*\d+\s*:\s*\d+/.test(tempo)) issues.push('static stretch must not use strength tempo');
    if (/bodyweight|%|1rm|working/i.test(loadTarget)) issues.push('static stretch must not use load progression');
  }

  if (category === 'isometric') {
    if (!scheme || (scheme.kind !== 'duration' && scheme.kind !== 'reps_hold')) issues.push('isometric work must include hold duration');
    if (scheme?.kind === 'reps_tempo') issues.push('isometric holds must not use strength tempo');
  }

  if (category === 'carry' && (!scheme || scheme.kind !== 'distance')) {
    issues.push('carry must specify distance or duration');
  }

  if (category === 'balance') {
    if (!scheme || scheme.kind !== 'duration') issues.push('balance work must be rendered as a hold, not repetitions');
  }

  if (category === 'bodyweight_warmup' && /%|1rm|working/.test(loadTarget)) {
    issues.push('bodyweight warm-up must not show percentage loading');
  }

  if (category === 'loaded_strength_warmup' && /%/.test(loadTarget) && !/(1rm|working|training max|estimated)/.test(loadTarget)) {
    issues.push('percentage warm-up loading must name its load basis');
  }

  return { valid: issues.length === 0, issues };
}

export function representativeRepsForScheme(scheme: RepScheme | undefined, fallbackReps?: string): number | undefined {
  if (!scheme) return firstTwoNumbers(fallbackReps ?? '')?.[0];
  if (scheme.kind === 'duration' || scheme.kind === 'distance') return undefined;
  return scheme.repsMin;
}

export function representativeSecondsForScheme(scheme: RepScheme | undefined, fallbackReps?: string): number | undefined {
  if (scheme?.kind === 'duration') return scheme.secondsMin;
  const fallback = parsePrescriptionScheme(fallbackReps ?? '');
  return fallback?.kind === 'duration' ? fallback.secondsMin : undefined;
}

export function representativeDistanceMetersForScheme(scheme: RepScheme | undefined, fallbackReps?: string): number | undefined {
  if (scheme?.kind === 'distance') return scheme.metersMin;
  const fallback = parsePrescriptionScheme(fallbackReps ?? '');
  return fallback?.kind === 'distance' ? fallback.metersMin : undefined;
}
