import type { TrainingPhase, ProgressionLevel, WorkoutType } from './training';

// ─── Insight taxonomy ─────────────────────────────────────────────────────────

export type InsightCategory =
  | 'recovery'               // recovery score trends
  | 'fatigue'                // fatigue accumulation patterns
  | 'adherence'              // session completion rate
  | 'overtraining'           // ACWR-based load management
  | 'consistency'            // week-to-week volume variance
  | 'long_run'               // long run adherence
  | 'intensity_distribution' // 80/20 easy-hard split analysis
  | 'taper'                  // taper-phase guidance
  | 'deload'                 // deload recommendations
  | 'form'                   // positive reinforcement when all signals are green
  | 'strength';              // strength training readiness, adherence, phase guidance

// Severity drives visual presentation and surface priority.
// positive — green celebration; info — neutral; caution — amber early warning;
// warning — orange actionable concern; critical — red urgent intervention.
export type InsightSeverity = 'info' | 'positive' | 'caution' | 'warning' | 'critical';

// ─── Individual insight ───────────────────────────────────────────────────────

export type CoachInsight = {
  id:         string;          // stable key for deduplication: 'category_signal'
  category:   InsightCategory;
  severity:   InsightSeverity;
  priority:   number;          // 1–10, higher surfaces first; see priorityFor()
  confidence: number;          // 0–100, driven by history depth + signal clarity

  title:  string;              // short headline ("Fatigue building quickly")
  body:   string;              // 1–2 sentences — the situation in plain language
  why:    string;              // physiological rationale the athlete can learn from
  action: string;              // one concrete next step
};

// ─── Weekly summary ───────────────────────────────────────────────────────────

export type WeekGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type WeeklyCoachSummary = {
  weekNumber:    number;
  grade:         WeekGrade;
  headline:      string;         // one sentence framing the week
  observations:  string[];       // 3 data-driven bullet observations
  nextWeekFocus: string;         // one concrete priority for the next 7 days
  topInsight:    CoachInsight | null;
};

// ─── Race readiness ───────────────────────────────────────────────────────────

export type RaceReadinessDimensions = {
  aerobicBase: number;  // long run consistency + training history depth (0–100)
  speedWork:   number;  // quality session presence + intensity distribution (0–100)
  recovery:    number;  // recovery score + inverse fatigue (0–100)
  consistency: number;  // week-to-week variance + adherence (0–100)
  peaking:     number;  // phase alignment + fatigue trajectory (0–100)
};

export type RaceReadinessSummary = {
  overallScore: number;
  label:        'race_ready' | 'on_track' | 'needs_work' | 'not_ready';
  confidence:   number;
  dimensions:   RaceReadinessDimensions;
  summary:      string;
  keyInsights:  string[];  // 3 one-sentence observations
};

// ─── Input ────────────────────────────────────────────────────────────────────

export type CoachingInput = {
  // Identity
  athleteName:      string;
  goalRace:         string;
  currentWeek:      number;
  trainingPhase:    TrainingPhase;
  progressionLevel: ProgressionLevel;
  weeklyMileage:    number;

  // Physiological state
  fatigueScore:  number;        // 0–100
  recoveryScore: number;        // 0–100
  soreness:      number | null; // 1–10, null if no check-in
  motivation:    number | null; // 1–10, null if no check-in

  // Today's context
  checkedIn:       boolean;
  todayWorkoutType: WorkoutType;
  isRestDay:       boolean;
  isTodayComplete: boolean;

  // Training load metrics (derived from history)
  acwr:               number;  // Acute:Chronic Workload Ratio
  adherenceRate:      number;  // 0–1: completed sessions / planned
  longRunConsistency: number;  // 0–1: fraction of weeks with a long run
  easyProportion:     number;  // 0–1: fraction of sessions at easy/very_easy
  historyWeeks:       number;  // distinct training weeks with completions
  consistencyScore:   number;  // 0–100, inverse coefficient of variation

  // OLS slopes from weekly trend series (positive = rising)
  fatigueSlope:  number;
  recoverySlope: number;

  // Plan context
  weeksRemaining: number;
};

// ─── Output ───────────────────────────────────────────────────────────────────

export type CoachingOutput = {
  allInsights:   CoachInsight[];        // full ranked list
  todayInsights: CoachInsight[];        // top 3, surface on Today screen
  weeklySummary: WeeklyCoachSummary;
  raceReadiness: RaceReadinessSummary;
};
