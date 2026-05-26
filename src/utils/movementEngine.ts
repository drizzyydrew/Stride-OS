// ─── Movement Engine ─────────────────────────────────────────────────────────
//
// Deterministic utilities for movement finding interpretation, risk flag
// generation, and training interaction. All functions are pure.
//
// AI INTEGRATION HOOK: This is the designated insertion point for future
// computer vision analysis. A pose estimation pipeline (MediaPipe/MoveNet)
// would produce JointAngleEstimate[] and GaitEvent[] automatically, then
// call generateGaitInsights() to produce findings and flags.

import type {
  GaitFinding,
  LiftingFinding,
  MovementRiskFlag,
  MovementRiskFlagType,
  MovementScoreKey,
  FindingSeverity,
  GaitAnalysis,
  LiftingAnalysis,
  JointAngleEstimate,
} from '../types/movement';

// ─── Gait interpretation templates ───────────────────────────────────────────
//
// When a gait analysis field value is notable, generate a suggested finding.
// Each template produces a pre-filled GaitFinding for the coach to review.

type GaitFindingTemplate = {
  finding:        string;
  severity:       FindingSeverity;
  implication?:   string;
  drill?:         string;
  strengthFocus?: string;
  retestNote?:    string;
  riskType?:      MovementRiskFlagType;
  riskScores?:    MovementScoreKey[];
};

export const GAIT_FINDING_TEMPLATES: Record<string, GaitFindingTemplate> = {
  overstride: {
    finding:        'Overstriding at initial contact',
    severity:       'moderate',
    implication:    'Increased braking force and ground reaction stress. Associated with shin, knee, and Achilles injuries.',
    drill:          'Quick cadence drills (180 BPM metronome), A-skips, pop-up drill',
    strengthFocus:  'Hip extension strength (glutes), plantar flexor power',
    retestNote:     'Refilm at same pace after 4–6 weeks of cadence work',
    riskType:       'gait_fault',
    riskScores:     ['running_economy', 'durability'],
  },
  crossover: {
    finding:        'Crossover gait pattern observed',
    severity:       'moderate',
    implication:    'IT band and hip abductor loading. Associated with ITBS and patellofemoral pain.',
    drill:          'Lateral band walks, single-leg balance, wide lane running drill',
    strengthFocus:  'Hip abductors (glute medius), hip external rotators',
    retestNote:     'Refilm with focus line on ground to assess crossing',
    riskType:       'gait_fault',
    riskScores:     ['movement_capacity', 'durability'],
  },
  hip_drop_mild: {
    finding:        'Mild pelvic drop (Trendelenburg sign)',
    severity:       'low',
    implication:    'Indicates relative hip abductor weakness. Can progress to IT band or knee issues.',
    drill:          'Single-leg stance with focus on level pelvis, hip hike exercise',
    strengthFocus:  'Glute medius, hip abductors',
    retestNote:     'Reassess after 6 weeks of hip abductor strengthening',
    riskType:       'strength_deficit',
    riskScores:     ['movement_capacity', 'running_economy'],
  },
  hip_drop_moderate: {
    finding:        'Moderate pelvic drop (contralateral hip drops >5cm)',
    severity:       'moderate',
    implication:    'Significant hip abductor weakness. High risk for IT band syndrome, knee pain, and low back issues.',
    drill:          'Single-leg deadlift, lateral band walks, Copenhagen plank',
    strengthFocus:  'Glute medius, hip abductors, core lateral stability',
    retestNote:     'Refilm every 4 weeks. Stop heavy load if pain increases.',
    riskType:       'strength_deficit',
    riskScores:     ['movement_capacity', 'durability', 'running_economy'],
  },
  hip_drop_severe: {
    finding:        'Severe pelvic drop — clinical assessment recommended',
    severity:       'high',
    implication:    'Significant functional deficit. High injury risk. May need clinical movement assessment.',
    drill:          'Regress to supported hip abductor exercises first',
    strengthFocus:  'Hip abductors, core, and proximal stability',
    retestNote:     'Consult sports physio before returning to high training load',
    riskType:       'strength_deficit',
    riskScores:     ['movement_capacity', 'durability', 'running_economy'],
  },
  knee_valgus_mild: {
    finding:        'Mild knee valgus (dynamic)',
    severity:       'low',
    implication:    'Increased patellofemoral and medial knee stress. Common in fatigue states.',
    drill:          'Single-leg squat with knee tracking cue, lateral band squat',
    strengthFocus:  'Glute medius, VMO, foot intrinsics',
    riskType:       'form_fault',
    riskScores:     ['movement_capacity'],
  },
  knee_valgus_moderate: {
    finding:        'Moderate knee valgus — training modification recommended',
    severity:       'moderate',
    implication:    'Patellofemoral, medial collateral, and ACL stress. Avoid deep fatigue squatting until corrected.',
    drill:          'Box squat with band around knees, step-down with lateral cue, glute bridge with abduction',
    strengthFocus:  'Hip abductors, knee extensors (VMO), single-leg stability',
    retestNote:     'Reassess under load after 4 weeks of focused correction',
    riskType:       'form_fault',
    riskScores:     ['movement_capacity', 'durability'],
  },
  knee_valgus_severe: {
    finding:        'Severe knee valgus — reduce high-impact load immediately',
    severity:       'high',
    implication:    'High risk for patellofemoral syndrome, medial knee injury, and ACL stress. Consult sports physio.',
    drill:          'Regress to seated and supported hip abductor work',
    strengthFocus:  'Hip abductors, glutes, foot/ankle stability',
    retestNote:     'Clinical review before heavy training resumes',
    riskType:       'form_fault',
    riskScores:     ['movement_capacity', 'durability', 'running_economy'],
  },
  low_cadence: {
    finding:        'Below-optimal running cadence (< 160 steps/min)',
    severity:       'low',
    implication:    'Lower cadence often associated with overstriding and increased impact loading.',
    drill:          'Metronome runs at target BPM, cadence-focused strides',
    strengthFocus:  'Hip flexor reactivity, plantar flexor stiffness',
    retestNote:     'Recheck cadence after 3–4 weeks of targeted drills',
    riskType:       'gait_fault',
    riskScores:     ['running_economy'],
  },
};

// ─── Suggest findings from GaitAnalysis fields ────────────────────────────────
//
// Returns pre-filled finding templates based on the gait analysis checklist.
// The coach reviews and edits before saving.

export function suggestGaitFindings(
  gait: GaitAnalysis,
): Omit<GaitFinding, 'id' | 'videoId' | 'createdAt'>[] {
  const suggestions: Omit<GaitFinding, 'id' | 'videoId' | 'createdAt'>[] = [];

  if (gait.overstride === true) {
    const t = GAIT_FINDING_TEMPLATES.overstride;
    suggestions.push({ ...t, confidence: 'moderate' });
  }

  if (gait.crossoverGait === true) {
    const t = GAIT_FINDING_TEMPLATES.crossover;
    suggestions.push({ ...t, confidence: 'moderate' });
  }

  if (gait.hipDrop === 'mild') {
    const t = GAIT_FINDING_TEMPLATES.hip_drop_mild;
    suggestions.push({ ...t, confidence: 'low' });
  } else if (gait.hipDrop === 'moderate') {
    const t = GAIT_FINDING_TEMPLATES.hip_drop_moderate;
    suggestions.push({ ...t, confidence: 'moderate' });
  } else if (gait.hipDrop === 'severe') {
    const t = GAIT_FINDING_TEMPLATES.hip_drop_severe;
    suggestions.push({ ...t, confidence: 'moderate' });
  }

  if (gait.kneeValgus === 'mild') {
    const t = GAIT_FINDING_TEMPLATES.knee_valgus_mild;
    suggestions.push({ ...t, confidence: 'low' });
  } else if (gait.kneeValgus === 'moderate') {
    const t = GAIT_FINDING_TEMPLATES.knee_valgus_moderate;
    suggestions.push({ ...t, confidence: 'moderate' });
  } else if (gait.kneeValgus === 'severe') {
    const t = GAIT_FINDING_TEMPLATES.knee_valgus_severe;
    suggestions.push({ ...t, confidence: 'moderate' });
  }

  if (gait.cadence !== undefined && gait.cadence < 160) {
    const t = GAIT_FINDING_TEMPLATES.low_cadence;
    suggestions.push({ ...t, confidence: 'high' });
  }

  return suggestions;
}

// ─── Lifting finding templates ─────────────────────────────────────────────────

export const LIFTING_TEMPLATES: Record<string, Omit<LiftingFinding, 'id' | 'videoId' | 'createdAt' | 'exercise'>> = {
  knee_valgus: {
    finding:     'Dynamic knee valgus during lift',
    severity:    'moderate',
    confidence:  'moderate',
    implication: 'Increased patellofemoral and knee ligament stress.',
    regression:  'Reduce load 20–30%. Box squat to parallel.',
    cue:         'Drive knees out over little toes.',
    retestNote:  'Reassess at lighter load after 2 weeks of correction.',
  },
  forward_lean: {
    finding:     'Excessive forward trunk lean',
    severity:    'low',
    confidence:  'moderate',
    implication: 'May indicate limited ankle dorsiflexion or hip flexor tightness.',
    regression:  'Heel-elevated goblet squat, ankle mobility work.',
    cue:         'Chest up, elbows pointing forward.',
  },
  poor_depth: {
    finding:     'Depth limited above parallel',
    severity:    'low',
    confidence:  'moderate',
    implication: 'Limits quad and glute recruitment. May reflect hip or ankle restrictions.',
    regression:  'Box squat to target depth, goblet squat for mobility.',
    cue:         'Break at the hips and knees simultaneously.',
  },
  bar_drift: {
    finding:     'Bar drifts forward from body during pull',
    severity:    'moderate',
    confidence:  'moderate',
    implication: 'Increases lumbar moment arm. Associated with lower back strain.',
    regression:  'Romanian deadlift with wall cue to maintain bar path.',
    cue:         'Bar stays in contact with body throughout pull.',
  },
};

// ─── Risk flag generator ───────────────────────────────────────────────────────
//
// Given a finding, generate a corresponding risk flag for the training system.

export function findingToRiskFlag(
  finding: string,
  severity: FindingSeverity,
  type: MovementRiskFlagType,
  affectsScores: MovementScoreKey[],
): Omit<MovementRiskFlag, 'id' | 'videoId' | 'createdAt'> {
  const suggestions: Record<FindingSeverity, string> = {
    high:     'Reduce high-impact training load. Seek sports physio assessment.',
    moderate: 'Address with targeted strength and drill work over 4–6 weeks.',
    low:      'Monitor trend. Add corrective exercises to strength sessions.',
  };

  return {
    sourceFinding: finding,
    type,
    severity,
    affectsScores,
    suggestion:    suggestions[severity],
    active:        true,
  };
}

// ─── Training influence summary ───────────────────────────────────────────────
//
// Returns human-readable coaching notes about how movement findings
// should influence the current training plan. Used by the coach card.

type TrainingInfluence = {
  category: 'caution' | 'modification' | 'focus';
  message:  string;
  source:   string;
};

export function getMovementTrainingInfluences(
  flags: MovementRiskFlag[],
): TrainingInfluence[] {
  const active = flags.filter(f => f.active);
  const influences: TrainingInfluence[] = [];

  const hasHighSeverity = active.some(f => f.severity === 'high');
  const highKneeValgus  = active.some(f =>
    f.type === 'form_fault' && f.severity !== 'low',
  );
  const lowCadence      = active.some(f =>
    f.sourceFinding.toLowerCase().includes('cadence'),
  );
  const overstride      = active.some(f =>
    f.sourceFinding.toLowerCase().includes('overstrid'),
  );

  if (hasHighSeverity) {
    influences.push({
      category: 'caution',
      message:  'High-severity movement finding active. Avoid max-effort lower body loading until addressed.',
      source:   'Movement Lab risk flag',
    });
  }

  if (highKneeValgus) {
    influences.push({
      category: 'modification',
      message:  'Knee valgus finding: substitute deep squat work with single-leg hip hinge and lateral band drills.',
      source:   'Knee valgus flag',
    });
  }

  if (lowCadence || overstride) {
    influences.push({
      category: 'focus',
      message:  'Cadence/stride intervention recommended: add 10-min metronome strides after easy runs.',
      source:   'Gait flag',
    });
  }

  return influences;
}

// ─── Joint angle reference ranges (gait) ─────────────────────────────────────
//
// Based on published normative values from biomechanics literature.
// Not diagnostic. For coaching and trend tracking only.

export type JointAngleNorm = {
  min:     number;
  max:     number;
  optimal: number;
  note:    string;
};

export const GAIT_ANGLE_NORMS: Partial<Record<string, JointAngleNorm>> = {
  trunk_lean:           { min: 0,   max: 10,  optimal: 5,  note: 'Forward lean 3–7° typical for distance running' },
  hip_flexion:          { min: 35,  max: 55,  optimal: 45, note: 'Hip flexion at initial swing (approx.)' },
  hip_extension:        { min: -10, max: 0,   optimal: -5, note: 'Terminal stance hip extension' },
  knee_flexion:         { min: 15,  max: 40,  optimal: 25, note: 'Knee flexion at initial contact — higher = more overstride risk' },
  ankle_dorsiflexion:   { min: 10,  max: 25,  optimal: 18, note: 'Running requires ~15–25° dynamic dorsiflexion' },
  ankle_plantarflexion: { min: 20,  max: 40,  optimal: 30, note: 'Push-off plantarflexion' },
  pelvic_drop:          { min: 0,   max: 5,   optimal: 2,  note: '>5° considered clinically significant drop' },
};

export const LIFTING_ANGLE_NORMS: Partial<Record<string, JointAngleNorm>> = {
  trunk_angle:      { min: 45, max: 90, optimal: 70, note: 'Squat trunk angle (varies with stance)' },
  hip_angle:        { min: 45, max: 90, optimal: 70, note: 'Hip flexion at bottom of squat' },
  knee_angle:       { min: 70, max: 110, optimal: 90, note: 'Knee flexion at squat depth' },
  ankle_angle:      { min: 10, max: 30, optimal: 20, note: 'Ankle dorsiflexion during squat descent' },
  shoulder_angle:   { min: 0,  max: 45, optimal: 20, note: 'Shoulder abduction during overhead press' },
  elbow_angle:      { min: 0,  max: 90, optimal: 45, note: 'Elbow lockout / full extension check' },
};

// ─── Angle assessment ─────────────────────────────────────────────────────────

export type AngleAssessment = {
  withinNorm: boolean;
  note:       string;
};

export function assessJointAngle(
  angleName: string,
  degrees:   number,
  context:   'gait' | 'lifting',
): AngleAssessment {
  const norms = context === 'gait' ? GAIT_ANGLE_NORMS : LIFTING_ANGLE_NORMS;
  const norm  = norms[angleName];
  if (!norm) {
    return { withinNorm: true, note: 'No reference range available' };
  }
  if (degrees < norm.min || degrees > norm.max) {
    return {
      withinNorm: false,
      note: `${degrees}° is outside the ${norm.min}–${norm.max}° reference range. ${norm.note}`,
    };
  }
  return {
    withinNorm: true,
    note:       `${degrees}° is within the ${norm.min}–${norm.max}° reference range. ${norm.note}`,
  };
}
