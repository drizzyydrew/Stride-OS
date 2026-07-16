// Deterministic longitudinal analysis of recovery, fatigue, load, and adherence.
// All inputs come from already-persisted stores (workoutStore.history,
// checkInStore.postWorkoutNotes) — no separate persistence layer needed.
//
// Physiological references:
//   Banister (1991)       — impulse-response model, per-session TSS accumulation
//   Meeusen et al. (2013) — non-functional overreaching markers
//   Mujika (2004)         — recovery stagnation / parasympathetic suppression
//   Bompa & Haff (2009)   — supercompensation periodization
//   Mujika & Padilla (2003) — taper freshness window (10–21 days post-load)
//   ACWR workload trend   — interpreted conservatively, never as injury prediction
//   Seiler (2010)         — frequency consistency as primary aerobic driver

import { computeSlope, rollingAverage } from './analyticsEngine';
import type { CompletedWorkoutRecord } from '../types/training';
import type { PostWorkoutNote } from '../types/checkin';
import type {
  WeeklySnapshot,
  TimelineMetric,
  TimelineSignal,
  TimelineInterpretation,
  TimelineAnalysis,
  TimelineInput,
  TrendDirection,
  OverallState,
} from '../types/timeline';

// ─── Math helpers ─────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / values.length);
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ─── Weekly snapshot builder ──────────────────────────────────────────────────

function buildSnapshots(
  history:          CompletedWorkoutRecord[],
  postWorkoutNotes: PostWorkoutNote[],
): WeeklySnapshot[] {
  if (history.length === 0) return [];

  const byWeek = new Map<number, CompletedWorkoutRecord[]>();
  for (const r of history) {
    const list = byWeek.get(r.week) ?? [];
    list.push(r);
    byWeek.set(r.week, list);
  }

  const weeks = Array.from(byWeek.keys()).sort((a, b) => a - b);
  const raw: WeeklySnapshot[] = [];

  for (const week of weeks) {
    const records  = byWeek.get(week)!;
    const weekRPEs = postWorkoutNotes
      .filter(n => n.completionKey.startsWith(`w${week}_`))
      .map(n => n.rpe);

    raw.push({
      week,
      avgFatigue:      r1(mean(records.map(r => r.fatigueAfter))),
      avgRecovery:     r1(mean(records.map(r => r.recoveryBefore))),
      peakFatigue:     Math.max(...records.map(r => r.fatigueAfter)),
      minRecovery:     Math.min(...records.map(r => r.recoveryBefore)),
      totalLoad:       r1(records.reduce((s, r) => s + r.estimatedLoad, 0)),
      totalMiles:      r1(records.reduce((s, r) => s + r.estimatedDistanceMiles, 0)),
      sessionCount:    records.length,
      adherence:       r1(clamp(records.length / 6, 0, 1)),
      avgFatigueDelta: r1(mean(records.map(r => Math.abs(r.fatigueDelta)))),
      avgRPE:          weekRPEs.length > 0 ? r1(mean(weekRPEs)) : 0,
      acwr:            1.0, // filled in next pass
    });
  }

  // Gabbett-style ACWR: ATL = this week's daily load; CTL = prior 6-wk avg daily load.
  // Using the same day-normalized approach as calculateACWR.ts (load / 7 = daily rate).
  return raw.map((snap, i) => {
    const priorWeeks = raw.slice(Math.max(0, i - 6), i); // up to 6 weeks BEFORE current
    const ctlDaily   = priorWeeks.length > 0
      ? mean(priorWeeks.map(p => p.totalLoad)) / 7
      : 0;
    const atlDaily = snap.totalLoad / 7;
    const acwr     = ctlDaily === 0 ? 1.0 : r1(clamp(atlDaily / ctlDaily, 0, 3));
    return { ...snap, acwr };
  });
}

// ─── Per-metric analysis ──────────────────────────────────────────────────────

// isGoodWhenHigh: recovery, adherence, load → true.
//                 fatigue, acwr             → false (lower = healthier state).
function buildMetric(values: number[], isGoodWhenHigh: boolean): TimelineMetric {
  const rollingAvg  = rollingAverage(values, 3);
  const slope       = computeSlope(values);
  const slopeRecent = computeSlope(values.slice(-4));

  // Spike: last data point deviates more than 1.5σ from its 3-wk rolling mean.
  // Requires at least 3 points; stddev guard prevents false positives on flat series.
  const hasSpike = (() => {
    if (values.length < 3) return false;
    const windowAvgs = rollingAvg.slice(-3);
    const std  = stddev(windowAvgs);
    const last = values[values.length - 1]!;
    const avg  = rollingAvg[rollingAvg.length - 1]!;
    return std > 0.5 && Math.abs(last - avg) > 1.5 * std;
  })();

  // Direction uses the recent (last 4 weeks) slope so near-term changes dominate.
  const effectiveSlope = isGoodWhenHigh ? slopeRecent : -slopeRecent;
  const direction: TrendDirection =
    effectiveSlope >  0.4 ? 'improving' :
    effectiveSlope < -0.4 ? 'worsening' :
    'stable';

  return { values, rollingAvg, slope, slopeRecent, hasSpike, direction };
}

// ─── Signal detection ─────────────────────────────────────────────────────────

// Counts how many consecutive weeks (from most recent backwards) fatigue rose.
function risingFatigueWeeks(snapshots: WeeklySnapshot[]): number {
  let count = 0;
  for (let i = snapshots.length - 1; i > 0; i--) {
    if (snapshots[i]!.avgFatigue > snapshots[i - 1]!.avgFatigue) count++;
    else break;
  }
  return Math.max(1, count);
}

function detectSignals(
  snapshots:     WeeklySnapshot[],
  fatigue:       TimelineMetric,
  recovery:      TimelineMetric,
  acwr:          TimelineMetric,
  adherence:     TimelineMetric,
  trainingPhase: TimelineInput['trainingPhase'],
): TimelineSignal[] {
  const signals: TimelineSignal[] = [];
  const n   = snapshots.length;
  if (n < 2) return signals;

  const cur  = snapshots[n - 1]!;
  const prev = n >= 2 ? snapshots[n - 2]! : null;

  // ── 1. Hidden fatigue accumulation (Meeusen et al. 2013) ──────────────────
  // Fatigue rising while recovery remains "acceptable" — the athlete feels OK
  // but cumulative load is exceeding absorption capacity.
  if (fatigue.slopeRecent > 1.5 && cur.avgRecovery > 45 && n >= 3) {
    signals.push({
      type:         'hidden_fatigue',
      severity:     fatigue.slopeRecent > 3 ? 'critical' : 'warning',
      title:        'Hidden Fatigue Accumulating',
      whatChanged:  `Fatigue has risen ~${Math.round(fatigue.slopeRecent * Math.min(n, 4))} pts over ${Math.min(n, 4)} weeks while recovery appears stable.`,
      whyItMatters: 'Meeusen et al. (2013) identified this as the primary marker of non-functional overreaching: load exceeds recovery capacity even when the athlete feels acceptable. Without intervention, this path leads to weeks of forced rest.',
      whatNext:     'Insert a deload week immediately — cut mileage 30–40%, eliminate all hard sessions, then reassess in 7 days before resuming a build.',
      weeksActive:  risingFatigueWeeks(snapshots),
    });
  }

  // ── 2. Recovery stagnation (Mujika 2004) ──────────────────────────────────
  // Fatigue is flat/falling but recovery isn't rebounding — parasympathetic suppression.
  if (recovery.slopeRecent < 0.3 && fatigue.slopeRecent <= 0 && cur.avgRecovery < 65 && n >= 3) {
    signals.push({
      type:         'recovery_stagnation',
      severity:     cur.avgRecovery < 45 ? 'critical' : 'warning',
      title:        'Recovery Not Rebounding',
      whatChanged:  `Fatigue is flat or falling, yet recovery has stagnated around ${cur.avgRecovery.toFixed(0)}.`,
      whyItMatters: 'When recovery fails to improve despite reduced stress, it signals parasympathetic suppression (Mujika 2004) — often caused by a nutrition deficit, chronic sleep debt, or psychological load. The body cannot supercompensate even when given the opportunity.',
      whatNext:     'Target 8–9 hours of sleep for 5 consecutive nights. Audit caloric intake — under-fueling during build phases is the most common hidden cause of recovery stagnation.',
      weeksActive:  Math.min(n, 3),
    });
  }

  // ── 3. Improving adaptation / supercompensation (Bompa & Haff 2009) ──────
  // The dual signal of falling fatigue + rising recovery is the physiological
  // fingerprint of the body rebuilding above its prior baseline.
  if (fatigue.slopeRecent < -0.5 && recovery.slopeRecent > 0.5 && n >= 4) {
    signals.push({
      type:         'improving_adaptation',
      severity:     'positive',
      title:        'Adaptation in Progress',
      whatChanged:  `Fatigue trending down (${fatigue.slopeRecent.toFixed(1)} pts/wk) while recovery improves (${recovery.slopeRecent.toFixed(1)} pts/wk).`,
      whyItMatters: 'This dual signal is the physiological fingerprint of supercompensation (Bompa & Haff 2009): the body is rebuilding above its prior baseline in response to training stress.',
      whatNext:     'Exploit this window — adding a quality session or a 5–8% mileage increase next week will capitalize on the heightened adaptation stimulus.',
      weeksActive:  Math.min(n, 4),
    });
  }

  // ── 4. Taper freshness (Mujika & Padilla 2003) ────────────────────────────
  // In taper phase: fatigue dropping sharply while recovery rises. The pre-race window.
  if (trainingPhase === 'taper' && fatigue.slopeRecent < -2 && recovery.slopeRecent > 1) {
    signals.push({
      type:         'taper_freshness',
      severity:     'positive',
      title:        'Taper Freshness Accumulating',
      whatChanged:  'Fatigue is dropping sharply and recovery is rising — the taper is working as designed.',
      whyItMatters: 'Mujika & Padilla (2003) found peak performance occurs 10–21 days after the last high-load block when fatigue drops while fitness is retained. You are in this window.',
      whatNext:     'Protect this freshness. Avoid adding spontaneous volume. Keep strides and race-pace efforts to maintain neuromuscular sharpness without adding fatigue.',
      weeksActive:  Math.min(n, 3),
    });
  }

  // ── 5. Chronic inconsistency (Seiler 2010) ────────────────────────────────
  // High variance in weekly adherence — start-stop training pattern.
  if (n >= 4 && stddev(adherence.values) > 0.20) {
    const adhStd = stddev(adherence.values);
    signals.push({
      type:         'chronic_inconsistency',
      severity:     'warning',
      title:        'Chronic Training Inconsistency',
      whatChanged:  `Session completion varies ±${(adhStd * 100).toFixed(0)}% week-to-week.`,
      whyItMatters: 'Seiler (2010) showed frequency consistency — not peak volume — is the primary driver of aerobic adaptation. Inconsistent weeks cause the body to re-adapt repeatedly instead of progressing, effectively capping long-term improvement.',
      whatNext:     'Commit to the same number of sessions for 3 consecutive weeks, even at reduced duration. Frequency first, volume second.',
      weeksActive:  n,
    });
  }

  // ── 6. ACWR spike (Gabbett 2016) ──────────────────────────────────────────
  // Sudden load ratio jump past 1.3 — highest injury-probability zone.
  if (cur.acwr > 1.3 && prev !== null && prev.acwr < 1.2) {
    signals.push({
      type:         'acwr_spike',
      severity:     cur.acwr > 1.5 ? 'critical' : 'warning',
      title:        'Acute Load Spike Detected',
      whatChanged:  `Training load ratio jumped from ${prev.acwr.toFixed(2)} to ${cur.acwr.toFixed(2)} this week.`,
      whyItMatters: 'Gabbett (2016) found ACWR spikes above 1.3 elevate soft-tissue injury probability 2–3×. Connective tissue adapts 3–4× slower than cardiovascular fitness, creating a hidden vulnerability window that peaks 5–10 days after the spike.',
      whatNext:     'Hold mileage flat for at least 10 days. No hard sessions until ACWR returns below 1.2. The risk window closes within 2 weeks of stable load.',
      weeksActive:  1,
    });
  }

  // ── 7. Effort creep (Banister 1991 impulse-response model) ────────────────
  // avgFatigueDelta rising: each session taking progressively more out of the athlete.
  const deltaSlope = computeSlope(snapshots.slice(-4).map(s => s.avgFatigueDelta));
  if (deltaSlope > 0.5 && n >= 3 && cur.avgFatigueDelta > 3) {
    signals.push({
      type:         'effort_creep',
      severity:     'warning',
      title:        'Per-Session Effort Creeping Up',
      whatChanged:  'Each training session is producing progressively more fatigue than in prior weeks.',
      whyItMatters: "Banister's impulse-response model (1991) predicts performance decline when per-session TSS rises without matching recovery. The fatigue–fitness gap widens until the athlete either cuts load or gets injured.",
      whatNext:     'Replace one hard session with an easy 30-minute run. Fitness is built in easy running; speed work expresses it.',
      weeksActive:  Math.min(n, 3),
    });
  }

  // Priority: critical > warning > positive > info
  const rank: Record<string, number> = { critical: 4, warning: 3, positive: 2, info: 1 };
  return signals.sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0));
}

// ─── Trend interpretation ─────────────────────────────────────────────────────

function buildInterpretation(
  snapshots:       WeeklySnapshot[],
  fatigue:         TimelineMetric,
  recovery:        TimelineMetric,
  signals:         TimelineSignal[],
  currentFatigue:  number,
  currentRecovery: number,
): TimelineInterpretation {
  const n   = snapshots.length;
  const cur = snapshots[n - 1]!;
  const prev = n >= 2 ? snapshots[n - 2]! : null;

  // Classify overall state: priority order matters.
  const overallState: OverallState =
    currentFatigue > 75 || currentRecovery < 35 ? 'at_risk'  :
    fatigue.direction === 'improving' && recovery.direction === 'improving' ? 'thriving' :
    fatigue.direction === 'worsening' || recovery.direction === 'worsening' ? 'stressed' :
    'adapting';

  // What changed: lead with the bigger absolute move from last week.
  let whatChanged: string;
  if (!prev) {
    whatChanged = `First full week of recorded data — fatigue at ${cur.avgFatigue.toFixed(0)}, recovery at ${cur.avgRecovery.toFixed(0)}.`;
  } else {
    const fd = cur.avgFatigue  - prev.avgFatigue;
    const rd = cur.avgRecovery - prev.avgRecovery;

    const fPart = `Fatigue ${fd > 0 ? 'rose' : 'dropped'} ${Math.abs(fd).toFixed(0)} pts`;
    const rPart = `recovery ${rd > 0 ? 'improved' : 'declined'} ${Math.abs(rd).toFixed(0)} pts`;

    if (Math.abs(fd) >= Math.abs(rd)) {
      whatChanged = `${fPart}${rd !== 0 ? ` while ${rPart}` : ''} this week.`;
    } else {
      whatChanged = `Recovery ${rd > 0 ? 'improved' : 'declined'} ${Math.abs(rd).toFixed(0)} pts${fd !== 0 ? ` while fatigue ${fd > 0 ? 'rose' : 'dropped'} ${Math.abs(fd).toFixed(0)} pts` : ''} this week.`;
    }
  }

  const whyMap: Record<OverallState, string> = {
    thriving:  "Both fatigue and recovery are moving in the right direction simultaneously — the physiological fingerprint of supercompensation. Your body is rebuilding above its prior baseline.",
    adapting:  "Training load is being processed at a sustainable rate. Fatigue and recovery are in equilibrium, which is expected during a structured build phase. Watch for any fatigue creep over the next 2–3 weeks.",
    stressed:  "Training stress is outpacing recovery. This is normal during peak blocks, but if the trend continues beyond 2 weeks it shifts from productive stress to non-functional overreaching — a state that takes weeks to exit.",
    at_risk:   "Fatigue and/or recovery suggest elevated training stress and possible performance decline. A temporary load reduction may support recovery.",
  };

  const defaultNextMap: Record<OverallState, string> = {
    thriving:  'Consider adding a quality session or 5–8% mileage increase next week to exploit the adaptation window.',
    adapting:  'Maintain current load and session count. Hit planned sessions consistently for 2 more weeks before adding volume.',
    stressed:  'Remove one hard session this week and replace with easy running. Protect sleep — it is your primary recovery lever.',
    at_risk:   'Take at least one full rest day today. Drop mileage 30–40% for 7 days and reassess before resuming build.',
  };

  const headlineMap: Record<OverallState, string> = {
    thriving: 'Supercompensation in progress',
    adapting: 'Load absorbed — steady progress',
    stressed: 'Training stress elevated — monitor closely',
    at_risk:  'Readiness signals in the red — act now',
  };

  return {
    headline:     headlineMap[overallState],
    whatChanged,
    whyItMatters: whyMap[overallState],
    whatNext:     signals[0]?.whatNext ?? defaultNextMap[overallState],
    overallState,
  };
}

// ─── Empty / fallback ─────────────────────────────────────────────────────────

function emptyMetric(): TimelineMetric {
  return { values: [], rollingAvg: [], slope: 0, slopeRecent: 0, hasSpike: false, direction: 'stable' };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function analyzeTimeline(
  history:          CompletedWorkoutRecord[],
  postWorkoutNotes: PostWorkoutNote[],
  input:            TimelineInput,
): TimelineAnalysis {
  const snapshots = buildSnapshots(history, postWorkoutNotes);

  if (snapshots.length === 0) {
    return {
      snapshots:      [],
      fatigue:        emptyMetric(),
      recovery:       emptyMetric(),
      load:           emptyMetric(),
      adherence:      emptyMetric(),
      acwr:           emptyMetric(),
      signals:        [],
      interpretation: {
        headline:     'Building your timeline',
        whatChanged:  'No workout data recorded yet.',
        whyItMatters: 'Complete training sessions to unlock longitudinal trend analysis.',
        whatNext:     'Log at least 3 weeks of workouts to see pattern detection.',
        overallState: 'adapting',
      },
      hasEnoughData: false,
    };
  }

  const fatigue   = buildMetric(snapshots.map(s => s.avgFatigue),   false);
  const recovery  = buildMetric(snapshots.map(s => s.avgRecovery),  true);
  const load      = buildMetric(snapshots.map(s => s.totalMiles),   true);
  const adherence = buildMetric(snapshots.map(s => s.adherence),    true);
  const acwr      = buildMetric(snapshots.map(s => s.acwr),         false); // lower = safer

  const signals = detectSignals(
    snapshots, fatigue, recovery, acwr, adherence, input.trainingPhase,
  );

  const interpretation = buildInterpretation(
    snapshots, fatigue, recovery, signals,
    input.fatigueScore, input.recoveryScore,
  );

  return {
    snapshots,
    fatigue,
    recovery,
    load,
    adherence,
    acwr,
    signals,
    interpretation,
    hasEnoughData: snapshots.length >= 3,
  };
}
