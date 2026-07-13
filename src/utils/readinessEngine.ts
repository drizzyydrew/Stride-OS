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

import type { AngleSeries, MovementAnalysis } from '../types/movement';
import { repConsistency } from './poseSequence';
import { FRONTAL_METRIC_NAMES } from './poseAngles';
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

// ─── Domain: single_leg_control + trunk_pelvic_control ───────────────────────
//
// Evidence doc: contralateral pelvic drop / single-leg quality is a "worth
// monitoring" finding only (case-control, not prospective evidence) — this
// domain is capped at 'monitor', never escalated to 'needs_attention'.
//
// Build 36: scored automatically first from the linked FRONTAL analysis
// (pelvic obliquity excursion, frontal-plane knee position, trunk lateral lean)
// when detection confidence supports it. Manual checklist answers act as a
// confirm / override on top. Missing or low-confidence data degrades to
// manual_review — never fabricated.

/** Peak-to-trough excursion of a series' confidently-detected values. */
function seriesExcursion(series: AngleSeries | undefined): number | undefined {
  if (!series) return undefined;
  const vals = series.points.map(p => p.degrees).filter((d): d is number => d !== null);
  if (vals.length < 3) return undefined;
  return Math.max(...vals) - Math.min(...vals);
}

function findFrontalSeries(analysis: MovementAnalysis, name: string, side: AngleSeries['side']): AngleSeries | undefined {
  return (analysis.angleSeries ?? []).find(s => s.name === name && s.side === side);
}

// Conservative excursion thresholds (estimates from 2D video, not clinical).
const PELVIC_OBLIQUITY_EXCURSION_DEG = 8;
const FRONTAL_KNEE_EXCURSION_PCT     = 12;
const TRUNK_LATERAL_LEAN_EXCURSION_DEG = 8;

function scoreSingleLegControl(results: ReadinessTestResult[], analyses: MovementAnalysis[]): DomainResult | null {
  const test = getTest(results, 'single_leg_squat');
  if (!test) return null;

  const analysis = findAnalysis(analyses, test.analysisId);
  const kneeTracks = boolValue(test.manualValues?.kneeTracksOverFoot);
  const reviewStatus = typeof test.manualValues?.reviewStatus === 'string'
    ? test.manualValues.reviewStatus
    : undefined;

  if (reviewStatus === 'unclear') {
    return {
      domain: 'single_leg_control', category: 'manual_review', confidence: 'low',
      note: 'The athlete marked the automatic single-leg estimate as unclear. Review the frontal clip manually before using this result.',
    };
  }

  // ── Automatic pass from the linked frontal analysis ──────────────────────
  let autoCategory: ReadinessCategory | undefined;
  let autoConfidence: 'high' | 'moderate' | 'low' | undefined;
  const autoNotes: string[] = [];

  if (analysis && reviewStatus !== 'overridden') {
    const seqConf = analysis.sequenceConfidence ?? analysis.confidence;
    const pelvis = seriesExcursion(findFrontalSeries(analysis, FRONTAL_METRIC_NAMES.pelvicObliquity, 'center'));
    const kneeL  = seriesExcursion(findFrontalSeries(analysis, FRONTAL_METRIC_NAMES.frontalKnee, 'left'));
    const kneeR  = seriesExcursion(findFrontalSeries(analysis, FRONTAL_METRIC_NAMES.frontalKnee, 'right'));
    const trunk  = seriesExcursion(findFrontalSeries(analysis, FRONTAL_METRIC_NAMES.trunkLateralLean, 'center'));
    const kneeMax = [kneeL, kneeR].filter((v): v is number => v !== undefined);
    const hasAnyMetric = pelvis !== undefined || kneeMax.length > 0 || trunk !== undefined;

    if (seqConf !== 'manual_review' && hasAnyMetric) {
      autoCategory = 'good';
      if (pelvis !== undefined && pelvis > PELVIC_OBLIQUITY_EXCURSION_DEG) {
        autoCategory = 'monitor';
        autoNotes.push(`Estimated pelvic obliquity swung about ${Math.round(pelvis)}° through the movement — worth monitoring.`);
      }
      if (kneeMax.length > 0 && Math.max(...kneeMax) > FRONTAL_KNEE_EXCURSION_PCT) {
        autoCategory = 'monitor';
        autoNotes.push('Estimated frontal-plane knee position moved noticeably toward/away from the midline — worth monitoring.');
      }
      if (trunk !== undefined && trunk > TRUNK_LATERAL_LEAN_EXCURSION_DEG) {
        autoCategory = 'monitor';
        autoNotes.push(`Estimated side-to-side trunk lean varied about ${Math.round(trunk)}° — worth monitoring.`);
      }
      if (autoNotes.length === 0) autoNotes.push('Estimated pelvic control, frontal knee position, and trunk lean all stayed within a modest range on the frontal clip.');
      autoConfidence = seqConf === 'high' ? 'moderate' : 'low';   // capped: 2D estimate
    }
  }

  // ── Manual confirm / override ────────────────────────────────────────────
  if (autoCategory) {
    let category = autoCategory;
    const notes = [...autoNotes];
    if (kneeTracks === false) {
      category = 'monitor';   // manual override escalates (capped at monitor)
      notes.push('Manual review noted the knee drifting inward — associative, worth monitoring, not a diagnosis.');
    } else if (kneeTracks === true && category === 'monitor') {
      notes.push('Manual review confirmed the knee tracked over the foot; the automated estimate is kept as the more cautious read.');
    }
    return {
      domain: 'single_leg_control', category, confidence: autoConfidence ?? 'low',
      note: notes.join(' '),
    };
  }

  // ── Manual-only fallback ─────────────────────────────────────────────────
  if (kneeTracks === undefined) {
    return {
      domain: 'single_leg_control', category: 'manual_review', confidence: 'low',
      note: "Single-leg control wasn't captured with enough confidence and wasn't recorded manually — review the frontal clip or complete the checklist.",
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
    scoreSingleLegControl(testResults, analyses),
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
  symptom?:      { intensity?: number; location?: string; notes?: string },
): Omit<ReadinessAssessment, 'id' | 'createdAt' | 'updatedAt'> {
  const domainResults = scoreDomains(testResults, analyses);

  // Symptom Review (step 7). Stored verbatim, never interpreted or scored — it
  // only implies painReported so the report shows consult-a-clinician messaging.
  // A symptom is meaningful only when the athlete gave an intensity or location.
  const hasSymptom = symptom !== undefined
    && ((typeof symptom.intensity === 'number' && Number.isFinite(symptom.intensity))
      || (typeof symptom.location === 'string' && symptom.location.trim().length > 0));
  const normalizedSymptom = hasSymptom
    ? {
        intensity: typeof symptom!.intensity === 'number' && Number.isFinite(symptom!.intensity) ? symptom!.intensity : 0,
        location:  symptom!.location?.trim() ?? '',
        notes:     symptom!.notes?.trim() ? symptom!.notes.trim() : undefined,
      }
    : undefined;

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
    painReported: (painReported || hasSymptom) || undefined,
    symptom: normalizedSymptom,
  };
}
