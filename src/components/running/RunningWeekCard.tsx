// ─── Running Week Card ────────────────────────────────────────────────────────
//
// "This Week" overview for the Running screen. Mirrors StrengthWeekCard design.
// Shows: focus, run count, planned miles, completion, phase, key workout, long run day.
// Below: explanation of why this week matters.

import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { colors }  from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { TrainingPhase } from '../../types/training';

// ─── Props ────────────────────────────────────────────────────────────────────

export type RunningWeekCardProps = {
  phase:           TrainingPhase;
  currentWeek:     number;
  totalMileage:    number;
  sessionCount:    number;       // total planned runs this week
  completedCount:  number;       // completed runs this week
  keyWorkout:      string;       // e.g. "Threshold Run"
  longRunDay:      string | null; // e.g. "Saturday" or null if no long run
  focusSummary:    string;       // 1-line phase focus
  phaseRationale:  string;       // 2-3 sentence why this phase matters
  weekPriority:    string;       // what the athlete should prioritize this week
  isDeloadWeek:    boolean;
};

// ─── Phase config ────────────────────────────────────────────────────────────

const PHASE_BADGE: Record<TrainingPhase, { bg: string; text: string; label: string }> = {
  base:   { bg: '#0C2340', text: '#60A5FA', label: 'BASE'   },
  build:  { bg: '#1E3A8A', text: '#93C5FD', label: 'BUILD'  },
  peak:   { bg: '#3B0764', text: '#C084FC', label: 'PEAK'   },
  deload: { bg: '#451A03', text: '#FCD34D', label: 'DELOAD' },
  taper:  { bg: '#052E16', text: '#4ADE80', label: 'TAPER'  },
};

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileValue}>{value}</Text>
      {sub ? <Text style={s.tileSub}>{sub}</Text> : null}
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RunningWeekCard({
  phase, currentWeek, totalMileage, sessionCount, completedCount,
  keyWorkout, longRunDay, focusSummary, phaseRationale, weekPriority, isDeloadWeek,
}: RunningWeekCardProps) {
  const badge       = PHASE_BADGE[phase];
  const remaining   = sessionCount - completedCount;
  const progressPct = sessionCount > 0 ? completedCount / sessionCount : 0;

  return (
    <>
      {/* ── Main week card ── */}
      <Card style={s.card}>
        {/* Header row */}
        <View style={s.header}>
          <Badge label={badge.label} bg={badge.bg} color={badge.text} />
          {isDeloadWeek && (
            <View style={s.deloadBadge}>
              <Text style={s.deloadTxt}>DELOAD</Text>
            </View>
          )}
          <Text style={s.mileage}>{totalMileage.toFixed(1)} mi</Text>
        </View>

        <Text style={s.focusTxt}>{focusSummary}</Text>
        <Text style={s.weekLabel}>Week {currentWeek}</Text>

        {/* Stat row */}
        <View style={s.statsRow}>
          <StatTile
            label="Runs"
            value={`${sessionCount}`}
            sub={`${completedCount} done`}
          />
          <View style={s.divider} />
          <StatTile
            label="Key Workout"
            value={keyWorkout.length > 14 ? keyWorkout.split(' ').slice(0, 2).join(' ') : keyWorkout}
          />
          <View style={s.divider} />
          <StatTile
            label="Long Run"
            value={longRunDay ?? '—'}
          />
        </View>

        {/* Progress bar */}
        <View style={s.progressSection}>
          <View style={s.progressHeader}>
            <Text style={s.progressLabel}>WEEK PROGRESS</Text>
            <Text style={s.progressCount}>{completedCount}/{sessionCount}</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressPct * 100}%` as `${number}%` }]} />
          </View>
          <Text style={s.progressSub}>
            {remaining > 0 ? `${remaining} session${remaining > 1 ? 's' : ''} remaining` : 'Week complete ✓'}
          </Text>
        </View>
      </Card>

      {/* ── Explanation card ── */}
      <Card style={s.explainCard}>
        <Text style={s.explainTitle}>WHY THIS WEEK</Text>
        <Text style={s.explainBody}>{phaseRationale}</Text>
        <View style={s.priorityRow}>
          <Text style={s.priorityLabel}>PRIORITY</Text>
          <Text style={s.priorityTxt}>{weekPriority}</Text>
        </View>
      </Card>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card:    { marginBottom: spacing.cardGap },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.sm,
    marginBottom:   spacing.md,
  },
  deloadBadge: {
    backgroundColor: '#451A03',
    borderRadius:    Radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  deloadTxt: {
    color:         '#FCD34D',
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  mileage: {
    marginLeft: 'auto',
    color:      colors.text,
    fontSize:   28,
    fontWeight: FontWeight.black,
  },
  focusTxt: {
    color:        colors.text,
    fontSize:     FontSize.base,
    fontWeight:   FontWeight.bold,
    marginBottom: 2,
  },
  weekLabel: {
    color:        colors.textDim,
    fontSize:     FontSize.xs,
    marginBottom: spacing.md,
  },

  statsRow: {
    flexDirection:     'row',
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    paddingTop:        spacing.md,
    marginBottom:      spacing.md,
  },
  tile: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  tileValue: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
    textAlign:  'center',
  },
  tileSub: {
    color:    colors.textDim,
    fontSize: FontSize.xs,
  },
  tileLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign:     'center',
  },
  divider: {
    width:           1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },

  progressSection: { gap: spacing.xs },
  progressHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  progressCount: {
    color:      colors.text,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  progressTrack: {
    height:          6,
    backgroundColor: colors.border,
    borderRadius:    3,
    overflow:        'hidden',
  },
  progressFill: {
    height:          '100%',
    backgroundColor: colors.primary,
    borderRadius:    3,
  },
  progressSub: {
    color:    colors.textDim,
    fontSize: FontSize.xs,
  },

  explainCard: {
    marginBottom:    spacing.cardGap,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    gap:             spacing.md,
  },
  explainTitle: {
    color:         colors.primary,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  explainBody: {
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    lineHeight: 19,
  },
  priorityRow: { gap: 2 },
  priorityLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  priorityTxt: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: 18,
  },
});
