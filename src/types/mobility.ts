// ─── Mobility Workout Type System (Build 34, Wave 1B) ─────────────────────────
//
// Mirrors the shape of src/types/strength.ts: a static exercise/workout bank
// (src/constants/mobilityBank.ts) feeding a persisted completion log
// (src/store/mobilityStore.ts) and the Mobility segment of the Strength tab.
//
// Evidence contract: docs/movement-readiness-evidence.md. Every workout and
// exercise here must stay within that document's claim ceiling — mobility
// work is framed as ROM / comfort / movement-quality support, never as
// injury prevention or diagnosis.

export type MobilityCategory =
  | 'full_body'
  | 'problem_areas'
  | 'ankle'
  | 'hip'
  | 'back_spine'
  | 'pre_run'
  | 'post_run'
  | 'upper_body'
  | 'lower_body'
  | 'running_readiness'
  | 'walking_readiness';

// ─── Exercise definition (static library entry) ───────────────────────────────

export type MobilityDose = {
  sets?:     number;
  reps?:     number;
  holdSec?:  number;   // static hold duration, per rep
  timeSec?:  number;   // continuous timed exercise (e.g. cat-cow flow)
  perSide?:  boolean;  // true = dose applies to each side independently
};

export type MobilityExercise = {
  id:                   string;
  name:                 string;
  targetArea:           string;      // "Ankle · Calf", "Hip Flexors", etc.
  howTo:                string[];    // ordered coaching steps
  commonMistakes:       string[];
  whatItShouldFeelLike: string;
  whenToStopOrModify:   string;      // gentle, breathe, back off if sharp pain
  linkedFinding?:       string;      // readiness-assessment finding key this addresses
  dose:                 MobilityDose;
};

// ─── Planned exercise within a workout ────────────────────────────────────────

export type MobilityPlannedExercise = {
  exerciseId: string;
  dose?:      Partial<MobilityDose>;  // overrides the exercise's default dose
  cues:       string[];
};

// ─── Complete mobility workout ────────────────────────────────────────────────

export type MobilityWorkout = {
  id:                     string;
  title:                  string;
  purpose:                string;              // one-sentence what + why
  category:               MobilityCategory;    // primary category (for card grouping)
  categories:             MobilityCategory[];  // all categories this workout matches (for filter chips)
  targetAreas:            string[];
  recommendedFrequency:   string;               // "2–3x/week", "Before every run", etc.
  durationMin:            number;               // 8–15
  evidenceRationale:      string;               // one plain sentence, evidence-doc consistent
  cautionNote?:           string;
  exercises:              MobilityPlannedExercise[];
  linkedAssessmentFinding?: string;             // readiness-engine finding key (Wave 2)
};

// ─── Completion log entry (persisted) ─────────────────────────────────────────

export type MobilityCompletion = {
  id:            string;    // "mob_{workoutId}_{timestamp}"
  workoutId:     string;
  completedAt:   number;    // Date.now()
  durationMin?:  number;
  feedback?:     'easy' | 'right' | 'hard';
  notes?:        string;
};
