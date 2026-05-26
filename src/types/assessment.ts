// ─── Strength & Movement Capacity Assessment Types ────────────────────────────
//
// Manual field tests for baseline capacity measurement.
// Normative references: conservative estimates from peer-reviewed literature.
// Confidence labels reflect evidence quality — do not claim false precision.
//
// Business logic in: src/utils/assessmentEngine.ts
// Store: src/store/assessmentStore.ts

// ─── Test catalogue ───────────────────────────────────────────────────────────

export type AssessmentTestKey =
  | 'single_leg_calf_raise'    // reps — Hébert-Losier 2017
  | 'bent_knee_soleus'          // reps — conservative estimate, limited RCT data
  | 'single_leg_squat'          // quality 1–5
  | 'side_plank'                // seconds — McGill 2002
  | 'single_leg_bridge'         // reps — endurance
  | 'hip_abduction'             // reps side-lying
  | 'plank'                     // seconds
  | 'step_down'                 // quality 1–5
  | 'hop_landing';              // quality 1–5, optional

export type AssessmentValueUnit = 'reps' | 'seconds' | 'quality_1_5';
export type AssessmentSide      = 'left' | 'right' | 'bilateral';
export type AssessmentRating    = 'below_expected' | 'expected' | 'above_expected';
export type AssessmentConfidence = 'high' | 'moderate' | 'low';

// ─── Normative context ────────────────────────────────────────────────────────
//
// Each test defines expected ranges that adjust for age, sex, and training status.
// These are COACHING REFERENCE RANGES, not diagnostic thresholds.

export type NormativeRange = {
  below:  number;   // value < below → below_expected
  above:  number;   // value >= above → above_expected
  // between below and above → expected
};

// ─── Per-test definition (static metadata, not stored per athlete) ────────────

export type AssessmentTestDef = {
  key:          AssessmentTestKey;
  label:        string;
  description:  string;
  unit:         AssessmentValueUnit;
  sides:        'unilateral' | 'bilateral';
  instructions: string[];
  normRanges:   {
    default:    NormativeRange;
    over50?:    NormativeRange;   // age-adjusted norms
    beginner?:  NormativeRange;   // training-status adjustment
  };
  evidenceNote: string;           // what the literature actually says
  confidence:   AssessmentConfidence;
  retestWeeks:  number;
  influencesScores: string[];     // which performance dimensions this affects
};

// ─── Result record ────────────────────────────────────────────────────────────

export type AssessmentResult = {
  id:             string;
  testKey:        AssessmentTestKey;
  date:           string;       // "YYYY-MM-DD"
  testedAt:       number;       // Date.now()
  value:          number;
  valueUnit:      AssessmentValueUnit;
  side?:          AssessmentSide;
  notes?:         string;
  rating:         AssessmentRating;
  confidence:     AssessmentConfidence;
  interpretation: string;       // 1–2 sentence contextual note
};

// ─── Assessment summary (all latest results) ──────────────────────────────────

export type AssessmentSummary = {
  results:      AssessmentResult[];
  lastAssessedAt: number | null;
  nextDueAt:    number | null;     // timestamp when retest is due
  flaggedTests: AssessmentTestKey[]; // tests rated below_expected
};
