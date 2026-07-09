// ─── Running/Walking Readiness Assessment Types (Build 34, Wave 2) ────────────
//
// Evidence contract: docs/movement-readiness-evidence.md. Every field that
// feeds user-facing copy must stay within that document's claim ceiling —
// "may affect", "worth monitoring", "consider addressing" — never a
// diagnosis, never an injury-causation or injury-prediction claim.
//
// Product stance shown to users: "StrideOS uses movement findings to guide
// training decisions, not to diagnose injury."

// ─── Domains ──────────────────────────────────────────────────────────────────

export type ReadinessDomain =
  | 'ankle_mobility'
  | 'hip_mobility'
  | 'squat_pattern'
  | 'single_leg_control'
  | 'calf_capacity'
  | 'trunk_pelvic_control'
  | 'symmetry'
  | 'capture_quality';

// ─── Categories ───────────────────────────────────────────────────────────────
//
// Conservative by construction: missing or low-confidence data always
// degrades toward 'manual_review', never toward 'needs_attention'.

export type ReadinessCategory = 'good' | 'monitor' | 'needs_attention' | 'manual_review';

// ─── Tests ────────────────────────────────────────────────────────────────────

export type ReadinessTestId =
  | 'squat_side'
  | 'single_leg_squat'
  | 'split_stance_lunge'
  | 'heel_raise_left'
  | 'heel_raise_right'
  | 'knee_to_wall_left'
  | 'knee_to_wall_right'
  | 'gait_side_view'; // optional

export type ReadinessTestMethod = 'video' | 'photo' | 'manual';

export type ReadinessTestResult = {
  testId:        ReadinessTestId;
  method:        ReadinessTestMethod;
  analysisId?:   string;                                 // links to a MovementAnalysis (video/photo tests)
  manualValues?: Record<string, number | string | boolean>;
  captureRating?: 'good' | 'fair' | 'poor';
  skipped?:      boolean;
};

// ─── Domain result ────────────────────────────────────────────────────────────

export type DomainResult = {
  domain:     ReadinessDomain;
  category:   ReadinessCategory;
  leftValue?: number;
  rightValue?: number;
  unit?:      string;
  note:       string;                                    // plain-language, evidence-compliant
  confidence: 'high' | 'moderate' | 'low';
};

// ─── Assessment ───────────────────────────────────────────────────────────────

export type ReadinessAssessment = {
  id:        string;
  createdAt: number;
  updatedAt: number;

  activityFocus: 'running' | 'walking';

  testResults:    ReadinessTestResult[];
  domainResults:  DomainResult[];
  overall:        ReadinessCategory;

  keyFindings:                      string[];   // "may affect / worth monitoring / consider addressing" only
  recommendedMobilityWorkoutIds:    string[];
  trainingModificationSuggestions:  string[];   // at most 2-3, gentle
  captureQualitySummary:            string;

  evidenceVersion: 1;

  painReported?: boolean;   // pain reported anywhere → consult-a-clinician messaging, never interpreted
};
