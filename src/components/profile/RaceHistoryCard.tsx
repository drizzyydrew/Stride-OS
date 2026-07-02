import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import { vdotFromRacePR } from '../../utils/calibrationEngine';
import type { RacePR } from '../../types/athlete';

type Props = {
  racePRs:   RacePR[];
  onAdd?:    () => void;
  onRemove?: (prId: string) => void;
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function PRRow({
  pr,
  onRemove,
}: {
  pr:        RacePR;
  onRemove?: (id: string) => void;
}) {
  const colors = useThemeColors();
  const row    = useMemo(() => createRowStyles(colors), [colors]);
  const vdot = vdotFromRacePR(pr.distanceMeters, pr.timeSeconds);

  return (
    <View style={row.wrap}>
      <View style={row.left}>
        <View style={row.topLine}>
          <Text style={row.distance}>{pr.distanceLabel}</Text>
          {!pr.official && (
            <View style={row.ttBadge}>
              <Text style={row.ttText}>TIME TRIAL</Text>
            </View>
          )}
        </View>
        <View style={row.bottomLine}>
          <Text style={row.time}>{formatTime(pr.timeSeconds)}</Text>
          <Text style={row.sep}>·</Text>
          <Text style={row.meta}>{formatDate(pr.date)}</Text>
          {pr.course ? (
            <>
              <Text style={row.sep}>·</Text>
              <Text style={row.meta}>{pr.course}</Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={row.right}>
        <View style={row.vdotBadge}>
          <Text style={row.vdotValue}>{vdot.toFixed(1)}</Text>
          <Text style={row.vdotLabel}>VDOT</Text>
        </View>
        {onRemove && (
          <TouchableOpacity onPress={() => onRemove(pr.id)} style={row.removeBtn}>
            <Text style={row.removeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function createRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  left: {
    flex: 1,
    gap:  spacing.xs,
  },
  topLine: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  distance: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  ttBadge: {
    backgroundColor:  colors.border,
    borderRadius:     Radius.sm,
    paddingHorizontal: 4,
    paddingVertical:  1,
  },
  ttText: {
    color:         colors.textSubtle,
    fontSize:      7,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  time: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
  },
  sep: {
    color:    colors.textSubtle,
    fontSize: FontSize.sm,
  },
  meta: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  vdotBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius:    Radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:  4,
    alignItems:      'center',
    minWidth:        44,
  },
  vdotValue: {
    color:      colors.primary,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
    lineHeight: 18,
  },
  vdotLabel: {
    color:         colors.primary,
    fontSize:      7,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
    opacity:       0.7,
  },
  removeBtn: {
    width:          24,
    height:         24,
    borderRadius:   12,
    backgroundColor: colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color:    colors.textDim,
    fontSize: 10,
  },
  });
}

export default function RaceHistoryCard({ racePRs, onAdd, onRemove }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sorted = [...racePRs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const bestVdot = racePRs.length > 0
    ? Math.max(...racePRs.map(p => vdotFromRacePR(p.distanceMeters, p.timeSeconds)))
    : null;

  return (
    <Card>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>RACE PRs</Text>
          {bestVdot !== null && (
            <Text style={styles.bestVdot}>
              Best VDOT: <Text style={styles.bestVdotValue}>{bestVdot.toFixed(1)}</Text>
            </Text>
          )}
        </View>
        {onAdd && (
          <TouchableOpacity onPress={onAdd} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add PR</Text>
          </TouchableOpacity>
        )}
      </View>

      {sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No race PRs recorded</Text>
          <Text style={styles.emptyBody}>
            Adding a race result enables precise VDOT calibration and accurate pace zones.
          </Text>
        </View>
      ) : (
        <View>
          {sorted.map(pr => (
            <PRRow key={pr.id} pr={pr} onRemove={onRemove} />
          ))}
        </View>
      )}

      {sorted.length > 0 && (
        <Text style={styles.footnote}>
          VDOT scores derived from Jack Daniels model. Higher = better fitness.
        </Text>
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.md,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  4,
  },
  bestVdot: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  bestVdotValue: {
    color:      colors.primary,
    fontWeight: FontWeight.black,
  },
  addBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius:    Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  addBtnText: {
    color:      colors.primary,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  emptyState: {
    paddingVertical: spacing.lg,
    gap:             spacing.xs,
    alignItems:      'center',
  },
  emptyTitle: {
    color:      colors.textDim,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  emptyBody: {
    color:     colors.textSubtle,
    fontSize:  FontSize.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  footnote: {
    color:     colors.textSubtle,
    fontSize:  9,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  });
}
