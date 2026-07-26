// ─── Completion substitution rules ─────────────────────────────────────────
//
// Decides how a completed activity relates to what was scheduled, when the
// two don't match exactly (different activity, or a materially-altered
// preset). Never auto-classifies a mismatch as `completed_as_prescribed` —
// that classification is reserved for the exact-match path elsewhere
// (buildManualActivityDraft's default). This module only runs when the
// caller already knows there's a substitution question to answer.

import type { CompletionClassification } from '../types/activity';

export type SubstitutionCategory =
  | 'run'
  | 'run_walk'
  | 'walk'
  | 'cycling'
  | 'strength'
  | 'mobility'
  | 'active_recovery'
  | 'cross_train'
  | 'swim'
  | 'hiking'
  | 'other';

export type ClassifySubstitutionInput = {
  scheduledCategory: SubstitutionCategory;
  scheduledSubtype?: string;   // e.g. 'easy' | 'intervals' | 'long' for runs
  actualActivityType?: string; // raw ActivityType, informational/passthrough
  actualCategory: SubstitutionCategory;
  actualSubtype?: string;
  // True when the athlete's actual session shares the scheduled session's
  // training intent (e.g. same upper/lower/full-body emphasis, or "easy
  // effort" matching "easy effort"). Callers decide this — the matrix below
  // only decides what classification that intent match implies.
  intentMatch?: boolean;
  // Set when the live session was launched from a preset and then
  // meaningfully altered (exercises/sets changed) before finishing.
  startedFromPreset?: boolean;
  presetAltered?: boolean;
  // Set once the athlete has confirmed a gated cross-domain substitution via
  // the "Count toward scheduled workout as substitute" chooser.
  explicitlyAccepted?: boolean;
  // The athlete picked a classification directly (e.g. a manual-entry
  // classification selector) — always wins over the matrix below.
  explicitOverrideClassification?: CompletionClassification;
};

export type ClassifySubstitutionResult = {
  classification: CompletionClassification;
  satisfiesIntent: boolean;
  // True when this pairing needs an explicit athlete confirmation before it
  // can count toward the scheduled session at all (e.g. running -> cycling).
  // The UI should show the chooser; `explicitlyAccepted` on a follow-up call
  // resolves it once the athlete answers.
  requiresExplicitAcceptance: boolean;
};

// Classifications that mean "this counted, and it satisfied what was asked."
const INTENT_SATISFIED: ReadonlySet<CompletionClassification> = new Set([
  'completed_as_prescribed', 'modified', 'equivalent_substitute',
]);

export function classificationSatisfiesIntent(classification: CompletionClassification): boolean {
  return INTENT_SATISFIED.has(classification);
}

// Cross-domain pairs that require the athlete to explicitly confirm the
// substitution before it counts toward the scheduled session — never
// auto-accepted, per the "running -> cycling only when explicitly accepted"
// rule. Deliberately narrow (only the aerobic-modality-swap case the brief
// calls out) rather than gating every cross-domain mismatch.
const GATED_CROSS_DOMAIN_PAIRS: ReadonlySet<string> = new Set([
  'run:cycling', 'cycling:run',
  'run:cross_train', 'run_walk:cycling', 'cycling:run_walk',
]);

function pairKey(a: SubstitutionCategory, b: SubstitutionCategory): string {
  return `${a}:${b}`;
}

// ─── Category mapping helpers ───────────────────────────────────────────────
//
// Shared by every call site that needs to turn a scheduled session's raw
// CalendarEntry['type'] or a logged Activity's ActivityType into the
// SubstitutionCategory this matrix reasons about — kept in one place so the
// mapping can't drift between the manual-entry screen and custom-session.tsx.

export function categoryFromScheduledType(calendarType: string | undefined): SubstitutionCategory {
  switch (calendarType) {
    case 'run': return 'run';
    case 'run_walk': return 'run_walk';
    case 'walk': return 'walk';
    case 'cycling': return 'cycling';
    case 'strength': return 'strength';
    case 'mobility': return 'mobility';
    case 'rest': return 'active_recovery';
    case 'hiit':
    case 'mixed': return 'cross_train';
    case 'swimming': return 'swim';
    case 'hiking': return 'hiking';
    default: return 'other';
  }
}

export function categoryFromActivityType(activityType: string, subtype?: string): SubstitutionCategory {
  switch (activityType) {
    case 'running': return subtype === 'run_walk' ? 'run_walk' : 'run';
    case 'walking': return 'walk';
    case 'cycling':
    case 'indoor_cycling': return 'cycling';
    case 'strength': return 'strength';
    case 'mobility': return 'mobility';
    case 'swimming': return 'swim';
    case 'hiking': return 'hiking';
    case 'hiit':
    case 'mixed_modal': return 'cross_train';
    default: return 'other';
  }
}

export function classifySubstitution(input: ClassifySubstitutionInput): ClassifySubstitutionResult {
  // 1. An explicit athlete choice always wins — nothing below overrides it.
  if (input.explicitOverrideClassification) {
    return {
      classification: input.explicitOverrideClassification,
      satisfiesIntent: classificationSatisfiesIntent(input.explicitOverrideClassification),
      requiresExplicitAcceptance: false,
    };
  }

  const sameDomain = input.scheduledCategory === input.actualCategory;

  // 2. Active recovery -> an easy walk or gentle cycle is what active
  // recovery IS, not a substitution question — always equivalent.
  if (input.scheduledCategory === 'active_recovery'
    && (input.actualCategory === 'walk'
      || (input.actualCategory === 'cycling' && (input.actualSubtype ?? 'easy') !== 'hard'))) {
    return { classification: 'equivalent_substitute', satisfiesIntent: true, requiresExplicitAcceptance: false };
  }

  // 3. Gated cross-domain modality swap (e.g. running -> cycling) — never
  // auto-counts; requires explicit athlete confirmation.
  if (GATED_CROSS_DOMAIN_PAIRS.has(pairKey(input.scheduledCategory, input.actualCategory))) {
    if (!input.explicitlyAccepted) {
      return { classification: 'completed_other_activity', satisfiesIntent: false, requiresExplicitAcceptance: true };
    }
    return { classification: 'equivalent_substitute', satisfiesIntent: true, requiresExplicitAcceptance: true };
  }

  // 4. Easy run scheduled, hard/interval run actually performed — never
  // auto-classifies as prescribed even though both are "a run"; only counts
  // as intended when the athlete explicitly marks it (handled by branch 1).
  if (sameDomain && input.scheduledCategory === 'run') {
    const scheduledEasy = input.scheduledSubtype === 'easy' || input.scheduledSubtype === 'recovery';
    const actualHard = input.actualSubtype === 'intervals' || input.actualSubtype === 'hard' || input.actualSubtype === 'race_pace';
    if (scheduledEasy && actualHard) {
      return { classification: 'completed_other_activity', satisfiesIntent: false, requiresExplicitAcceptance: false };
    }
  }

  // 5. Same strength category, matching training intent (e.g. upper ->
  // upper custom workout) -> equivalent, or 'modified' when it started from
  // a preset that was then meaningfully altered.
  if (sameDomain && input.scheduledCategory === 'strength') {
    if (input.intentMatch) {
      const classification: CompletionClassification = input.startedFromPreset && input.presetAltered
        ? 'modified'
        : 'equivalent_substitute';
      return { classification, satisfiesIntent: true, requiresExplicitAcceptance: false };
    }
    return { classification: 'completed_other_activity', satisfiesIntent: false, requiresExplicitAcceptance: false };
  }

  // 6. Generic same-domain fallback (e.g. mobility -> mobility with
  // different exercises still satisfies intent).
  if (sameDomain) {
    return {
      classification: input.intentMatch ? 'equivalent_substitute' : 'completed_other_activity',
      satisfiesIntent: Boolean(input.intentMatch),
      requiresExplicitAcceptance: false,
    };
  }

  // 7. Cross-domain, not one of the gated pairs above (e.g. strength done
  // instead of a scheduled mobility session) — recorded honestly as a
  // different activity, never assumed to satisfy the original intent.
  return { classification: 'completed_other_activity', satisfiesIntent: false, requiresExplicitAcceptance: false };
}
