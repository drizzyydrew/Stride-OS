import type { CoachInsight } from '../types/coaching';
import type {
  PlannedAction,
  ActionPlanInput,
  ActionCategory,
  ActionDueWindow,
  ActionPriority,
} from '../types/actionPlan';

// ─── Action template ──────────────────────────────────────────────────────────

type ActionTemplate = {
  slug:      string;
  title:     string;
  reason:    string;
  category:  ActionCategory;
  dueWindow: ActionDueWindow;
  priority:  ActionPriority;
};

// ─── Per-insight action templates ─────────────────────────────────────────────
// Each insight ID maps to 1–2 concrete actions. Severity already filtered in
// coachEngine; here we provide context-specific actions for each scenario.

const INSIGHT_ACTIONS: Record<string, ActionTemplate[]> = {
  recovery_critical: [
    {
      slug: 'skip_hard',
      title: 'Replace hard session with easy 20-min jog or rest',
      reason: 'Your recovery score is critically low — hard effort now deepens the hole, not your fitness.',
      category: 'recovery',
      dueWindow: 'today',
      priority: 'high',
    },
    {
      slug: 'sleep_target',
      title: 'Target 8–9 hours of sleep tonight',
      reason: 'Sleep is the single most effective recovery lever. One good night shifts scores measurably.',
      category: 'habit',
      dueWindow: 'today',
      priority: 'high',
    },
  ],
  recovery_warning: [
    {
      slug: 'reduce_intensity',
      title: 'Keep today\'s effort conversational — no hard zones',
      reason: 'Recovery is below 55. Moderate intensity is fine; high intensity will delay your bounce-back.',
      category: 'recovery',
      dueWindow: 'today',
      priority: 'medium',
    },
    {
      slug: 'add_recovery_day',
      title: 'Schedule one extra recovery day this week',
      reason: 'A single additional easy day compresses recovery time and sets you up for a quality workout later.',
      category: 'load_management',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],
  recovery_positive: [
    {
      slug: 'quality_session',
      title: 'Today is a good day for a quality workout',
      reason: 'Recovery score is strong. Use this window for your most demanding session of the week.',
      category: 'training',
      dueWindow: 'today',
      priority: 'medium',
    },
  ],

  fatigue_critical: [
    {
      slug: 'mandatory_rest',
      title: 'Take a full rest day today',
      reason: 'Fatigue is at a critical level. Training through this accelerates injury risk, not adaptation.',
      category: 'recovery',
      dueWindow: 'today',
      priority: 'high',
    },
    {
      slug: 'reduce_week_mileage',
      title: 'Cut this week\'s mileage by 30–40%',
      reason: 'A one-week reduction now prevents weeks of forced rest from overuse injury later.',
      category: 'load_management',
      dueWindow: 'this_week',
      priority: 'high',
    },
  ],
  fatigue_warning: [
    {
      slug: 'drop_intensity',
      title: 'Convert today\'s session to an easy effort',
      reason: 'Fatigue above 70 means adaptation is stalled. Easy work maintains aerobic base without digging deeper.',
      category: 'training',
      dueWindow: 'today',
      priority: 'high',
    },
    {
      slug: 'cap_duration',
      title: 'Cap all runs this week at 45 minutes',
      reason: 'Duration drives fatigue accumulation more than pace. Shorter runs let fitness accrue safely.',
      category: 'load_management',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],
  fatigue_positive: [
    {
      slug: 'hold_load',
      title: 'Maintain current training load — you\'re absorbing it well',
      reason: 'Low fatigue with consistent training is the ideal adaptation window.',
      category: 'habit',
      dueWindow: 'this_week',
      priority: 'low',
    },
  ],

  adherence_positive: [
    {
      slug: 'adherence_maintain',
      title: 'Keep your current session completion rate',
      reason: 'Consistency above 85% is a strong predictor of race performance. Protect the streak.',
      category: 'habit',
      dueWindow: 'this_week',
      priority: 'low',
    },
  ],
  adherence_warning: [
    {
      slug: 'schedule_sessions',
      title: 'Block 3 specific training windows on your calendar this week',
      reason: 'Adherence below 55% compounds over weeks. Scheduled sessions are 40% more likely to happen.',
      category: 'habit',
      dueWindow: 'this_week',
      priority: 'high',
    },
  ],
  adherence_caution: [
    {
      slug: 'protect_key_runs',
      title: 'Prioritize the long run and one quality session this week',
      reason: 'If you can only do two runs, make them count. Long run + quality covers 80% of the fitness stimulus.',
      category: 'training',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],

  acwr_critical: [
    {
      slug: 'no_hard_5d',
      title: 'No hard sessions for the next 5 days',
      reason: 'ACWR above 1.5 puts you in the highest injury probability zone. Soft-pedal now to reset.',
      category: 'load_management',
      dueWindow: 'today',
      priority: 'high',
    },
    {
      slug: 'cut_mileage_30',
      title: 'Drop weekly mileage by 30% this week',
      reason: 'Bringing ACWR back below 1.3 takes 5–7 days of reduced load. Start the correction now.',
      category: 'load_management',
      dueWindow: 'this_week',
      priority: 'high',
    },
  ],
  acwr_warning: [
    {
      slug: 'hold_load_acwr',
      title: 'Hold mileage flat — no increases this week',
      reason: 'ACWR is elevated. Adding load now risks compounding the spike. Flat is the safe call.',
      category: 'load_management',
      dueWindow: 'this_week',
      priority: 'high',
    },
  ],
  acwr_positive: [
    {
      slug: 'steady_build',
      title: 'Increase weekly volume by no more than 10%',
      reason: 'ACWR is in the optimal zone. The 10% rule keeps you here while building fitness.',
      category: 'training',
      dueWindow: 'next_week',
      priority: 'low',
    },
  ],
  acwr_low: [
    {
      slug: 'ramp_load',
      title: 'Add one easy session this week to build chronic load',
      reason: 'Low ACWR means your body is undertrained relative to recent baseline. Gentle build is appropriate.',
      category: 'training',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],

  consistency_positive: [
    {
      slug: 'consistency_protect',
      title: 'Protect your weekly run streak — don\'t skip this week',
      reason: 'High consistency is the strongest predictor of endurance improvement. Guard it.',
      category: 'habit',
      dueWindow: 'this_week',
      priority: 'low',
    },
  ],
  consistency_caution: [
    {
      slug: 'consistency_daily',
      title: 'Run at least 5 days this week, even if short',
      reason: 'Frequency builds the aerobic base more than any single long session. Five easy days beats two hard ones.',
      category: 'habit',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],

  long_run_positive: [
    {
      slug: 'long_run_great',
      title: 'Continue your long run streak this weekend',
      reason: 'Long runs done ≥80% of weeks drive the majority of aerobic development. Keep the pattern.',
      category: 'habit',
      dueWindow: 'this_week',
      priority: 'low',
    },
  ],
  long_run_warning: [
    {
      slug: 'schedule_long_run',
      title: 'Schedule this weekend\'s long run now',
      reason: 'Missing more than 30% of planned long runs significantly weakens aerobic base over the training block.',
      category: 'training',
      dueWindow: 'this_week',
      priority: 'high',
    },
  ],
  long_run_caution: [
    {
      slug: 'protect_long_run',
      title: 'Protect the long run — make it non-negotiable this week',
      reason: 'Long run consistency below 70% is the most common reason for race-day underperformance.',
      category: 'training',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],
  long_run_exempt: [],

  intensity_positive: [
    {
      slug: 'maintain_80_20',
      title: 'Maintain your 80/20 intensity split this week',
      reason: 'You\'re in the optimal polarized zone. Consistency here compounds over weeks.',
      category: 'habit',
      dueWindow: 'this_week',
      priority: 'low',
    },
  ],
  intensity_warning: [
    {
      slug: 'add_easy_runs',
      title: 'Replace one moderate run with a true easy run this week',
      reason: 'Too much moderate intensity drives fatigue without the aerobic adaptation of easy running.',
      category: 'training',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],
  intensity_caution: [
    {
      slug: 'reintroduce_moderate',
      title: 'Add one moderate-effort run to break up the easy block',
      reason: 'Running too easy for too long reduces speed-reserve. One moderate session per week maintains it.',
      category: 'training',
      dueWindow: 'this_week',
      priority: 'low',
    },
  ],

  taper_caution: [
    {
      slug: 'trust_taper',
      title: 'Resist adding volume — trust the taper process',
      reason: 'Taper anxiety is normal. Adding mileage now erases the freshness you\'ve been building.',
      category: 'race_prep',
      dueWindow: 'this_week',
      priority: 'high',
    },
    {
      slug: 'reduce_fatigue',
      title: 'Add a 20-minute walk or gentle mobility session today',
      reason: 'Low-impact movement flushes lactate and lowers fatigue without disrupting the taper.',
      category: 'recovery',
      dueWindow: 'today',
      priority: 'medium',
    },
  ],
  taper_info: [
    {
      slug: 'race_prep_checklist',
      title: 'Complete your pre-race logistics checklist this week',
      reason: 'Gear, nutrition, course preview, and sleep schedule locked in early reduce race-day stress.',
      category: 'race_prep',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],

  deload_mandatory: [
    {
      slug: 'execute_deload',
      title: 'Execute a full deload: 40% mileage reduction this week',
      reason: 'Your combined fatigue and recovery signals indicate accumulated load your body can\'t absorb. Deload now or risk forced rest.',
      category: 'load_management',
      dueWindow: 'today',
      priority: 'high',
    },
  ],
  deload_recommended: [
    {
      slug: 'reduce_30',
      title: 'Reduce this week\'s mileage by 25–30%',
      reason: 'A planned reduction now prevents the unplanned kind. Your body is signalling load accumulation.',
      category: 'load_management',
      dueWindow: 'this_week',
      priority: 'high',
    },
  ],
  deload_suggested: [
    {
      slug: 'light_week',
      title: 'Make this a lighter week — skip one optional session',
      reason: 'Early deload signals are easier to respond to than late ones. A minor reduction resets the trend.',
      category: 'load_management',
      dueWindow: 'this_week',
      priority: 'medium',
    },
  ],

  form_peak: [
    {
      slug: 'quality_window',
      title: 'Target your most demanding workout of the week today',
      reason: 'All four readiness signals are green. This is a rare peak window — don\'t waste it on an easy run.',
      category: 'training',
      dueWindow: 'today',
      priority: 'high',
    },
  ],
};

// ─── Priority ordering ────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<ActionPriority, number>  = { high: 3, medium: 2, low: 1 };
const DUE_RANK:      Record<ActionDueWindow, number> = { today: 3, this_week: 2, next_week: 1 };

// ─── Deduplication key ────────────────────────────────────────────────────────
// One action per (category × dueWindow) slot — prevents showing two "recovery today" actions.

function dedupeKey(a: ActionTemplate): string {
  return `${a.category}:${a.dueWindow}`;
}

// ─── Public engine ────────────────────────────────────────────────────────────

export function generateActionPlan(
  insights: CoachInsight[],
  input:    ActionPlanInput,
): PlannedAction[] {
  const seen  = new Set<string>();
  const actions: PlannedAction[] = [];

  // Walk insights in priority order (highest first) to prefer more urgent templates.
  const sorted = [...insights].sort((a, b) => b.priority - a.priority);

  for (const insight of sorted) {
    const templates = INSIGHT_ACTIONS[insight.id] ?? [];

    for (const tpl of templates) {
      const key = dedupeKey(tpl);
      if (seen.has(key)) continue;
      seen.add(key);

      actions.push({
        id:              `w${input.currentWeek}_${insight.id}_${tpl.slug}`,
        title:           tpl.title,
        reason:          tpl.reason,
        category:        tpl.category,
        priority:        tpl.priority,
        dueWindow:       tpl.dueWindow,
        sourceInsightId: insight.id,
      });

      if (actions.length >= 5) break;
    }
    if (actions.length >= 5) break;
  }

  // Sort: priority desc, then dueWindow urgency desc.
  actions.sort((a, b) => {
    const pd = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (pd !== 0) return pd;
    return DUE_RANK[b.dueWindow] - DUE_RANK[a.dueWindow];
  });

  return actions.slice(0, 3);
}
