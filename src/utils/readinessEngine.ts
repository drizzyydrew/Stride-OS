// ─── Readiness Engine ─────────────────────────────────────────────────────────
//
// Pure scoring over ReadinessTestResult[] (+ linked MovementAnalysis records)
// producing DomainResult[], a conservative overall category, mobility
// recommendations, gentle training-modification suggestions, and key
// findings. No I/O — screens handle persistence via movementStore.
//
// Evidence contract: docs/movement-readiness-evidence.md. Every note stays
// within that document's language ceiling ("may affect", "worth monitoring",
// "consider addressing") and the recommendation mapping table there is the
// single source of truth for domain → mobility workout id.

import type { MovementAnalysis } from '../types/movement';
import { repConsistency } from './poseSequence';
import type {
  DomainResult,
  ReadinessAssessment,
  ReadinessCategory,
  ReadinessDomain,
  ReadinessTestId,
  ReadinessTestResult,
} from '../types/movementReadiness';

// ─── Small helpers ────────────────────────────────────────────────────────────

function avg(values: (number | undefined)[]): number | undefined {
  const nums = values.filter((v): v is number => v !== undefined && Number.isFinite(v));
  if (nums.length === 0) return undefined;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function getTest(results: ReadinessTestResult[], id: ReadinessTestId): ReadinessTestResult | undefined {
  return results.find(r => r.testId === id && !r.skipped);
}

function findAnalysis(analyses: MovementAnalysis[], id: string | undefined): MovementAnalysis | undefined {
  return id ? analyses.find(a => a.id === id) : undefined;
}

function numberValue(v: number | string | boolean | undefined): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function boolValue(v: number | string | boolean | undefined): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

// ─── Domain: ankle_mobility (knee-to-wall, cm, per side) ─────────────────────

const KNEE_TO_WALL_ASYMMETRY_CM = 2.5;
const KNEE_TO_WALL_LOW_CM       = 4;

function scoreAnkleMobility(results: ReadinessTestResult[]): DomainResult | null {
  const left  = getTest(results, 'knee_to_wall_left');
  const right = getTest(results, 'knee_to_wall_right');
  if (!left && !right) return null;

  const l = numberValue(left?.manualValues?.cm);
  const r = numberValue(right?.manualValues?.cm);

  if (l === undefined && r === undefined) {
    return {
      domain: 'ankle_mobility', category: 'manual_review', confidence: 'low',
      note: "Knee-to-wall distance wasn't entered for either side — complete this test for an ankle-mobility read.",
    };
  }

  const values = [l, r].filter((v): v is number => v !== undefined);
  const asymmetry = l !== undefined && r !== undefined ? Math.abs(l - r) : undefined;
  const bothLow = values.length === 2 && values.every(v => v < KNEE_TO_WALL_LOW_CM);

  let category: ReadinessCategory = 'good';
  const notes: string[] = [];

  if (asymmetry !== undefined && asymmetry > KNEE_TO_WALL_ASYMMETRY_CM) {
    category = 'monitor';
    notes.push(`Left/right knee-to-wall distance differs by about ${asymmetry.toFixed(1)} cm — worth monitoring.`);
  } else if (asymmetry !== undefined) {
    notes.push('Left/right knee-to-wall distance is close — differences this small are within measurement noise.');
  }

  if (bothLow) {
    category = asymmetry !== undefined && asymmetry > KNEE_TO_WALL_ASYMMETRY_CM ? 'needs_attention' : 'monitor';
    notes.push('Both sides measured low, which may affect squat depth and landing mechanics; consider addressing with ankle mobility work.');
  } else if (values.some(v => v < KNEE_TO_WALL_LOW_CM) && category === 'good') {
    category = 'monitor';
    notes.push('One side measured low for knee-to-wall distance — worth monitoring.');
  }

  return {
    domain: 'ankle_mobility',
    category,
    leftValue: l, rightValue: r, unit: 'cm',
    confidence: values.length === 2 ? 'high' : 'moderate',
    note: notes.join(' ') || 'Ankle mobility looks even side to side on this screen.',
  };
}

// ─── Domain: calf_capacity (single-leg heel raise, reps, per side) ───────────

const HEEL_RAISE_LOW_COUNT     = 15;
const HEEL_RAISE_ASYMMETRY_PCT = 0.25;

function scoreCalfCapacity(results: ReadinessTestResult[]): DomainResult | null {
  const left  = getTest(results, 'heel_raise_left');
  const right = getTest(results, 'heel_raise_right');
  if (!left && !right) return null;

  const l = numberValue(left?.manualValues?.reps);
  const r = numberValue(right?.manualValues?.reps);

  if (l === undefined && r === undefined) {
    return {
      domain: 'calf_capacity', category: 'manual_review', confidence: 'low',
      note: "Heel-raise counts weren't entered for either side — complete this test for a calf-capacity read.",
    };
  }

  const values = [l, r].filter((v): v is number => v !== undefined);
  const larger = Math.max(...values);
  const asymmetryPct = l !== undefined && r !== undefined && larger > 0 ? Math.abs(l - r) / larger : undefined;

  // Never 'needs_attention' from a single manual capacity count alone.
  let category: ReadinessCategory = 'good';
  const notes: string[] = [];

  if (values.some(v => v < HEEL_RAISE_LOW_COUNT)) {
    category = 'monitor';
    notes.push('One or both sides reached fewer than 15 controlled heel raises, which may affect tolerance for running volume; consider calf capacity work.');
  }
  if (asymmetryPct !== undefined && asymmetryPct >= HEEL_RAISE_ASYMMETRY_PCT) {
    category = 'monitor';
    notes.push(`Left/right heel-raise counts differ by about ${Math.round(asymmetryPct * 100)}% — worth monitoring.`);
  }
  if (notes.length === 0) notes.push('Calf capacity looks solid on this single-leg heel-raise check.');

  return {
    domain: 'calf_capacity', category,
    leftValue: l, rightValue: r, unit: 'reps',
    confidence: values.length === 2 ? 'moderate' : 'low',
    note: notes.join(' '),
  };
}

// ─── Domain: single_leg_control + trunk_pelvic_control (checklist) ───────────
//
// Evidence doc: contralateral pelvic drop / single-leg quality is a "worth
// monitoring" finding only (case-control, not prospective evidence) — this
// domain is capped at 'monitor', never escalated to 'needs_attention'.

function scoreSingleLegControl(results: ReadinessTestResult[]): DomainResult | null {
  const test = getTest(results, 'single_leg_squat');
  if (!test) return null;

  const kneeTracks = boolValue(test.manualValues?.kneeTracksOverFoot);
  if (kneeTracks === undefined) {
    return {
      domain: 'single_leg_control', category: 'manual_review', confidence: 'low',
      note: "Single-leg squat quality wasn't recorded — complete the checklist for a single-leg-control read.",
    };
  }

  return {
    domain: 'single_leg_control',
    category: kneeTracks ? 'good' : 'monitor',
    confidence: 'low',
    note: kneeTracks
      ? 'The knee tracked over the foot on the single-leg squat check.'
      : 'The knee drifted inward on the single-leg squat check — an associative observation, worth monitoring, not a diagnosis.',
  };
}

function scoreTrunkPelvicControl(results: ReadinessTestResult[]): DomainResult | null {
  const test = getTest(results, 'single_leg_squat');
  if (!test) return null;

  const pelvisLevel = boolValue(test.manualValues?.pelvisLevel);
  const trunkSteady = boolValue(test.manualValues?.trunkSteady);
  if (pelvisLevel === undefined && trunkSteady === undefined) {
    return {
      domain: 'trunk_pelvic_control', category: 'manual_review', confidence: 'low',
      note: "Pelvis/trunk control wasn't recorded on the single-leg squat check.",
    };
  }

  const failedCount = [pelvisLevel, trunkSteady].filter(v => v === false).length;
  return {
    domain: 'trunk_pelvic_control',
    category: failedCount > 0 ? 'monitor' : 'good',
    confidence: 'low',
    note: failedCount > 0
      ? 'Pelvis or trunk position shifted during the single-leg squat check — worth monitoring; trunk/pelvic control observations are associative, not diagnostic.'
      : 'Pelvis stayed level and trunk stayed steady on the single-leg squat check.',
  };
}

// ─── Domain: squat_pattern (video, side view) ────────────────────────────────

function scoreSquatPattern(results: ReadinessTestResult[], analyses: MovementAnalysis[]): DomainResult | null {
  const test = getTest(results, 'squat_side');
  if (!test) return null;

  const analysis = findAnalysis(analyses, test.analysisId);
  if (!analysis) {
    return {
      domain: 'squat_pattern', category: 'manual_review', confidence: 'low',
      note: "Squat video wasn't linked to an analysis — retake this test for a squat-pattern read.",
    };
  }

  const seqConf = analysis.sequenceConfidence ?? analysis.confidence;
  const reps = analysis.repSummaries ?? [];
  if (seqConf === 'manual_review' || reps.length === 0) {
    return {
      domain: 'squat_pattern', category: 'manual_review', confidence: 'low',
      note: "Squat video didn't yield confident rep detection — try a clearer side-view clip, or review it manually.",
    };
  }

  const avgDepth = avg(reps.map(r => r.peakFlexionDeg)) ?? 0;
  const consistency = repConsistency(reps);
  const trunkAtBottom = avg(reps.map(r => r.trunkAngleAtBottom));

  let category: ReadinessCategory = 'good';
  const notes: string[] = [];

  if (avgDepth < 90) {
    category = 'monitor';
    notes.push('Average squat depth looked shallower than typical parallel depth in this clip — may reflect ankle or hip mobility limits, worth monitoring.');
  }
  if (consistency !== undefined && consistency > 15) {
    category = 'monitor';
    notes.push('Rep-to-rep depth varied noticeably across the set — worth monitoring for control or fatigue.');
  }
  if (trunkAtBottom !== undefined && trunkAtBottom > 45) {
    category = 'monitor';
    notes.push('Trunk lean at the bottom of the squat was pronounced — may reflect limited ankle dorsiflexion; consider addressing with mobility work.');
  }
  if (notes.length === 0) notes.push('Squat depth, trunk position, and rep consistency all looked within a typical range in this clip.');

  return {
    domain: 'squat_pattern', category,
    confidence: seqConf === 'high' ? 'high' : seqConf === 'moderate' ? 'moderate' : 'low',
    note: notes.join(' '),
  };
}

// ─── Domain: hip_mobility (split-stance lunge video, side view) ─────────────
//
// No validated hip-extension screen exists from 2D single-camera video (see
// docs/movement-readiness-evidence.md) — this stays deliberately rough:
// confidence is capped at 'moderate' even on a clean, high-confidence clip.

function scoreHipMobility(results: ReadinessTestResult[], analyses: MovementAnalysis[]): DomainResult | null {
  const test = getTest(results, 'split_stance_lunge');
  if (!test) return null;

  const analysis = findAnalysis(analyses, test.analysisId);
  if (!analysis) {
    return {
      domain: 'hip_mobility', category: 'manual_review', confidence: 'low',
      note: "Split-stance lunge wasn't linked to an analysis — retake this test for a hip-mobility read.",
    };
  }

  const seqConf = analysis.sequenceConfidence ?? analysis.confidence;
  const reps = analysis.repSummaries ?? [];
  if (seqConf === 'manual_review' || reps.length === 0) {
    return {
      domain: 'hip_mobility', category: 'manual_review', confidence: 'low',
      note: "Lunge video didn't yield confident rep detection — try a clearer side-view clip, or review it manually.",
    };
  }

  const trunkAtBottom = avg(reps.map(r => r.trunkAngleAtBottom));
  let category: ReadinessCategory = 'good';
  const notes: string[] = [];

  if (trunkAtBottom !== undefined && trunkAtBottom > 20) {
    category = 'monitor';
    notes.push('Trunk lean at the bottom of the lunge was pronounced, which may affect stride mechanics behind the body; consider hip mobility work.');
  } else {
    notes.push('Trunk position stayed fairly upright through the lunge in this clip.');
  }

  return {
    domain: 'hip_mobility', category,
    confidence: seqConf === 'high' ? 'moderate' : 'low',
    note: notes.join(' '),
  };
}

// ─── Domain: symmetry (optional gait video, side view) ───────────────────────

function scoreSymmetry(results: ReadinessTestResult[], analyses: MovementAnalysis[]): DomainResult | null {
  const test = getTest(results, 'gait_side_view');
  if (!test) return null;

  const analysis = findAnalysis(analyses, test.analysisId);
  const estimate = analysis?.symmetryEstimates?.[0];
  if (!analysis || !estimate) {
    return {
      domain: 'symmetry', category: 'manual_review', confidence: 'low',
      note: "Gait video didn't produce a confident left/right comparison — try a clearer side-view clip showing both legs.",
    };
  }

  return {
    domain: 'symmetry',
    category: estimate.withinNoise ? 'good' : 'monitor',
    leftValue: estimate.leftValue, rightValue: estimate.rightValue,
    confidence: (analysis.sequenceConfidence ?? analysis.confidence) === 'high' ? 'moderate' : 'low',
    note: estimate.note,
  };
}

// ─── Domain: capture_quality (aggregate across captured tests) ──────────────

function scoreCaptureQuality(results: ReadinessTestResult[]): DomainResult {
  const withRating = results.filter(r => !r.skipped && r.captureRating);
  if (withRating.length === 0) {
    return {
      domain: 'capture_quality', category: 'manual_review', confidence: 'low',
      note: 'No video or photo capture-quality data is available for this assessment.',
    };
  }

  const poorCount = withRating.filter(r => r.captureRating === 'poor').length;
  const fairCount = withRating.filter(r => r.captureRating === 'fair').length;
  const category: ReadinessCategory = poorCount > 0 ? 'manual_review' : fairCount > 0 ? 'monitor' : 'good';

  const note = poorCount > 0
    ? `${poorCount} of ${withRating.length} captured test${withRating.length === 1 ? '' : 's'} had capture-quality issues — those findings carry lower confidence and are worth a manual look.`
    : fairCount > 0
      ? `${fairCount} of ${withRating.length} captured test${withRating.length === 1 ? '' : 's'} had minor capture-quality issues.`
      : 'All captured tests met good capture-quality guidelines.';

  return { domain: 'capture_quality', category, confidence: poorCount > 0 ? 'low' : 'high', note };
}

// ─── scoreDomains ─────────────────────────────────────────────────────────────

export function scoreDomains(testResults: ReadinessTestResult[], analyses: MovementAnalysis[]): DomainResult[] {
  const domains = [
    scoreAnkleMobility(testResults),
    scoreHipMobility(testResults, analyses),
    scoreSquatPattern(testResults, analyses),
    scoreSingleLegControl(testResults),
    scoreCalfCapacity(testResults),
    scoreTrunkPelvicControl(testResults),
    scoreSymmetry(testResults, analyses),
    scoreCaptureQuality(testResults),
  ];
  return domains.filter((d): d is DomainResult => d !== null);
}

// ─── deriveOverall ────────────────────────────────────────────────────────────
//
// Conservative by construction: missing or low-confidence data always
// degrades toward 'manual_review', never toward 'needs_attention'.

export function deriveOverall(domains: DomainResult[]): ReadinessCategory {
  if (domains.length === 0) return 'manual_review';

  const hasNeedsAttention = domains.some(d => d.category === 'needs_attention');
  const hasManualReview   = domains.some(d => d.category === 'manual_review');
  const hasMonitor        = domains.some(d => d.category === 'monitor');
  const lowConfidenceCount = domains.filter(d => d.confidence === 'low').length;

  if (hasNeedsAttention) {
    // A genuine "needs attention" signal only carries through to the overall
    // category when enough of the rest of the assessment is confident data —
    // otherwise a thin assessment surfaces manual review instead.
    const confidentEnough = domains.filter(d => d.confidence !== 'low').length >= Math.ceil(domains.length / 2);
    return confidentEnough ? 'needs_attention' : 'manual_review';
  }
  if (hasManualReview || lowConfidenceCount > domains.length / 2) return 'manual_review';
  if (hasMonitor) return 'monitor';
  return 'good';
}

// ─── buildRecommendations ─────────────────────────────────────────────────────
//
// Mapping table: docs/movement-readiness-evidence.md
// ("Recommendation mapping (assessment → mobility)"). Ids read from
// src/constants/mobilityBank.ts.

const DOMAIN_TO_WORKOUT_ID: Partial<Record<ReadinessDomain, string>> = {
  ankle_mobility:       'ankle_dorsiflexion_routine',
  hip_mobility:         'hip_extension_mobility',
  single_leg_control:   'single_leg_control_prep',
  calf_capacity:        'calf_soleus_mobility_and_capacity',
  trunk_pelvic_control: 'hip_control_and_mobility',
};

export function buildRecommendations(domains: DomainResult[]): string[] {
  const ids: string[] = [];
  for (const d of domains) {
    if (d.category !== 'monitor' && d.category !== 'needs_attention') continue;
    const workoutId = DOMAIN_TO_WORKOUT_ID[d.domain];
    if (workoutId && !ids.includes(workoutId)) ids.push(workoutId);
  }
  return ids;
}

// ─── buildTrainingModifications ──────────────────────────────────────────────
//
// At most 2-3 gentle suggestions. Never "reduce because injury risk" — always
// framed as sequencing / pairing training with the recommended work.

export function buildTrainingModifications(domains: DomainResult[]): string[] {
  const flagged = domains.filter(d => d.category === 'monitor' || d.category === 'needs_attention');
  const has = (domain: ReadinessDomain) => flagged.some(d => d.domain === domain);
  const suggestions: string[] = [];

  if (has('ankle_mobility')) {
    suggestions.push('Consider keeping run volume steady while you address ankle mobility, rather than adding volume and intensity at the same time.');
  }
  if (has('calf_capacity')) {
    suggestions.push('Consider easing into any big jump in hill work or speed work until calf capacity work has had a few weeks to build.');
  }
  if (has('hip_mobility') || has('trunk_pelvic_control') || has('single_leg_control')) {
    suggestions.push('Consider pairing easy-to-moderate runs with the recommended mobility/control work rather than changing your run plan outright.');
  }
  if (has('squat_pattern')) {
    suggestions.push('Consider keeping strength-training loads steady while squat pattern and mobility work are dialed in.');
  }

  return suggestions.slice(0, 3);
}

// ─── buildKeyFindings ─────────────────────────────────────────────────────────

export function buildKeyFindings(domains: DomainResult[]): string[] {
  return domains
    .filter(d => d.category === 'monitor' || d.category === 'needs_attention')
    .map(d => d.note)
    .slice(0, 6);
}

// ─── buildCaptureQualitySummary ───────────────────────────────────────────────

export function buildCaptureQualitySummary(domains: DomainResult[]): string {
  return domains.find(d => d.domain === 'capture_quality')?.note
    ?? 'No capture-quality data is available for this assessment.';
}

// ─── assessReadiness ──────────────────────────────────────────────────────────
//
// One-call convenience wrapper combining the pure steps above — what the
// readiness-test screen calls after the last step completes.

export function assessReadiness(
  activityFocus: 'running' | 'walking',
  testResults:   ReadinessTestResult[],
  analyses:      MovementAnalysis[],
  painReported?: boolean,
): Omit<ReadinessAssessment, 'id' | 'createdAt' | 'updatedAt'> {
  const domainResults = scoreDomains(testResults, analyses);
  return {
    activityFocus,
    testResults,
    domainResults,
    overall: deriveOverall(domainResults),
    keyFindings: buildKeyFindings(domainResults),
    recommendedMobilityWorkoutIds: buildRecommendations(domainResults),
    trainingModificationSuggestions: buildTrainingModifications(domainResults),
    captureQualitySummary: buildCaptureQualitySummary(domainResults),
    evidenceVersion: 1,
    painReported: painReported || undefined,
  };
}
