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
  MovementAnalysisKind,
  MovementAnalysis,
  ChecklistFinding,
  AnalysisRecommendation,
  AnalysisConfidence,
  AngleSeries,
  EstimatedAngle,
} from '../types/movement';
import { applyAnalysisViewFilters, movementOverlayConfiguration } from './measurementMatrix';

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
    implication:    'May reflect a braking-oriented landing strategy and may be associated with shin, knee, or Achilles complaints. Estimated from 2D video — requires confirmation.',
    drill:          'Quick cadence drills (180 BPM metronome), A-skips, pop-up drill',
    strengthFocus:  'Hip extension strength (glutes), plantar flexor power',
    retestNote:     'Refilm at same pace after 4–6 weeks of cadence work',
    riskType:       'gait_fault',
    riskScores:     ['running_economy', 'durability'],
  },
  crossover: {
    finding:        'Crossover gait pattern observed',
    severity:       'moderate',
    implication:    'May reflect a narrower step-width strategy and may be associated with lateral hip or knee complaints. Estimated observation, requires confirmation.',
    drill:          'Lateral band walks, single-leg balance, wide lane running drill',
    strengthFocus:  'Hip abductors (glute medius), hip external rotators',
    retestNote:     'Refilm with focus line on ground to assess crossing',
    riskType:       'gait_fault',
    riskScores:     ['movement_capacity', 'durability'],
  },
  hip_drop_mild: {
    finding:        'Mild pelvic drop',
    severity:       'low',
    implication:    'May reflect relative hip abductor control; may be associated with IT band or knee complaints. Worth monitoring, not a diagnosis.',
    drill:          'Single-leg stance with focus on level pelvis, hip hike exercise',
    strengthFocus:  'Glute medius, hip abductors',
    retestNote:     'Reassess after 6 weeks of hip abductor strengthening',
    riskType:       'strength_deficit',
    riskScores:     ['movement_capacity', 'running_economy'],
  },
  hip_drop_moderate: {
    finding:        'Moderate pelvic drop (contralateral hip drops >5cm)',
    severity:       'moderate',
    implication:    'May reflect reduced hip abductor capacity, commonly associated with IT band, knee, and low back complaints — worth addressing.',
    drill:          'Single-leg deadlift, lateral band walks, Copenhagen plank',
    strengthFocus:  'Glute medius, hip abductors, core lateral stability',
    retestNote:     'Refilm every 4 weeks. Stop heavy load if pain increases.',
    riskType:       'strength_deficit',
    riskScores:     ['movement_capacity', 'durability', 'running_economy'],
  },
  hip_drop_severe: {
    finding:        'Severe pelvic drop — clinical assessment recommended',
    severity:       'high',
    implication:    'A pronounced control finding worth addressing. Consider a clinical movement assessment for a precise evaluation.',
    drill:          'Regress to supported hip abductor exercises first',
    strengthFocus:  'Hip abductors, core, and proximal stability',
    retestNote:     'Consult sports physio before returning to high training load',
    riskType:       'strength_deficit',
    riskScores:     ['movement_capacity', 'durability', 'running_economy'],
  },
  knee_valgus_mild: {
    finding:        'Mild knee valgus (dynamic)',
    severity:       'low',
    implication:    'May be associated with increased patellofemoral and medial knee loading; commonly more visible in fatigue states. Estimated, requires confirmation.',
    drill:          'Single-leg squat with knee tracking cue, lateral band squat',
    strengthFocus:  'Glute medius, VMO, foot intrinsics',
    riskType:       'form_fault',
    riskScores:     ['movement_capacity'],
  },
  knee_valgus_moderate: {
    finding:        'Moderate knee valgus — training modification recommended',
    severity:       'moderate',
    implication:    'May be associated with increased patellofemoral and medial knee loading. Consider easing deep fatigued squatting while control work is dialed in. Manual review recommended.',
    drill:          'Box squat with band around knees, step-down with lateral cue, glute bridge with abduction',
    strengthFocus:  'Hip abductors, knee extensors (VMO), single-leg stability',
    retestNote:     'Reassess under load after 4 weeks of focused correction',
    riskType:       'form_fault',
    riskScores:     ['movement_capacity', 'durability'],
  },
  knee_valgus_severe: {
    finding:        'Pronounced knee valgus — manual review recommended',
    severity:       'high',
    implication:    'A pronounced knee-in position that may be associated with increased patellofemoral and medial knee loading. Consider a clinical movement assessment for a precise evaluation.',
    drill:          'Regress to seated and supported hip abductor work',
    strengthFocus:  'Hip abductors, glutes, foot/ankle stability',
    retestNote:     'Clinical review before heavy training resumes',
    riskType:       'form_fault',
    riskScores:     ['movement_capacity', 'durability', 'running_economy'],
  },
  low_cadence: {
    finding:        'Below-optimal running cadence (< 160 steps/min)',
    severity:       'low',
    implication:    'Lower cadence may accompany a longer-stride strategy. Cadence alone cannot determine impact loading or injury risk.',
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
    implication: 'May be associated with increased patellofemoral and medial knee loading. Estimated, requires confirmation.',
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
    implication: 'The bar appears farther from the body in this camera view, changing the visible trunk-to-load relationship. A 2D video cannot determine lumbar loading or tissue strain.',
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
      message:  'A high-severity movement finding is active. Consider easing max-effort lower-body loading while it is addressed. Manual review recommended.',
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
  hip_extension:        { min: 0,   max: 15,  optimal: 5, note: 'Estimated terminal-stance hip extension magnitude' },
  knee_flexion:         { min: 15,  max: 40,  optimal: 25, note: 'Knee flexion at initial contact — higher values may be associated with more overstride' },
  ankle_dorsiflexion:   { min: 10,  max: 25,  optimal: 18, note: 'Running requires ~15–25° dynamic dorsiflexion' },
  ankle_plantarflexion: { min: 20,  max: 40,  optimal: 30, note: 'Push-off plantarflexion' },
  pelvic_drop:          { min: 0,   max: 5,   optimal: 2,  note: '> ~5° is often used as a threshold worth monitoring' },
};

export const LIFTING_ANGLE_NORMS: Partial<Record<string, JointAngleNorm>> = {
  trunk_angle:      { min: 45, max: 90, optimal: 70, note: 'Squat trunk angle (varies with stance)' },
  hip_flexion:      { min: 70, max: 150, optimal: 110, note: 'Estimated anatomical hip flexion at squat depth; task and body proportions matter' },
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

// ═══ Movement Lab V1.5 — still-frame analysis engine ══════════════════════════

// ─── Disclaimers ──────────────────────────────────────────────────────────────

export const MOVEMENT_SAFETY_DISCLAIMER =
  'Movement Lab is a training analysis tool, not a medical evaluation. Nothing here is a diagnosis. If you have pain, numbness, or an injury concern, see a qualified clinician.';

export const ANGLE_ESTIMATE_DISCLAIMER =
  'Angles are estimates based on camera view and landmark detection. They are not exact clinical measurements.';

export const DETECTION_LIMITATIONS_NOTE =
  "Camera angle, lighting, baggy clothing, and busy backgrounds reduce detection accuracy. Side-view items can't be judged from a rear view (and vice versa).";

// ─── Analysis kind info ───────────────────────────────────────────────────────

export type AnalysisKindCategory =
  | 'Running Performance'
  | 'Cycling Performance'
  | 'Strength Movement'
  | 'Athletic Movement'
  | 'General Analysis';

export const ANALYSIS_KIND_INFO: Record<
  MovementAnalysisKind,
  { title: string; category: AnalysisKindCategory; cameraAngle: string; setup: string[]; analyzes: string[] }
> = {
  running_gait: {
    title:       'Running Gait',
    category:    'Running Performance',
    cameraAngle: 'Lateral (side) view, camera at hip height, 3–5 m away',
    setup: [
      'Film from the side with the camera steady at hip height, 3–5 m away',
      'Use a treadmill or make repeated passes past the camera at your normal pace',
      'Wear shorts or leggings so your hips, knees, and ankles are visible',
      'Good lighting, plain background, whole body in frame',
    ],
    analyzes: [
      'Estimated overstride at initial contact',
      'Trunk inclination',
      'Pelvic control (hip) estimates',
      'Closest-side knee and hip angles',
      'Closest-side joint timing and position estimates',
    ],
  },
  bike_fit: {
    title:       'Bike Fit',
    category:    'Cycling Performance',
    cameraAngle: 'Direct lateral view, camera perpendicular at hip/crank height',
    setup: [
      'Use a bicycle on a stable indoor trainer or a stationary bike',
      'Film directly from the side with the camera perpendicular to the rider',
      'Place the camera at approximately hip/crank height and keep it stable',
      'Keep the full rider, bicycle, crank, pedals, hands, and both contact phases visible',
      'Pedal naturally long enough to include repeated top and bottom pedal phases',
      'Do not use a three-quarter or 45-degree view',
    ],
    analyzes: [
      'Closest-side knee angle near top and bottom pedal phases',
      'Closest-side estimated hip flexion near the top phase',
      'Trunk inclination',
      'Closest-side elbow and shoulder position when landmarks are confident',
      'Manual review of contact points and phase selection',
    ],
  },
  squat: {
    title:       'Squat',
    category:    'Strength Movement',
    cameraAngle: 'Lateral (side) view — a frontal view is an optional add-on',
    setup: [
      'Film straight from the side, camera steady at roughly hip height',
      'Whole body in frame, including feet, through the full rep',
      'Use a light or moderate load you can pause safely',
      'Fitted clothing so hip and knee positions are visible',
      'A frontal view is optional and adds knee-position and pelvic-control estimates',
    ],
    analyzes: [
      'Squat depth (closest-side knee flexion)',
      'Trunk inclination',
      'Closest-side hip angle',
      'Rep-to-rep consistency (estimated)',
      'Frontal-plane knee position (frontal view only)',
    ],
  },
  deadlift: {
    title:       'Deadlift',
    category:    'Strength Movement',
    cameraAngle: 'Lateral (side) view, camera at roughly hip height',
    setup: [
      'Film straight from the side, camera steady at roughly hip height',
      'Whole body in frame for the whole pull',
      'Film your working sets, not a deliberately slowed demo',
      'Avoid backlighting — your spine line must stay visible',
    ],
    analyzes: [
      'Hip hinge quality (estimated)',
      'Trunk inclination and closest-side knee angle',
      'Lockout position',
      'Start position setup',
      'Bar path — only when a bar is manually marked (no automatic bar detection)',
    ],
  },
  single_leg_control: {
    title:       'Single-Leg Control',
    category:    'Athletic Movement',
    cameraAngle: 'Frontal (front) view, square to the camera — a lateral view is optional',
    setup: [
      'Film from directly in front, square to the camera',
      'Whole body in frame including the feet',
      'Perform controlled repetitions per side',
      'Fitted shorts or leggings so knee and pelvis position are visible',
    ],
    analyzes: [
      'Frontal-plane knee position',
      'Pelvic control (pelvic obliquity)',
      'Trunk strategy (lateral lean)',
      'Balance and control',
    ],
  },
  lunge: {
    title:       'Lunge',
    category:    'Athletic Movement',
    cameraAngle: 'Lateral (side) view — a frontal view is an optional add-on',
    setup: [
      'Film from the side, camera steady at roughly hip height',
      'Whole body in frame including the feet',
      'Perform controlled repetitions per side',
      'Fitted shorts or leggings so hip and knee positions are visible',
    ],
    analyzes: [
      'Split-squat mechanics (closest-side knee and hip angles)',
      'Hip extension tolerance (estimated)',
      'Knee control',
      'Trunk strategy',
      'Deceleration control where visible',
    ],
  },
  general: {
    title:       'General Upload',
    category:    'General Analysis',
    cameraAngle: 'You pick the view that shows the movement best',
    setup: [
      'Frame the whole body and keep the camera steady',
      'Good lighting and a plain background improve detection',
      'Capture 3–5 reps or a continuous 10–20 s clip',
    ],
    analyzes: [
      'Any movement — reviewed manually',
      'Pose landmarks and joint angles valid for the chosen view',
    ],
  },
  // Deprecated legacy kind — retained so Build 32/34/35 records display without
  // crashing. New records migrate to single_leg_control | lunge on read.
  lunge_single_leg: {
    title:       'Single-Leg Control',
    category:    'Athletic Movement',
    cameraAngle: 'Frontal (front) view, square to the camera',
    setup: [
      'Film from directly in front, square to the camera',
      'Whole body in frame including the feet',
      'Perform controlled repetitions per side',
      'Fitted shorts or leggings so knee and pelvis position are visible',
    ],
    analyzes: [
      'Frontal-plane knee position',
      'Pelvic control (pelvic obliquity)',
      'Trunk strategy (lateral lean)',
      'Balance and control',
    ],
  },
};

// ─── Analysis checklists ──────────────────────────────────────────────────────

export const ANALYSIS_CHECKLISTS: Record<MovementAnalysisKind, { id: string; label: string; options: string[] }[]> = {
  running_gait: [
    { id: 'overstride',           label: 'Overstride',            options: ['No', 'Mild', 'Marked', 'Unclear'] },
    { id: 'trunk_lean',           label: 'Trunk lean',            options: ['Upright', 'Slight forward', 'Excessive', 'Unclear'] },
    { id: 'pelvic_drop',          label: 'Pelvic drop',           options: ['None', 'Mild', 'Moderate', 'Severe', 'Unclear'] },
    { id: 'knee_valgus',          label: 'Knee valgus',           options: ['None', 'Mild', 'Moderate', 'Severe', 'Unclear'] },
    { id: 'crossover',            label: 'Crossover gait',        options: ['No', 'Yes', 'Unclear'] },
    { id: 'arm_swing',            label: 'Arm swing symmetry',    options: ['Symmetric', 'Asymmetric', 'Unclear'] },
    { id: 'vertical_oscillation', label: 'Vertical oscillation',  options: ['Low', 'Moderate', 'High', 'Unclear'] },
  ],
  bike_fit: [
    { id: 'camera_alignment', label: 'Camera alignment', options: ['Direct lateral', 'Not perpendicular', 'Unclear'] },
    { id: 'phase_capture', label: 'Pedal phases captured', options: ['Top and bottom visible', 'One phase missing', 'Unclear'] },
    { id: 'knee_pattern', label: 'Knee position through stroke', options: ['Consistent', 'Variable', 'Unclear'] },
    { id: 'trunk_position', label: 'Trunk position', options: ['Stable', 'Changes during stroke', 'Unclear'] },
    { id: 'upper_body', label: 'Upper-body position', options: ['Relaxed and supported', 'Tense or locked', 'Unclear'] },
    { id: 'contact_visibility', label: 'Bike contact points', options: ['Visible', 'Partly obscured', 'Unclear'] },
  ],
  squat: [
    { id: 'depth',          label: 'Depth',          options: ['Above parallel', 'Parallel', 'Below parallel', 'Unclear'] },
    { id: 'trunk_angle',    label: 'Trunk angle',    options: ['Upright', 'Moderate', 'Excessive lean', 'Unclear'] },
    { id: 'knee_tracking',  label: 'Knee tracking',  options: ['Over toes', 'Caving in', 'Out', 'Unclear'] },
    { id: 'hip_shift',      label: 'Hip shift',      options: ['None', 'Left', 'Right', 'Unclear'] },
    { id: 'ankle_strategy', label: 'Ankle strategy', options: ['Heels down', 'Heels rising', 'Unclear'] },
    { id: 'symmetry',       label: 'Symmetry',       options: ['Symmetric', 'Asymmetric', 'Unclear'] },
  ],
  deadlift: [
    { id: 'hip_hinge',      label: 'Hip hinge',      options: ['Good hinge', 'Squatty', 'Stiff-legged', 'Unclear'] },
    { id: 'trunk_position', label: 'Trunk position', options: ['Neutral', 'Rounded', 'Overextended', 'Unclear'] },
    { id: 'bar_path',       label: 'Bar path',       options: ['Close', 'Drifts away', 'Not visible'] },
    { id: 'lockout',        label: 'Lockout',        options: ['Complete', 'Incomplete', 'Hyperextended', 'Unclear'] },
    { id: 'start_position', label: 'Start position', options: ['Set', 'Rushed', 'Unclear'] },
  ],
  // Single-Leg Control — frontal-plane control focus.
  single_leg_control: [
    { id: 'knee_position', label: 'Frontal knee position', options: ['Tracks over foot', 'Drifts inward', 'Drifts outward', 'Unclear'] },
    { id: 'pelvic_drop',   label: 'Pelvic control',        options: ['Level', 'Mild drop', 'Marked drop', 'Unclear'] },
    { id: 'trunk_control', label: 'Trunk control',         options: ['Stable', 'Some sway', 'Collapsing', 'Unclear'] },
    { id: 'balance',       label: 'Balance',               options: ['Steady', 'Occasional wobble', 'Frequent loss', 'Unclear'] },
  ],
  // Lunge — lateral split-squat mechanics focus.
  lunge: [
    { id: 'depth',         label: 'Split-squat depth', options: ['Above parallel', 'Parallel', 'Below parallel', 'Unclear'] },
    { id: 'knee_control',  label: 'Front-knee control', options: ['Controlled', 'Travels far forward', 'Caves in', 'Unclear'] },
    { id: 'trunk_control', label: 'Trunk control',      options: ['Stable', 'Some sway', 'Collapsing', 'Unclear'] },
    { id: 'balance',       label: 'Balance',            options: ['Steady', 'Occasional wobble', 'Frequent loss', 'Unclear'] },
  ],
  // Deprecated legacy kind — kept so old records still open their checklist.
  lunge_single_leg: [
    { id: 'knee_valgus',   label: 'Knee valgus',   options: ['None', 'Mild', 'Moderate', 'Severe', 'Unclear'] },
    { id: 'pelvic_drop',   label: 'Pelvic drop',   options: ['None', 'Mild', 'Moderate', 'Severe', 'Unclear'] },
    { id: 'trunk_control', label: 'Trunk control', options: ['Stable', 'Some sway', 'Collapsing', 'Unclear'] },
    { id: 'balance',       label: 'Balance',       options: ['Steady', 'Occasional wobble', 'Frequent loss', 'Unclear'] },
  ],
  general: [
    { id: 'movement_quality', label: 'Movement quality', options: ['Smooth', 'Hesitant', 'Compensated', 'Unclear'] },
    { id: 'symmetry',         label: 'Left/right symmetry', options: ['Symmetric', 'Asymmetric', 'Unclear'] },
    { id: 'control',          label: 'Control and tempo', options: ['Controlled', 'Rushed', 'Unstable', 'Unclear'] },
  ],
};

// ─── Checklist → recommendations ──────────────────────────────────────────────

/** Values that count as a "normal" (non-notable) answer per checklist item. */
export const NORMAL_CHECKLIST_VALUES = new Set([
  'No', 'None', 'Upright', 'Symmetric', 'Low', 'Moderate',
  'Parallel', 'Below parallel', 'Over toes', 'Heels down',
  'Good hinge', 'Neutral', 'Close', 'Complete', 'Set',
  'Stable', 'Steady', 'Smooth', 'Controlled', 'Slight forward',
  // Build 36 — Single-Leg Control / Lunge normal answers.
  'Tracks over foot', 'Level',
  // Build 38 — Bike Fit descriptive normal answers.
  'Direct lateral', 'Top and bottom visible', 'Consistent',
  'Relaxed and supported', 'Visible',
]);

function gaitTemplateToRec(t: GaitFindingTemplate): AnalysisRecommendation {
  const parts = [t.drill && `Drills: ${t.drill}.`, t.strengthFocus && `Strength focus: ${t.strengthFocus}.`, t.retestNote && `Retest: ${t.retestNote}.`]
    .filter(Boolean)
    .join(' ');
  return { finding: t.finding, meaning: t.implication ?? '', recommendation: parts };
}

function liftingTemplateToRec(t: (typeof LIFTING_TEMPLATES)[string]): AnalysisRecommendation {
  const parts = [t.cue && `Cue: ${t.cue}`, t.regression && `Regression: ${t.regression}`, t.retestNote && `Retest: ${t.retestNote}`]
    .filter(Boolean)
    .join(' ');
  return { finding: t.finding, meaning: t.implication ?? '', recommendation: parts };
}

function findingConfidence(confidence: AnalysisConfidence | undefined): AnalysisRecommendation['confidence'] {
  if (confidence === 'high') return 'high';
  if (confidence === 'moderate') return 'moderate';
  return 'low';
}

function angleValues(series: AngleSeries): number[] {
  return series.points.map(p => p.degrees).filter((value): value is number => value !== null);
}

function formatSeriesRange(series: AngleSeries): string | null {
  const values = angleValues(series);
  if (values.length < 2) return null;
  const min = Math.round(Math.min(...values));
  const max = Math.round(Math.max(...values));
  return `${series.name}${series.side !== 'center' ? ` (${series.side})` : ''}: ${min}–${max}° Estimated`;
}

export function buildSequenceFindings(
  sequence: Pick<
    MovementAnalysis,
    'estimatedAngles' | 'angleSeries' | 'keyFrames' | 'repSummaries' | 'symmetryEstimates' | 'sequenceConfidence'
  >,
  kind: MovementAnalysisKind,
): AnalysisRecommendation[] {
  // Only findings that add signal beyond what the screens already show:
  // reference-frame angles and key-frame lists live in the UI (and in
  // estimatedAngles/keyFrames on the record), so repeating them here would
  // just bury the rep/symmetry findings and bloat the AI Coach context.
  const recs: AnalysisRecommendation[] = [];
  const confidence = findingConfidence(sequence.sequenceConfidence);

  const rangeSummaries = (sequence.angleSeries ?? [])
    .filter(series => ['hip', 'knee', 'shoulder', 'elbow', 'trunk'].includes(series.joint))
    .map(formatSeriesRange)
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);

  if (rangeSummaries.length > 0) {
    recs.push({
      finding: 'Estimated joint-angle ranges over the clip',
      meaning: rangeSummaries.join('; '),
      confidence,
      recommendation: 'Review the min/max ranges together with the key frames and any user-corrected landmarks before changing training load or technique cues.',
    });
  }

  const reps = sequence.repSummaries ?? [];
  if (reps.length > 0) {
    const depths = reps.map(r => r.peakFlexionDeg);
    const minDepth = Math.round(Math.min(...depths));
    const maxDepth = Math.round(Math.max(...depths));
    recs.push({
      finding: `Estimated ${reps.length} rep${reps.length === 1 ? '' : 's'} detected`,
      meaning: `Peak knee-flexion estimates ranged from ${minDepth}° to ${maxDepth}° across the detected reps.`,
      confidence,
      recommendation: 'Use the detected reps to find the deepest and most consistent positions, then confirm with manual review when lighting, camera angle, or clothing reduces marker confidence.',
    });
  }

  const symmetry = sequence.symmetryEstimates?.[0];
  if (symmetry) {
    recs.push({
      finding: symmetry.withinNoise
        ? 'Estimated left/right knee range difference within 2D measurement noise'
        : 'Estimated left/right knee range difference observed',
      meaning: symmetry.withinNoise
        ? symmetry.note
        : `${symmetry.note} This may influence movement strategy, but it should be confirmed with a repeat clip and human review.`,
      confidence,
      recommendation: symmetry.withinNoise
        ? 'Keep this as a baseline trend point and compare future clips from the same camera view.'
        : 'Retest with matched side-view clips and consider single-leg strength or mobility review if the pattern repeats across sessions.',
    });
  }

  // The "needs human review" fallback only applies when detection produced
  // nothing at all. A photo with a good pose legitimately has zero sequence
  // findings — its angles ARE the result — and must not be flagged.
  const hasAnyAutomatedResult = (sequence.estimatedAngles ?? []).length > 0;
  if (recs.length === 0 && !hasAnyAutomatedResult && kind) {
    recs.push({
      finding: 'Automated pose analysis needs human review',
      meaning: 'The detector did not capture enough confident landmarks to generate reliable estimated findings for this media.',
      confidence: 'low',
      recommendation: 'Use the manual checklist fallback and consider refilming with the full body visible, steady camera position, and better lighting.',
    });
  }

  return recs;
}

export function buildAnalysisRecommendations(
  kind:     MovementAnalysisKind,
  findings: ChecklistFinding[],
): AnalysisRecommendation[] {
  const recs: AnalysisRecommendation[] = [];
  const get = (itemId: string) => findings.find(f => f.itemId === itemId)?.value;

  if (kind === 'running_gait') {
    const overstride = get('overstride');
    if (overstride === 'Mild' || overstride === 'Marked') {
      recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.overstride));
    }
    if (get('crossover') === 'Yes') {
      recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.crossover));
    }
    const drop = get('pelvic_drop');
    if (drop === 'Mild')     recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.hip_drop_mild));
    if (drop === 'Moderate') recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.hip_drop_moderate));
    if (drop === 'Severe')   recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.hip_drop_severe));
    const valgus = get('knee_valgus');
    if (valgus === 'Mild')     recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.knee_valgus_mild));
    if (valgus === 'Moderate') recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.knee_valgus_moderate));
    if (valgus === 'Severe')   recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.knee_valgus_severe));
    if (get('trunk_lean') === 'Excessive') {
      recs.push({
        finding:        'Excessive forward trunk lean while running',
        meaning:        'Shifts load to the calves and low back and often reflects weak hip extensors or breaking at the waist rather than leaning from the ankles.',
        recommendation: 'Cue: "run tall, lean from the ankles, not the waist." Strength focus: glute bridges, back extensions, and hill strides to groove hip extension. Refilm from the side after 3–4 weeks.',
      });
    }
    if (get('arm_swing') === 'Asymmetric') {
      recs.push({
        finding:        'Asymmetric arm swing',
        meaning:        'Arm swing asymmetry often mirrors a trunk-rotation or leg-drive asymmetry rather than an arm problem — it can hint at a side that isn\'t contributing equally.',
        recommendation: 'Cue: relaxed shoulders, elbows around 90°, hands driving "hip to lip" on both sides. Add single-arm carries and single-leg strength work; refilm from the front and rear to check whether the asymmetry follows the legs.',
      });
    }
    if (get('vertical_oscillation') === 'High') {
      recs.push({
        finding:        'High vertical oscillation (bouncy stride)',
        meaning:        'Energy spent moving up and down instead of forward. Often paired with low cadence and overstriding, and it raises impact loading per step.',
        recommendation: 'Cue: "run quiet, push back, not up." Add cadence work (metronome strides at +5–10% of current step rate) and short hill repeats for horizontal drive. Reassess after 3–4 weeks of cadence-focused strides.',
      });
    }
  }

  if (kind === 'bike_fit') {
    if (get('camera_alignment') === 'Not perpendicular') {
      recs.push({
        finding: 'Camera was not perpendicular to the rider',
        meaning: 'A three-quarter or angled view changes the apparent joint relationships and does not support the lateral Bike Fit estimates.',
        recommendation: 'Repeat the capture from directly the side with the phone stable at approximately hip/crank height. Manual review recommended before using the numeric estimates.',
      });
    }
    if (get('phase_capture') === 'One phase missing') {
      recs.push({
        finding: 'One required pedal phase was not captured clearly',
        meaning: 'Bike Fit needs representative top and bottom pedal phases to describe how the visible knee, hip, trunk, shoulder, and elbow positions change through the stroke.',
        recommendation: 'Repeat a longer steady-pedaling clip with the full crank and pedals visible. Confirm the top and bottom phase frames manually before interpreting fit.',
      });
    }
    if (get('knee_pattern') === 'Variable') {
      recs.push({
        finding: 'Visible knee position varied across pedal strokes',
        meaning: 'The available lateral view shows a variable two-dimensional knee path. This may reflect cadence, effort, fatigue, capture quality, or current setup; it does not identify a cause.',
        recommendation: 'Confirm the pattern across several relaxed pedal cycles at a steady resistance. If symptoms or fit concerns persist, review the video with a qualified bike fitter or clinician.',
      });
    }
    if (get('trunk_position') === 'Changes during stroke') {
      recs.push({
        finding: 'Trunk position changed during the pedal stroke',
        meaning: 'The rider did not maintain one repeatable trunk relationship in this clip. A single phone view cannot determine whether bike setup, effort, fatigue, or riding style explains the change.',
        recommendation: 'Repeat the clip at representative easy-to-moderate effort and review saddle, hand support, and comfort with a qualified bike fitter when the pattern or symptoms persist.',
      });
    }
    if (get('upper_body') === 'Tense or locked') {
      recs.push({
        finding: 'Upper body appears tense or locked',
        meaning: 'The visible shoulder and elbow positions may reflect how the rider is supporting the trunk in this setup. This does not establish an optimal handlebar position or diagnose a problem.',
        recommendation: 'Use a relaxed grip and soft elbows during a repeat capture. Consider an in-person fit review if hand, neck, shoulder, or back symptoms accompany the position.',
      });
    }
    if (get('contact_visibility') === 'Partly obscured') {
      recs.push({
        finding: 'One or more bicycle contact points were obscured',
        meaning: 'Hidden hands, feet, pedals, saddle contact, or crank position limit manual phase review and make fit interpretation less reliable.',
        recommendation: 'Refilm with the entire bicycle and rider visible, including hands, saddle contact, crank, pedals, and both feet. Manual review recommended.',
      });
    }
  }

  if (kind === 'squat') {
    if (get('depth') === 'Above parallel') {
      recs.push(liftingTemplateToRec(LIFTING_TEMPLATES.poor_depth));
    }
    if (get('trunk_angle') === 'Excessive lean') {
      recs.push(liftingTemplateToRec(LIFTING_TEMPLATES.forward_lean));
    }
    if (get('knee_tracking') === 'Caving in') {
      recs.push(liftingTemplateToRec(LIFTING_TEMPLATES.knee_valgus));
    }
    const shift = get('hip_shift');
    if (shift === 'Left' || shift === 'Right') {
      recs.push({
        finding:        `Hip shift toward the ${shift.toLowerCase()} during the squat`,
        meaning:        'A lateral shift usually means one side is doing more work — from a strength or mobility asymmetry, or an old-injury guarding pattern. Under load it concentrates stress on one hip and knee.',
        recommendation: 'Cue: "spread the floor, drive both feet evenly." Reduce load 10–20% and add single-leg work (split squats, step-ups) for the under-working side. Film front-on every 2 weeks; if the shift persists or is painful, get it assessed.',
      });
    }
    if (get('ankle_strategy') === 'Heels rising') {
      recs.push({
        finding:        'Heels rising during the squat descent',
        meaning:        'Usually a sign of limited ankle dorsiflexion — the body borrows range by lifting the heels, which shifts load to the forefoot and knees and makes depth unstable.',
        recommendation: 'Cue: "big toe and heel stay glued down." Add ankle mobility work (knee-to-wall rocks, calf stretching/soft tissue) and squat with heel-elevated shoes or small plates under the heels while range improves. Retest barefoot depth in 4–6 weeks.',
      });
    }
    if (get('symmetry') === 'Asymmetric') {
      recs.push({
        finding:        'Left/right asymmetry during the squat',
        meaning:        'The visible sides used different movement strategies in this capture. The cause cannot be determined from one 2D video.',
        recommendation: 'Add 2 sets of unilateral lower-body work (rear-foot-elevated split squat or single-leg press) per session, starting with the weaker side and matching reps. Keep bilateral loads moderate until sides look even on video.',
      });
    }
  }

  if (kind === 'deadlift') {
    if (get('bar_path') === 'Drifts away') {
      recs.push(liftingTemplateToRec(LIFTING_TEMPLATES.bar_drift));
    }
    const hinge = get('hip_hinge');
    if (hinge === 'Squatty') {
      recs.push({
        finding:        'Squat-style pull — hips too low at the start',
        meaning:        'Starting with the hips too low turns the deadlift into a stiff squat: the knees block the bar path and the first pull becomes inefficient, often forcing the hips to shoot up early.',
        recommendation: 'Cue: "hips higher than knees, shoulders slightly ahead of the bar, load the hamstrings before you pull." Practice Romanian deadlifts and paused pulls from below the knee to groove the hinge. Refilm the first pull from the side at a moderate load.',
      });
    }
    if (hinge === 'Stiff-legged') {
      recs.push({
        finding:        'Stiff-legged pull — hips too high, knees barely bent',
        meaning:        'A higher-hip setup changes how the knees, hips, and trunk contribute. Whether that strategy is appropriate depends on the athlete, implement, and symptoms.',
        recommendation: 'Cue: "drop the hips until the shins touch the bar, chest up, push the floor away." Use blocks or rack pulls at knee height to rebuild the pattern, then lower the start position over 2–3 weeks. Keep loads at ~70% while the setup changes.',
      });
    }
    const trunk = get('trunk_position');
    if (trunk === 'Rounded') {
      recs.push({
        finding:        'Rounded trunk during the pull',
        meaning:        'The visible trunk shape changed during the pull. A phone video cannot determine spinal loading or tissue stress, so confirm the pattern and consider symptoms before changing load.',
        recommendation: 'Cue: "chest up, lats on — bend the bar around your shins." Reduce load 20–30% immediately, add front-loaded core work (front squat holds, ab wheel) and paused deadlifts at a load where the spine stays neutral. Refilm weekly; if rounding continues or the back aches, get coached in person.',
      });
    }
    if (trunk === 'Overextended') {
      recs.push({
        finding:        'Overextended (hyperlordotic) trunk position',
        meaning:        'The trunk appears extended at this camera angle. This may reflect the athlete’s setup or bracing strategy, but the video cannot determine joint compression or tissue loading.',
        recommendation: 'Cue: "ribs down, brace 360° like taking a punch." Practice dead-bug and bird-dog breathing drills, and set the brace before each rep rather than pulling into an arch. Retest at working load after 2 weeks of brace practice.',
      });
    }
    const lockout = get('lockout');
    if (lockout === 'Incomplete') {
      recs.push({
        finding:        'Incomplete lockout — hips never finish under the bar',
        meaning:        'Stopping short of full hip extension leaves the glutes out of the lift and keeps the low back loaded in a leaned-forward position at the top.',
        recommendation: 'Cue: "stand tall, squeeze the glutes, finish with hips — not by leaning back." Add barbell hip thrusts and heavy kettlebell swings to train terminal hip extension. Practice deliberate 2-second lockout holds at moderate loads.',
      });
    }
    if (lockout === 'Hyperextended') {
      recs.push({
        finding:        'Hyperextended lockout — leaning back at the top',
        meaning:        'Leaning back past vertical changes the finish position from hip and knee extension toward visible trunk extension. A phone video cannot determine joint compression or tissue loading.',
        recommendation: 'Cue: "finish tall, glutes squeezed, ribs stacked over pelvis — don\'t lean back." Rehearse the finish position unloaded against a wall, then at ~50% load with a 2-second hold at the top.',
      });
    }
    if (get('start_position') === 'Rushed') {
      recs.push({
        finding:        'Rushed setup before the pull',
        meaning:        'Pulling before tension is set may make the setup less repeatable from rep to rep. The video can show consistency, but not internal loading.',
        recommendation: 'Build a repeatable ritual: feet set → grip → pull the slack out of the bar → brace → pull. Count one full second of tension before the bar leaves the floor. Film the first rep of each set to confirm consistency.',
      });
    }
  }

  if (kind === 'single_leg_control') {
    const kneePos = get('knee_position');
    if (kneePos === 'Drifts inward') {
      recs.push({
        finding:        'Knee drifts toward the midline on single-leg loading',
        meaning:        'A knee-in position is a frontal-plane observation that may reflect the athlete’s current movement strategy. A 2D video cannot determine joint loading, cause, or diagnosis.',
        recommendation: 'Cue: "knee points at the second toe." Add lateral band drills, single-leg step-downs, and glute-medius work. Refilm front-on in 3–4 weeks.',
      });
    } else if (kneePos === 'Drifts outward') {
      recs.push({
        finding:        'Knee drifts outward on single-leg loading',
        meaning:        'An outward (varus) knee position is an estimated frontal-plane observation; on its own it is a control cue, not a diagnosis.',
        recommendation: 'Cue: "knee tracks over the middle of the foot." Add controlled single-leg work with attention to foot pressure. Refilm front-on to compare.',
      });
    }
    const drop = get('pelvic_drop');
    if (drop === 'Mild drop')   recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.hip_drop_mild));
    if (drop === 'Marked drop') recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.hip_drop_moderate));
    const trunkCtrl = get('trunk_control');
    if (trunkCtrl === 'Some sway' || trunkCtrl === 'Collapsing') {
      recs.push({
        finding:        trunkCtrl === 'Collapsing' ? 'Trunk collapses during single-leg work' : 'Trunk sway during single-leg work',
        meaning:        'The trunk leaning or collapsing over the stance leg may reflect lateral hip and core control — the body substitutes a lean for pelvic control. An estimated observation, worth monitoring.',
        recommendation: 'Cue: "ribs stacked over pelvis, belt buckle level." Regress to a shorter/supported stance (hand on wall) until the trunk stays quiet, and add side planks and suitcase carries 2×/week. Refilm front-on in 4 weeks.',
      });
    }
    const balance = get('balance');
    if (balance === 'Occasional wobble' || balance === 'Frequent loss') {
      recs.push({
        finding:        balance === 'Frequent loss' ? 'Frequent balance loss on single leg' : 'Occasional balance wobble on single leg',
        meaning:        'Balance strategy under single-leg load reflects foot/ankle stability and hip control — both matter for running, where every stride is a single-leg landing.',
        recommendation: 'Add daily single-leg balance holds (30–60 s per side, eyes forward), progressing to unstable surfaces or eyes-closed. Strength focus: single-leg calf raises and step-downs with a slow 3-second lowering. Expect visible improvement in 2–3 weeks.',
      });
    }
  }

  if (kind === 'lunge') {
    if (get('depth') === 'Above parallel') {
      recs.push(liftingTemplateToRec(LIFTING_TEMPLATES.poor_depth));
    }
    const kneeCtrl = get('knee_control');
    if (kneeCtrl === 'Caves in') {
      recs.push({
        finding:        'Front knee caves inward during the lunge',
        meaning:        'A knee-in position may be associated with increased patellofemoral and medial knee loading. Estimated from 2D video, worth monitoring.',
        recommendation: 'Cue: "split the floor, knee over the second toe." Add lateral band drills and controlled split squats. Refilm from the front to confirm.',
      });
    } else if (kneeCtrl === 'Travels far forward') {
      recs.push({
        finding:        'Front knee travels well past the toes',
        meaning:        'Forward knee travel may reflect step length, movement goal, or ankle strategy. It is an estimated observation, not a fault or loading measurement on its own.',
        recommendation: 'Try a slightly longer stance and a more vertical shin if the goal is to spread load; keep the pattern you can control smoothly. Refilm from the side to compare.',
      });
    }
    const trunkCtrl = get('trunk_control');
    if (trunkCtrl === 'Some sway' || trunkCtrl === 'Collapsing') {
      recs.push({
        finding:        trunkCtrl === 'Collapsing' ? 'Trunk collapses during the lunge' : 'Trunk sway during the lunge',
        meaning:        'Trunk lean or collapse over the front leg may reflect lateral hip and core control. Estimated, worth monitoring.',
        recommendation: 'Cue: "tall chest, ribs over pelvis." Regress to a supported split squat until the trunk stays quiet, and add anti-lateral-flexion core work. Refilm in 4 weeks.',
      });
    }
    const balance = get('balance');
    if (balance === 'Occasional wobble' || balance === 'Frequent loss') {
      recs.push({
        finding:        balance === 'Frequent loss' ? 'Frequent balance loss during the lunge' : 'Occasional balance wobble during the lunge',
        meaning:        'Balance under split-stance load reflects foot/ankle stability and hip control, both of which carry over to single-leg running mechanics.',
        recommendation: 'Add controlled tempo split squats and single-leg balance holds. Progress load only once each rep looks steady. Expect visible improvement in 2–3 weeks.',
      });
    }
  }

  if (kind === 'lunge_single_leg') {
    const valgus = get('knee_valgus');
    if (valgus === 'Mild')     recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.knee_valgus_mild));
    if (valgus === 'Moderate') recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.knee_valgus_moderate));
    if (valgus === 'Severe')   recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.knee_valgus_severe));
    const drop = get('pelvic_drop');
    if (drop === 'Mild')     recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.hip_drop_mild));
    if (drop === 'Moderate') recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.hip_drop_moderate));
    if (drop === 'Severe')   recs.push(gaitTemplateToRec(GAIT_FINDING_TEMPLATES.hip_drop_severe));
    const trunkCtrl = get('trunk_control');
    if (trunkCtrl === 'Some sway' || trunkCtrl === 'Collapsing') {
      recs.push({
        finding:        trunkCtrl === 'Collapsing' ? 'Trunk collapses during single-leg work' : 'Trunk sway during single-leg work',
        meaning:        'The trunk leaning or collapsing over the stance leg is a compensation for weak lateral hip and core stabilizers — the body substitutes a lean for pelvic control.',
        recommendation: 'Cue: "ribs stacked over pelvis, belt buckle level." Regress to a shorter/supported lunge (hand on wall) until the trunk stays quiet, and add side planks and suitcase carries 2×/week. Refilm front-on in 4 weeks.',
      });
    }
    const balance = get('balance');
    if (balance === 'Occasional wobble' || balance === 'Frequent loss') {
      recs.push({
        finding:        balance === 'Frequent loss' ? 'Frequent balance loss on single leg' : 'Occasional balance wobble on single leg',
        meaning:        'Balance strategy under single-leg load reflects foot/ankle stability and hip control — both matter for running, where every stride is a single-leg landing.',
        recommendation: 'Add daily single-leg balance holds (30–60 s per side, eyes forward), progressing to unstable surfaces or eyes-closed. Strength focus: single-leg calf raises and step-downs with a slow 3-second lowering. Expect visible improvement in 2–3 weeks.',
      });
    }
  }

  if (kind === 'general') {
    if (get('movement_quality') === 'Compensated') {
      recs.push({
        finding:        'Compensation patterns visible during the movement',
        meaning:        'The movement uses a visible alternative strategy. A single 2D capture cannot determine whether mobility, strength, habit, fatigue, or task constraints explain it.',
        recommendation: 'Reduce the load or range until the movement looks smooth, then rebuild gradually. Note in your log which segment compensates (trunk, hip, knee, ankle) and film the same movement every 2 weeks to track it.',
      });
    }
    if (get('symmetry') === 'Asymmetric') {
      recs.push({
        finding:        'Left/right asymmetry during the movement',
        meaning:        'One side appears to move differently in this capture. Small variation is common, and a repeat capture is needed before treating it as a persistent training consideration.',
        recommendation: 'Add unilateral versions of this movement, leading with and matching reps to the weaker side. Refilm side-by-side in 4 weeks to compare.',
      });
    }
    if (get('control') === 'Rushed' || get('control') === 'Unstable') {
      recs.push({
        finding:        'Movement performed with limited control',
        meaning:        'Speed is masking control — the positions between start and finish are where quality is won or lost, and rushing hides instability.',
        recommendation: 'Apply a tempo (3 seconds down, 1 second pause) at a lighter load until every rep looks identical, then restore speed. Control first, then load, then speed.',
      });
    }
  }

  // Clean report: everything normal and enough of the checklist actually answered.
  if (recs.length === 0) {
    const normals = findings.filter(f => NORMAL_CHECKLIST_VALUES.has(f.value)).length;
    if (normals >= 3) {
      recs.push({
        finding:        'No notable movement considerations identified',
        meaning:        'Everything assessed on this checklist looked within normal ranges for this camera view. A clean screen is a valid, useful result.',
        recommendation: 'Keep training as planned. Refilm periodically (every 8–12 weeks, or when fatigue/injury changes how things feel) to keep a baseline for comparison.',
      });
    }
  }

  return recs;
}

// ─── Coach handoff ────────────────────────────────────────────────────────────
//
// Plain serializable summary of an analysis for the AI coach / export layer.
// No consumer wiring yet — this defines the contract.

export type CoachHandoff = {
  analysisType:     MovementAnalysisKind;
  mediaType:        MovementAnalysis['mediaType'];
  cameraView:       MovementAnalysis['cameraView'];
  closestSide?:     'left' | 'right';   // lateral captures — which limb faced the camera
  detectedAngles:   { name: string; degrees: number; confidence: number }[];
  checklistFindings: ChecklistFinding[];
  confidence:       MovementAnalysis['confidence'];
  userNotes:        string | undefined;
  recommendations:  MovementAnalysis['recommendations'];
  limitations:      string[];
  detectionQuality: 'good' | 'partial' | 'none';

  // ── V2 — video sequence analysis (present only for mediaType 'video') ──────
  sequenceConfidence?: MovementAnalysis['sequenceConfidence'];
  repSummary?: { count: number; depthRangeDeg: [number, number]; consistencyDeg: number | undefined } | null;
  symmetryNote?: string | null;
  keyFrameLabels?: string[];
  sequenceLimitations?: string[];
  landmarkSource?: MovementAnalysis['landmarkSource'];
  referenceFrameTimeMs?: number;
  bikeFitPhases?: MovementAnalysis['bikeFitPhases'];
  captureMetadata?: MovementAnalysis['captureMetadata'];
  manualCorrections: string[];
  manualReviewRequired: boolean;
  measurementConventionVersion: 1 | 2;
  legacyMeasurementsSuppressed: string[];
};

export function buildCoachHandoff(analysis: MovementAnalysis): CoachHandoff {
  analysis = applyAnalysisViewFilters(analysis);
  const matrix = movementOverlayConfiguration(analysis.type, analysis.cameraView, analysis.closestSide);
  const landmarks = analysis.landmarks ?? [];
  let detectionQuality: CoachHandoff['detectionQuality'] = 'none';
  if (landmarks.length > 0) {
    const required = new Set(matrix.visibleJoints);
    const requiredLandmarks = landmarks.filter(landmark => required.has(landmark.name));
    const coverage = required.size > 0 ? requiredLandmarks.length / required.size : 0;
    const mean = requiredLandmarks.length > 0
      ? requiredLandmarks.reduce((sum, landmark) => sum + landmark.confidence, 0) / requiredLandmarks.length
      : 0;
    detectionQuality = coverage >= 0.75 && mean >= 0.6 ? 'good' : 'partial';
  }

  const isVideo = analysis.mediaType === 'video';
  const reps = analysis.repSummaries ?? [];
  const repSummary = isVideo && reps.length > 0
    ? {
        count: reps.length,
        depthRangeDeg: [
          Math.min(...reps.map(r => r.peakFlexionDeg)),
          Math.max(...reps.map(r => r.peakFlexionDeg)),
        ] as [number, number],
        consistencyDeg: reps.length >= 2
          ? Math.round((Math.max(...reps.map(r => r.peakFlexionDeg)) - Math.min(...reps.map(r => r.peakFlexionDeg))) * 10) / 10
          : undefined,
      }
    : null;
  const unsupportedRecommendationTerms = matrix.symmetryAllowed ? [] : [
    ...matrix.prohibitedMeasurements,
    'symmetry', 'pelvic drop', 'knee valgus', 'crossover', 'hip shift', 'arm swing',
  ];
  const effectiveRecommendations = analysis.recommendations.filter(recommendation => {
    const text = `${recommendation.finding} ${recommendation.meaning} ${recommendation.recommendation}`.toLowerCase();
    return !unsupportedRecommendationTerms.some(term => text.includes(term.toLowerCase()));
  });

  return {
    analysisType:      analysis.type,
    mediaType:         analysis.mediaType,
    cameraView:        analysis.cameraView,
    closestSide:       analysis.closestSide,
    detectedAngles:    (analysis.estimatedAngles ?? [])
      .filter(angle => angle.name !== 'Hip angle')
      .map(a => ({
      name:       `${a.name}${a.side !== 'center' ? ` (${a.side})` : ''}`,
      degrees:    a.degrees,
      confidence: a.confidence,
      })),
    checklistFindings: analysis.checklistFindings,
    confidence:        analysis.confidence,
    userNotes:         analysis.notes,
    recommendations:   effectiveRecommendations,
    limitations:       analysis.limitations,
    detectionQuality,

    sequenceConfidence:  isVideo ? analysis.sequenceConfidence : undefined,
    repSummary,
    symmetryNote:        isVideo ? (analysis.symmetryEstimates?.[0]?.note ?? null) : null,
    keyFrameLabels:       isVideo ? (analysis.keyFrames ?? []).map(k => k.label) : undefined,
    sequenceLimitations: isVideo ? analysis.sequenceLimitations : undefined,
    landmarkSource:       analysis.landmarkSource,
    referenceFrameTimeMs: analysis.referenceFrameTimeMs,
    bikeFitPhases:         analysis.bikeFitPhases,
    captureMetadata:      analysis.captureMetadata,
    manualCorrections: [
      analysis.closestSideSource === 'user' && analysis.closestSide
        ? `Closest side confirmed by athlete: ${analysis.closestSide}`
        : null,
      analysis.landmarkSource === 'user_corrected' ? 'Reference landmarks corrected by athlete' : null,
      analysis.captureMetadata?.subjectFacing && analysis.captureMetadata.subjectFacing !== 'unknown'
        ? `Subject facing confirmed as ${analysis.captureMetadata.subjectFacing.replace('_', ' ')}`
        : null,
      analysis.captureMetadata?.orientationConfirmed === false ? 'Saved-media orientation is unconfirmed' : null,
      analysis.legacyMeasurementsSuppressed?.length
        ? `Legacy measurements suppressed: ${analysis.legacyMeasurementsSuppressed.join(', ')}`
        : null,
    ].filter((value): value is string => Boolean(value)),
    manualReviewRequired: matrix.manualReviewRequired
      || analysis.status === 'needs_review'
      || analysis.confidence === 'manual_review'
      || analysis.captureMetadata?.orientationConfirmed === false,
    measurementConventionVersion: analysis.measurementConventionVersion ?? 1,
    legacyMeasurementsSuppressed: analysis.legacyMeasurementsSuppressed ?? [],
  };
}
