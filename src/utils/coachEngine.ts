// ─── Coach Intelligence Engine ────────────────────────────────────────────────
//
// COACHING THEORY BASIS
//
// The coach layer sits above the daily recommendation engine and adaptation engine.
// Where those tools answer "what should I do today?", the coach answers:
//   "How is training going? What patterns am I seeing? What should I prioritize?"
//
// Theoretical grounding:
//   80/20 Rule (Seiler 2010): 80% of training time at easy/very_easy intensity,
//     20% at threshold or above. Athletes training in the "gray zone" (moderate)
//     get the fatigue of hard work without the adaptation of quality work.
//   ACWR (Gabbett 2016): Optimal zone 0.8–1.3. Spikes above 1.5 predict injury.
//   Non-functional overreaching (Meeusen 2013): Combination of high fatigue,
//     high soreness, and low motivation signals parasympathetic suppression.
//   Supercompensation (Bompa 1999): Adaptation happens during recovery, not
//     loading. Athletes who never rest never improve.
//   Long run priority (Costill 1988): The long run is the #1 stimulus for
//     mitochondrial density, fat oxidation, and aerobic efficiency.
//
// PRIORITIZATION LOGIC
//
// priority = base(severity) + contextBonus + trendBonus
//   severity base: critical=9, warning=7, caution=5, positive=3, info=2
//   contextBonus +1: insight is directly relevant to today's session decision
//   trendBonus   +1: signal is worsening (makes the insight more urgent)
// Priority is capped at 10. Higher priority surfaces first.
//
// DEDUPLICATION
//
// One insight per category. Each generator returns the single most relevant
// insight for its domain (highest severity applicable), or null. No overlap
// across categories — each covers a distinct physiological or behavioral signal.
//
// AI REPLACEMENT POINTS
//
// This engine is designed to be incrementally replaced with AI:
//   1. `generateInsightText()` — replace with LLM for personalized, contextual language
//   2. `rankInsights()` — replace with a learned ranking model trained on athlete outcomes
//   3. `generateWeeklySummary()` — the headline and nextWeekFocus are the highest-value
//      LLM targets: free-text that benefits most from natural language generation
//   4. `generateRaceReadiness()` — replace dimensions with model predictions from full
//      training history, replacing heuristic weights with learned feature importances
//
// The type contract (CoachingInput → CoachingOutput) stays identical.

import type {
  CoachingInput,
  CoachingOutput,
  CoachInsight,
  InsightSeverity,
  WeeklyCoachSummary,
  WeekGrade,
  RaceReadinessSummary,
  RaceReadinessDimensions,
} from '../types/coaching';

// ─── Priority helpers ─────────────────────────────────────────────────────────

const SEVERITY_BASE: Record<InsightSeverity, number> = {
  critical: 9,
  warning:  7,
  caution:  5,
  positive: 3,
  info:     2,
};

function priorityFor(
  severity:    InsightSeverity,
  todayBonus:  boolean,
  trendBonus:  boolean,
): number {
  return Math.min(10, SEVERITY_BASE[severity] + (todayBonus ? 1 : 0) + (trendBonus ? 1 : 0));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Insight generators — one per category ────────────────────────────────────

function recoveryInsight(input: CoachingInput): CoachInsight | null {
  const { recoveryScore, recoverySlope, historyWeeks } = input;
  const declining = recoverySlope < -1;
  const improving = recoverySlope > 1;
  const conf      = Math.min(95, 50 + historyWeeks * 5);

  if (recoveryScore >= 80) {
    return {
      id: 'recovery_excellent', category: 'recovery', severity: 'positive',
      priority: priorityFor('positive', true, false), confidence: conf,
      title:  'Recovery looking great',
      body:   `Recovery is at ${recoveryScore}/100${improving ? ', and trending up' : ''}. Your body is primed to absorb training stress.`,
      why:    'High recovery indicates the parasympathetic nervous system has repaired prior training damage. This is when aerobic adaptations — mitochondrial biogenesis, capillarization, glycogen synthesis — are consolidated.',
      action: 'Maintain current sleep and nutrition habits. This is the time to execute planned quality sessions with full effort.',
    };
  }

  if (recoveryScore < 40) {
    return {
      id: 'recovery_critical', category: 'recovery', severity: 'critical',
      priority: priorityFor('critical', true, declining), confidence: conf,
      title:  'Recovery critically low',
      body:   `Recovery is at ${recoveryScore}/100${declining ? ', still declining' : ''}. Hard training now produces injury risk, not fitness.`,
      why:    'Below 40/100, sympathetic dominance suppresses protein synthesis and elevates cortisol. Adding load compounds the inflammatory response without triggering positive adaptation — the physiological equivalent of withdrawing from an empty account.',
      action: 'Rest or very gentle movement only. Prioritize 8+ hours sleep, hydration, and caloric intake. Reassess in 24 hours before committing to any intensity work.',
    };
  }

  if (recoveryScore < 55) {
    const sev: InsightSeverity = recoveryScore < 47 ? 'warning' : 'caution';
    return {
      id: 'recovery_suppressed', category: 'recovery', severity: sev,
      priority: priorityFor(sev, true, declining), confidence: conf,
      title:  declining ? 'Recovery declining' : 'Below-average recovery',
      body:   `Recovery at ${recoveryScore}/100${declining ? ` and trending down ${round1(Math.abs(recoverySlope))} pts/wk` : ''}. Training adaptation is limited in this window.`,
      why:    'Sub-55 recovery means the parasympathetic system hasn\'t fully repaired tissue from prior sessions. Applying more training stress compounds the deficit — you accumulate fatigue without the repair phase that converts stress to fitness.',
      action: 'Reduce today\'s session intensity by one level. Extend warm-up to 15 minutes. Aim for 8+ hours sleep tonight and avoid caffeine after 2 PM.',
    };
  }

  return null; // 55–79 is healthy — no insight needed
}

function fatigueInsight(input: CoachingInput): CoachInsight | null {
  const { fatigueScore, fatigueSlope, historyWeeks } = input;
  const building  = fatigueSlope > 1;
  const conf      = Math.min(90, 50 + historyWeeks * 5);

  if (fatigueScore > 80) {
    return {
      id: 'fatigue_overreach', category: 'fatigue', severity: 'critical',
      priority: priorityFor('critical', true, building), confidence: conf,
      title:  'Overreach threshold exceeded',
      body:   `Fatigue score is ${fatigueScore}/100${building ? ` and still rising +${round1(fatigueSlope)} pts/wk` : ''}. This is the non-functional overreaching zone.`,
      why:    'Above 80/100, cumulative neuromuscular fatigue begins to suppress performance rather than drive adaptation. Meeusen (2013) identifies this as the threshold where continued loading produces only injury and performance regression, not fitness.',
      action: 'Take 2–3 consecutive rest or very easy days. Do not attempt threshold or VO2 work. Reassess after fatigue drops below 70.',
    };
  }

  if (fatigueScore > 70) {
    return {
      id: 'fatigue_high', category: 'fatigue', severity: 'warning',
      priority: priorityFor('warning', true, building), confidence: conf,
      title:  'Fatigue running high',
      body:   `Fatigue at ${fatigueScore}/100${building ? ` — adding ${round1(fatigueSlope)} pts/wk` : ''}. Hard sessions will deepen the hole, not build fitness.`,
      why:    'Elevated fatigue narrows the quality-session window. When neuromuscular fatigue is high, effort and perceived exertion spike while actual training adaptation (VO2 stimulus, lactate clearance) drops. You pay full price for reduced benefit.',
      action: 'Replace any scheduled hard session this week with easy aerobic work. One genuine rest day in the next 48 hours accelerates recovery significantly.',
    };
  }

  if (fatigueScore > 60 && building) {
    return {
      id: 'fatigue_building', category: 'fatigue', severity: 'caution',
      priority: priorityFor('caution', false, true), confidence: conf,
      title:  'Fatigue accumulating',
      body:   `Fatigue is at ${fatigueScore}/100 and trending up +${round1(fatigueSlope)} pts/wk. Still in the productive range, but watch for signs of accumulation.`,
      why:    'Progressive fatigue accumulation is expected and desired during a training block — this is the "overload" half of supercompensation. The risk is when fatigue rises faster than the recovery window can clear, which tips into non-functional overreaching.',
      action: 'Add one extra easy day this week. Protect sleep (8h target). No adding extra mileage — hold the current volume.',
    };
  }

  if (fatigueScore < 35 && historyWeeks >= 2) {
    return {
      id: 'fatigue_managed', category: 'fatigue', severity: 'positive',
      priority: priorityFor('positive', false, false), confidence: conf,
      title:  'Fatigue well managed',
      body:   `Fatigue is at ${fatigueScore}/100 — low enough that training adaptations are consolidating fully.`,
      why:    'Low accumulated fatigue means the recovery-adaptation cycle is completing between training bouts. This is the physiological state where supercompensation produces measurable fitness gains.',
      action: 'You have a green light for quality work. Execute planned intensity sessions at full effort.',
    };
  }

  return null;
}

function adherenceInsight(input: CoachingInput): CoachInsight | null {
  const { adherenceRate, historyWeeks, currentWeek } = input;
  if (historyWeeks < 2) return null; // not enough data

  const conf = Math.min(85, 40 + historyWeeks * 6);
  const pct  = Math.round(adherenceRate * 100);

  if (adherenceRate >= 0.85) {
    return {
      id: 'adherence_strong', category: 'adherence', severity: 'positive',
      priority: priorityFor('positive', false, false), confidence: conf,
      title:  'Excellent training commitment',
      body:   `${pct}% of planned sessions completed across ${historyWeeks} weeks. Consistency is your biggest competitive advantage.`,
      why:    'Adherence above 85% is the single strongest predictor of training response. Consistent stimulus → consistent adaptation. The compounding effect of showing up for planned sessions outweighs any single "perfect" workout.',
      action: 'Keep the streak alive. When motivation is low, default to a short easy run rather than a full rest day — it maintains the habit loop.',
    };
  }

  if (adherenceRate < 0.55) {
    return {
      id: 'adherence_low', category: 'adherence', severity: 'warning',
      priority: priorityFor('warning', false, false), confidence: conf,
      title:  'Significant missed sessions',
      body:   `Only ${pct}% of planned sessions completed over ${historyWeeks} weeks. Accumulated gaps are limiting fitness development.`,
      why:    'Below 55% adherence, the training stimulus is too irregular to drive consistent adaptation. The aerobic system needs ~48–72h between stimuli to consolidate gains — with long gaps, you\'re repeatedly starting the adaptation curve from near-zero.',
      action: 'This week, aim to complete just 3 sessions at any intensity. Rebuilding the habit is more valuable than hitting any specific mileage target.',
    };
  }

  if (adherenceRate < 0.70) {
    return {
      id: 'adherence_fair', category: 'adherence', severity: 'caution',
      priority: priorityFor('caution', false, false), confidence: conf,
      title:  'Consistency slipping',
      body:   `${pct}% session completion over ${historyWeeks} weeks. Missed sessions are creating gaps in your aerobic stimulus.`,
      why:    'Aerobic fitness responds to frequency as much as volume. Skipping 30% of sessions — even replacing them with extra mileage on other days — reduces the number of separate adaptation signals your body receives each week.',
      action: `Week ${currentWeek}: commit to completing at least the 3 most important sessions (long run, threshold, easy run). Protect those days in your calendar now.`,
    };
  }

  return null; // 70–84% is fine — no insight needed
}

function overtrainingInsight(input: CoachingInput): CoachInsight | null {
  const { acwr, fatigueSlope, historyWeeks } = input;
  const conf     = Math.min(90, 40 + historyWeeks * 6);
  const rising   = fatigueSlope > 0.5;

  if (acwr > 1.5) {
    return {
      id: 'acwr_spike', category: 'overtraining', severity: 'critical',
      priority: priorityFor('critical', true, rising), confidence: conf,
      title:  'Acute training load spike',
      body:   `ACWR is ${acwr.toFixed(2)} — well above the 1.5 injury-risk ceiling. Soft tissue and immune function are under significant stress.`,
      why:    'Gabbett (2016) meta-analysis: ACWR > 1.5 is associated with a 3–4× increase in soft tissue injury risk. The acute workload has spiked far above what the chronic base has prepared tissue to handle, creating mechanical overload risk even at easy paces.',
      action: 'No hard sessions for 5–7 days. Drop weekly mileage by 30%. Focus on sleep, nutrition, and monitoring for early injury symptoms (localized pain, sharp tightness).',
    };
  }

  if (acwr > 1.3) {
    return {
      id: 'acwr_elevated', category: 'overtraining', severity: 'warning',
      priority: priorityFor('warning', true, rising), confidence: conf,
      title:  'Load ratio elevated',
      body:   `ACWR is ${acwr.toFixed(2)} — in the elevated-risk zone (ceiling: 1.3). Acute load is outpacing your chronic fitness base.`,
      why:    'Between 1.3 and 1.5, injury risk approximately doubles relative to the optimal zone. The chronic base (42-day average) represents tissue capacity built over weeks; spikes above this signal that acute load is exceeding what musculoskeletal structures can absorb.',
      action: 'Cap this week\'s mileage at last week\'s level. Replace any hard session with easy aerobic work. The next 2–3 weeks should be neutral or slightly reduced before building again.',
    };
  }

  if (acwr >= 0.8 && acwr <= 1.3 && historyWeeks >= 3) {
    return {
      id: 'acwr_optimal', category: 'overtraining', severity: 'positive',
      priority: priorityFor('positive', false, false), confidence: conf,
      title:  'Training load in optimal zone',
      body:   `ACWR is ${acwr.toFixed(2)} — in the ideal 0.8–1.3 range. Acute load is well-matched to your chronic fitness base.`,
      why:    'The 0.8–1.3 ACWR zone is where adaptation occurs without disproportionate injury risk. Fitness is built here: acute load is challenging enough to drive stimulus, but not so far above the chronic base that tissue capacity is overwhelmed.',
      action: 'Continue progressive load management. The next volume increase can be planned for next week — don\'t jump more than 10% in a single week.',
    };
  }

  if (acwr < 0.8 && historyWeeks >= 3) {
    return {
      id: 'acwr_low', category: 'overtraining', severity: 'info',
      priority: priorityFor('info', false, false), confidence: conf,
      title:  'Training load below stimulus threshold',
      body:   `ACWR is ${acwr.toFixed(2)} — in the under-training zone (below 0.8). Recent weeks are lighter than your fitness base.`,
      why:    'Below 0.8 ACWR, the training stimulus is insufficient to drive aerobic adaptation in a trained athlete. The chronic base is decaying faster than acute load is restoring it — detraining begins within 10–14 days of significantly reduced load.',
      action: 'If this is an intentional deload or taper, this is correct and expected. Otherwise, gradually increase mileage by 10–15% this week.',
    };
  }

  return null;
}

function consistencyInsight(input: CoachingInput): CoachInsight | null {
  const { consistencyScore, historyWeeks, adherenceRate } = input;
  if (historyWeeks < 3) return null;

  const conf = Math.min(80, 30 + historyWeeks * 5);

  if (consistencyScore >= 80) {
    return {
      id: 'consistency_excellent', category: 'consistency', severity: 'positive',
      priority: priorityFor('positive', false, false), confidence: conf,
      title:  'Rock-solid week-to-week consistency',
      body:   `Mileage variance is very low across ${historyWeeks} weeks — your training stimulus is highly predictable.`,
      why:    'Consistent weekly volume reduces injury risk dramatically. Erratic load — big week, small week, big week — creates repeated spikes in the acute:chronic ratio. Even consistent moderate-volume training produces better outcomes than irregular high-volume training.',
      action: 'This consistency is a real asset — protect it. Plan next week\'s mileage target now and commit to it before you start.',
    };
  }

  if (consistencyScore < 45) {
    return {
      id: 'consistency_low', category: 'consistency', severity: 'caution',
      priority: priorityFor('caution', false, false), confidence: conf,
      title:  'High week-to-week variability',
      body:   `Training volume is varying significantly week-to-week across ${historyWeeks} weeks. Irregular load spikes elevate injury risk.`,
      why:    'High weekly variance creates repeated acute:chronic spikes even if average mileage is appropriate. Tissue adapts to a consistent rhythm of stimulus and recovery — erratic loading means the chronic base never stabilizes, keeping the injury-risk window perpetually elevated.',
      action: 'For the next 3 weeks, set a fixed weekly mileage target and stick to ±5% of it. Predictability builds the chronic base that protects you during hard blocks.',
    };
  }

  return null;
}

function longRunInsight(input: CoachingInput): CoachInsight | null {
  const { longRunConsistency, historyWeeks, trainingPhase, fatigueScore } = input;
  if (historyWeeks < 2) return null;

  const conf          = Math.min(85, 40 + historyWeeks * 5);
  const phaseExempt   = trainingPhase === 'deload' || trainingPhase === 'taper';

  if (phaseExempt) {
    return {
      id: 'long_run_phase_appropriate', category: 'long_run', severity: 'info',
      priority: priorityFor('info', false, false), confidence: conf,
      title:  'Long run volume reduced intentionally',
      body:   `${trainingPhase === 'taper' ? 'Taper' : 'Deload'} week — reduced long run distance is correct and planned.`,
      why:    'Long run reduction during taper/deload is not a fitness loss — it is the final stimulus for supercompensation. The aerobic base built over prior weeks is consolidating during this lower-stress window.',
      action: trainingPhase === 'taper'
        ? 'Keep the long run shorter than normal. Focus on quality (controlled pace, good form) over distance.'
        : 'A 20–30% long run reduction is standard for deload weeks. Resume normal long run distance next week.',
    };
  }

  if (longRunConsistency >= 0.80) {
    return {
      id: 'long_run_consistent', category: 'long_run', severity: 'positive',
      priority: priorityFor('positive', false, false), confidence: conf,
      title:  'Long run consistency is excellent',
      body:   `Long runs completed in ${Math.round(longRunConsistency * 100)}% of training weeks. This is the foundation of marathon fitness.`,
      why:    'Holloszy (1967): the long run is the primary stimulus for mitochondrial density, fat oxidation efficiency, and aerobic enzyme activity in endurance athletes. Consistent weekly long runs compound adaptations that no other session can replicate.',
      action: 'Protect next week\'s long run slot in your schedule. Consider increasing duration by 5–10 minutes if fatigue allows.',
    };
  }

  if (longRunConsistency < 0.50) {
    return {
      id: 'long_run_low', category: 'long_run', severity: 'warning',
      priority: priorityFor('warning', false, false), confidence: conf,
      title:  'Long run consistency is low',
      body:   `Long runs completed in only ${Math.round(longRunConsistency * 100)}% of training weeks. Marathon aerobic base requires weekly long efforts.`,
      why:    'The long run drives adaptations that shorter-but-more-frequent sessions cannot replicate: glycogen depletion adaptation, fat metabolism training, and musculoskeletal resilience to prolonged loading. Missing it regularly limits race-day ceiling regardless of weekly mileage.',
      action: `This week, prioritize the long run above all other sessions. ${fatigueScore > 65 ? 'If fatigued, reduce the pace to conversational — the time on feet matters more than intensity.' : 'Target your planned long run distance.'}`,
    };
  }

  if (longRunConsistency < 0.70) {
    return {
      id: 'long_run_inconsistent', category: 'long_run', severity: 'caution',
      priority: priorityFor('caution', false, false), confidence: conf,
      title:  'Long run attendance could improve',
      body:   `Long runs in ${Math.round(longRunConsistency * 100)}% of weeks. Protecting this session consistently will compound aerobic gains.`,
      why:    'Long run adaptations build cumulatively. Each missed long run delays glycogen depletion adaptation and fat oxidation development — the two metabolic systems that determine marathon performance in the final 10k.',
      action: 'Block out long run day in your calendar for the next 4 weeks and treat it as unmovable. This one change will have the highest return on any adjustment you make.',
    };
  }

  return null;
}

function intensityDistributionInsight(input: CoachingInput): CoachInsight | null {
  const { easyProportion, historyWeeks, trainingPhase } = input;
  if (historyWeeks < 2) return null;

  const conf       = Math.min(80, 30 + historyWeeks * 5);
  const hardPct    = Math.round((1 - easyProportion) * 100);
  const easyPct    = Math.round(easyProportion * 100);

  if (easyProportion >= 0.78 && easyProportion <= 0.88) {
    return {
      id: 'intensity_polarized', category: 'intensity_distribution', severity: 'positive',
      priority: priorityFor('positive', false, false), confidence: conf,
      title:  'Excellent 80/20 intensity split',
      body:   `${easyPct}% of sessions at easy/very-easy intensity — textbook polarized distribution.`,
      why:    'Seiler (2010) meta-analysis of elite endurance athletes: 80% easy / 20% hard is the intensity distribution that maximizes aerobic adaptation while minimizing cumulative fatigue. Easy sessions build aerobic base; hard sessions drive VO2max and lactate threshold — the split determines whether hard sessions are absorbed effectively.',
      action: 'Maintain this ratio as mileage builds. When adding volume, add it at easy pace — don\'t drift into the gray zone.',
    };
  }

  if (easyProportion < 0.60) {
    return {
      id: 'intensity_too_hard', category: 'intensity_distribution', severity: 'warning',
      priority: priorityFor('warning', false, false), confidence: conf,
      title:  'Too much intensity — gray zone overload',
      body:   `${hardPct}% of sessions at moderate-hard effort. This "gray zone" accumulates fatigue without delivering the adaptation of true quality work.`,
      why:    'Seiler (2010): gray-zone training (moderate intensity) produces the fatigue of hard work without the adaptation of either easy aerobic development or quality stimulus. Athletes who train primarily at moderate effort plateau — they\'re too tired to go hard enough for VO2 adaptation, but too fast for aerobic base development.',
      action: 'Convert your next 2–3 moderate sessions to genuinely easy pace (conversational — you should be able to speak in sentences). Reserve hard effort exclusively for planned quality sessions.',
    };
  }

  if (easyProportion > 0.92 && trainingPhase !== 'deload' && trainingPhase !== 'taper' && trainingPhase !== 'base') {
    return {
      id: 'intensity_all_easy', category: 'intensity_distribution', severity: 'caution',
      priority: priorityFor('caution', false, false), confidence: conf,
      title:  'Consider adding quality sessions',
      body:   `${easyPct}% of sessions at easy pace — very conservative distribution for this phase of training.`,
      why:    'Aerobic development requires both volume at easy effort AND periodic quality stimulus. Easy running builds the engine; threshold and VO2 work build the ceiling. Without quality sessions in the build/peak phase, race-pace adaptation lags behind aerobic base.',
      action: 'Add one threshold or strides session this week. Start with 15–20 minutes of threshold effort embedded in an easy run to avoid a sharp load spike.',
    };
  }

  return null;
}

function taperInsight(input: CoachingInput): CoachInsight | null {
  if (input.trainingPhase !== 'taper') return null;

  const { fatigueScore, fatigueSlope, weeksRemaining } = input;
  const conf = 85;

  if (fatigueScore > 65) {
    return {
      id: 'taper_fatigue_high', category: 'taper', severity: 'caution',
      priority: priorityFor('caution', false, fatigueSlope > 0), confidence: conf,
      title:  'Taper fatigue still elevated',
      body:   `Fatigue at ${fatigueScore}/100 during taper — higher than ideal heading toward race week.`,
      why:    'Taper works by reducing training stimulus while maintaining intensity, allowing accumulated fatigue to clear while fitness (chronic adaptation) is preserved. High taper-phase fatigue means the acute load hasn\'t dropped enough to allow full supercompensation before race day.',
      action: 'Extend complete rest days. Eliminate all moderate-effort runs — keep everything genuinely easy or rest. The fitness is already built; protect it.',
    };
  }

  return {
    id: 'taper_active', category: 'taper', severity: 'info',
    priority: priorityFor('info', true, false), confidence: conf,
    title:  'Taper week — trust the process',
    body:   `${weeksRemaining <= 1 ? 'Race week is here' : `${weeksRemaining} weeks to race`}. Reduced volume is priming your neuromuscular system for peak performance.`,
    why:    'Taper research (Mujika 2010): 2–3 weeks of volume reduction (40–60%) while maintaining intensity produces 2–3% performance improvement on race day. The legs feel "heavy" in week 1 — this is normal glycogen supercompensation, not detraining.',
    action: 'Complete planned taper sessions at race pace effort. Resist the urge to add mileage when legs feel heavy. Focus on sleep, nutrition, and race-day logistics.',
  };
}

function deloadInsight(input: CoachingInput): CoachInsight | null {
  // Taper and deload phases handled by taperInsight; here we flag need for unplanned deload
  if (input.trainingPhase === 'taper' || input.trainingPhase === 'deload') return null;

  const { fatigueScore, recoveryScore, acwr, soreness } = input;
  const s = soreness ?? 5;

  const isMandatory  = fatigueScore > 82 || (fatigueScore > 72 && recoveryScore < 38);
  const isRecommended = !isMandatory && (fatigueScore > 72 || acwr > 1.35 || (fatigueScore > 60 && s >= 8));
  const isSuggested   = !isMandatory && !isRecommended && (fatigueScore > 62 || (acwr > 1.15 && fatigueScore > 55));

  if (isMandatory) {
    return {
      id: 'deload_mandatory', category: 'deload', severity: 'critical',
      priority: priorityFor('critical', true, true), confidence: 90,
      title:  'Deload is non-negotiable',
      body:   `Fatigue (${fatigueScore}/100) and recovery (${recoveryScore}/100) are at dangerous extremes. Continuing hard training risks injury and performance regression.`,
      why:    'Mandatory deload conditions indicate the stress-recovery balance has inverted: your body is now breaking down faster than it can repair. Forcing hard sessions at this point triggers the overreaching → overtraining continuum, which can sideline an athlete for weeks.',
      action: 'Immediately reduce volume by 40% and eliminate all sessions above easy intensity. Maintain this for 5–7 days regardless of how you feel on day 2–3.',
    };
  }

  if (isRecommended) {
    return {
      id: 'deload_recommended', category: 'deload', severity: 'warning',
      priority: priorityFor('warning', false, true), confidence: 80,
      title:  'Your body is asking for a lighter week',
      body:   `Multiple signals — fatigue ${fatigueScore}/100, ACWR ${acwr.toFixed(2)} — point toward a recovery week before load increases further.`,
      why:    'The supercompensation model requires alternating stress and recovery phases. A voluntary deload now converts accumulated training stress into measurable fitness gains, and prevents the involuntary one (injury, illness) that would cost more time.',
      action: 'Plan a deload week: reduce volume 25–30%, keep intensity but cut session duration. The week after a well-executed deload typically produces a training PB.',
    };
  }

  if (isSuggested) {
    return {
      id: 'deload_suggested', category: 'deload', severity: 'caution',
      priority: priorityFor('caution', false, false), confidence: 70,
      title:  'Consider a lighter day or two',
      body:   `Early warning signals are appearing: fatigue is at ${fatigueScore}/100. A small recovery stimulus now prevents a larger accumulation later.`,
      why:    'Proactive load management is more effective than reactive. Catching fatigue accumulation early — before it reaches warning levels — keeps training quality high without requiring a full deload week.',
      action: 'Add one extra rest or easy day this week. Delay any planned mileage increases by 7 days.',
    };
  }

  return null;
}

function formInsight(input: CoachingInput): CoachInsight | null {
  // Positive reinforcement when multiple systems are green simultaneously
  const { recoveryScore, fatigueScore, acwr, adherenceRate, historyWeeks } = input;
  if (historyWeeks < 3) return null;

  const allGreen =
    recoveryScore >= 70 &&
    fatigueScore < 50   &&
    acwr >= 0.8 && acwr <= 1.3 &&
    adherenceRate >= 0.80;

  if (allGreen) {
    return {
      id: 'form_peak', category: 'form', severity: 'positive',
      priority: priorityFor('positive', true, false), confidence: 88,
      title:  'Everything is clicking',
      body:   `Recovery up, fatigue down, load optimal, and adherence strong. You are in a genuine form window — use it.`,
      why:    'When all four physiological and behavioral signals align simultaneously, the athlete is in the best possible state for performance adaptation. This convergence is rare — it indicates the training block is working as designed.',
      action: 'Execute your key quality session this week with full effort and confidence. This is what the training has been building toward.',
    };
  }

  return null;
}

// ─── Insight pipeline ─────────────────────────────────────────────────────────

function generateAllInsights(input: CoachingInput): CoachInsight[] {
  const candidates = [
    recoveryInsight(input),
    fatigueInsight(input),
    adherenceInsight(input),
    overtrainingInsight(input),
    consistencyInsight(input),
    longRunInsight(input),
    intensityDistributionInsight(input),
    taperInsight(input),
    deloadInsight(input),
    formInsight(input),
  ].filter((x): x is CoachInsight => x !== null);

  // Sort by priority descending, then severity (critical first for ties)
  return candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return SEVERITY_BASE[b.severity] - SEVERITY_BASE[a.severity];
  });
}

function pickTodayInsights(all: CoachInsight[]): CoachInsight[] {
  // Surface the top 3 most urgent insights; always include critical/warning if present
  const urgent    = all.filter(i => i.severity === 'critical' || i.severity === 'warning');
  const remaining = all.filter(i => i.severity !== 'critical' && i.severity !== 'warning');
  const merged    = [...urgent, ...remaining];
  return merged.slice(0, 3);
}

// ─── Weekly summary ───────────────────────────────────────────────────────────

function computeWeekGrade(input: CoachingInput): WeekGrade {
  const adherenceScore  = input.adherenceRate * 40;
  const recoveryScore_  = Math.min(30, (input.recoveryScore / 100) * 30);
  const fatigueScore_   = Math.min(20, ((100 - input.fatigueScore) / 100) * 20);
  const consistScore    = Math.min(10, (input.consistencyScore / 100) * 10);
  const total           = adherenceScore + recoveryScore_ + fatigueScore_ + consistScore;
  if (total >= 83) return 'A';
  if (total >= 68) return 'B';
  if (total >= 53) return 'C';
  if (total >= 38) return 'D';
  return 'F';
}

function weekHeadline(input: CoachingInput, grade: WeekGrade): string {
  const { fatigueScore, recoveryScore, adherenceRate, trainingPhase } = input;

  if (trainingPhase === 'taper') return 'Taper week — reduce, rest, and prepare.';

  if (grade === 'A') {
    if (recoveryScore >= 75) return 'Outstanding week — recovery quality is driving strong adaptation.';
    return 'Strong week — consistency and load management working together.';
  }
  if (grade === 'B') {
    if (adherenceRate >= 0.80) return 'Solid week — consistency is the foundation.';
    return 'Productive week — recovery quality is supporting adaptation.';
  }
  if (grade === 'C') {
    if (fatigueScore > 65) return 'Heavy training week — fatigue is accumulating normally. Protect sleep.';
    return 'Mixed week — some areas need attention heading into next week.';
  }
  if (grade === 'D') return 'Challenging week — recovery must be the priority right now.';
  return 'Difficult week — back off load and rebuild consistency before pushing again.';
}

function weekObservations(input: CoachingInput): string[] {
  const { adherenceRate, recoveryScore, fatigueScore, acwr, longRunConsistency } = input;

  const obs: string[] = [];

  // Adherence
  const pct = Math.round(adherenceRate * 100);
  obs.push(pct >= 80
    ? `${pct}% of planned sessions completed — excellent commitment.`
    : `${pct}% session completion — missed sessions are limiting adaptation.`,
  );

  // Recovery/fatigue
  if (fatigueScore > 65) {
    obs.push(`Fatigue at ${fatigueScore}/100 — harder sessions will be less productive until this clears.`);
  } else if (recoveryScore >= 70) {
    obs.push(`Recovery at ${recoveryScore}/100 — your body is absorbing training well.`);
  } else {
    obs.push(`Recovery at ${recoveryScore}/100 with fatigue at ${fatigueScore}/100 — balanced but watch for accumulation.`);
  }

  // Load management
  if (acwr > 1.3) {
    obs.push(`ACWR ${acwr.toFixed(2)} — acute load is elevated. Next week should be at or below current volume.`);
  } else if (longRunConsistency >= 0.75) {
    obs.push('Long run consistency is strong — aerobic base is building on schedule.');
  } else {
    obs.push(`ACWR ${acwr.toFixed(2)} — training load is well-managed.`);
  }

  return obs;
}

function weekNextFocus(input: CoachingInput, grade: WeekGrade): string {
  const { fatigueScore, adherenceRate, trainingPhase, acwr } = input;

  if (trainingPhase === 'taper') return 'Continue taper — resist adding mileage. Execute race-pace efforts only.';
  if (trainingPhase === 'deload') return 'Deload week: protect sleep, eat well, and let adaptation consolidate.';
  if (fatigueScore > 72) return 'Priority: recovery. Reduce volume 15–20% before pushing load again.';
  if (acwr > 1.3) return 'Hold weekly mileage flat — let the chronic base catch up to the acute load before building.';
  if (adherenceRate < 0.60) return 'Focus on session completion over intensity — 3 easy completed > 1 perfect missed.';
  if (grade === 'A' || grade === 'B') return 'Maintain current trajectory. Add volume conservatively (≤10%) and protect the long run slot.';
  return 'Improve sleep consistency and lock in next week\'s sessions before the week starts.';
}

function generateWeeklySummary(
  input:      CoachingInput,
  allInsights: CoachInsight[],
): WeeklyCoachSummary {
  const grade        = computeWeekGrade(input);
  const topInsight   = allInsights.find(i => i.severity === 'critical' || i.severity === 'warning') ?? allInsights[0] ?? null;

  return {
    weekNumber:    input.currentWeek,
    grade,
    headline:      weekHeadline(input, grade),
    observations:  weekObservations(input),
    nextWeekFocus: weekNextFocus(input, grade),
    topInsight,
  };
}

// ─── Race readiness ───────────────────────────────────────────────────────────

function computeDimensions(input: CoachingInput): RaceReadinessDimensions {
  const {
    longRunConsistency, historyWeeks, easyProportion,
    recoveryScore, fatigueScore, consistencyScore, adherenceRate,
    trainingPhase, fatigueSlope, weeksRemaining,
  } = input;

  // Aerobic base: long run consistency (60%) + history depth (40%)
  const aerobicBase = Math.round(
    longRunConsistency * 60 +
    Math.min(historyWeeks / 16, 1) * 40,
  );

  // Speed work: quality session presence from intensity distribution (55-25% hard = optimal)
  const hardProportion = 1 - easyProportion;
  const speedWork = Math.round(
    hardProportion >= 0.15 && hardProportion <= 0.28 ? 90 :
    hardProportion >= 0.10 && hardProportion <= 0.35 ? 70 :
    hardProportion >= 0.05 && hardProportion <= 0.40 ? 50 :
    30,
  );

  // Recovery: current recovery score (60%) + inverse fatigue (40%)
  const recovery = Math.round(Math.min(100,
    recoveryScore * 0.60 + (100 - fatigueScore) * 0.40,
  ));

  // Consistency: week-to-week variance (60%) + adherence (40%)
  const consistency = Math.round(Math.min(100,
    consistencyScore * 0.60 + adherenceRate * 40,
  ));

  // Peaking: phase alignment (primary) + fatigue trajectory (modifier)
  const phaseBase =
    trainingPhase === 'taper'  ? 95 :
    trainingPhase === 'peak'   ? 82 :
    trainingPhase === 'build'  ? 68 :
    trainingPhase === 'base'   ? 55 :
    trainingPhase === 'deload' ? 50 :
    55;
  // Race proximity bonus: extra alignment if in peak/taper with ≤6 weeks remaining
  const proximityBonus = (trainingPhase === 'taper' || trainingPhase === 'peak') && weeksRemaining <= 6 ? 5 : 0;
  // Fatigue trajectory modifier: dropping fatigue = good for race prep
  const fatigueBonus = fatigueSlope < -1 ? 5 : fatigueSlope > 1 ? -5 : 0;
  const peaking = Math.max(0, Math.min(100, phaseBase + proximityBonus + fatigueBonus));

  return { aerobicBase, speedWork, recovery, consistency, peaking };
}

function generateRaceReadiness(input: CoachingInput): RaceReadinessSummary {
  const dims = computeDimensions(input);
  const conf = Math.min(95, 35 + input.historyWeeks * 6);

  // Weighted overall score
  const overall = Math.round(
    dims.aerobicBase * 0.35 +
    dims.speedWork   * 0.20 +
    dims.recovery    * 0.25 +
    dims.consistency * 0.10 +
    dims.peaking     * 0.10,
  );

  const label: RaceReadinessSummary['label'] =
    overall >= 78 ? 'race_ready'  :
    overall >= 62 ? 'on_track'    :
    overall >= 45 ? 'needs_work'  :
    'not_ready';

  // Identify strongest and weakest dimensions for key insights
  const dimEntries = Object.entries(dims) as [keyof RaceReadinessDimensions, number][];
  const sorted     = [...dimEntries].sort(([, a], [, b]) => b - a);
  const strongest  = sorted[0]!;
  const weakest    = sorted[sorted.length - 1]!;

  const DIM_LABEL: Record<keyof RaceReadinessDimensions, string> = {
    aerobicBase: 'Aerobic base',
    speedWork:   'Speed work',
    recovery:    'Recovery',
    consistency: 'Consistency',
    peaking:     'Phase alignment',
  };

  const keyInsights: string[] = [
    `${DIM_LABEL[strongest[0]]}: ${strongest[1]}/100 — ${
      strongest[0] === 'aerobicBase' ? 'long run consistency is building the endurance ceiling' :
      strongest[0] === 'speedWork'   ? 'quality session balance is strong' :
      strongest[0] === 'recovery'    ? 'physiological state is primed for performance' :
      strongest[0] === 'consistency' ? 'regular training rhythm is compounding aerobic gains' :
      'phase alignment is optimal for the race timeline'
    }.`,
    `${DIM_LABEL[weakest[0]]}: ${weakest[1]}/100 — ${
      weakest[0] === 'aerobicBase' ? 'increase long run adherence to build endurance capacity' :
      weakest[0] === 'speedWork'   ? 'add structured quality sessions to raise lactate threshold' :
      weakest[0] === 'recovery'    ? 'reduce fatigue before peak race fitness can express itself' :
      weakest[0] === 'consistency' ? 'reduce week-to-week volume variance to protect injury risk' :
      'align training phase with race proximity for optimal taper timing'
    }.`,
    input.weeksRemaining <= 3
      ? 'Race week: protect fitness, maximize freshness, and trust the training.'
      : input.weeksRemaining <= 8
      ? `${input.weeksRemaining} weeks to race — enough time to make meaningful gains in weak dimensions.`
      : 'Early in the training block — aerobic base and consistency are the highest-return investments now.',
  ];

  const summary =
    label === 'race_ready'  ? `Overall readiness at ${overall}/100 — you\'re prepared to race well. Maintain current trajectory.` :
    label === 'on_track'    ? `Overall readiness at ${overall}/100 — on track. Focus on the weakest dimension to unlock the next level.` :
    label === 'needs_work'  ? `Overall readiness at ${overall}/100 — gaps remain. Consistent execution over the next 4–6 weeks will close them.` :
    `Overall readiness at ${overall}/100 — significant development needed before race day. Build foundation first.`;

  return {
    overallScore:  overall,
    label,
    confidence:    conf,
    dimensions:    dims,
    summary,
    keyInsights,
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function generateCoachingOutput(input: CoachingInput): CoachingOutput {
  const allInsights   = generateAllInsights(input);
  const todayInsights = pickTodayInsights(allInsights);
  const weeklySummary = generateWeeklySummary(input, allInsights);
  const raceReadiness = generateRaceReadiness(input);

  return { allInsights, todayInsights, weeklySummary, raceReadiness };
}
