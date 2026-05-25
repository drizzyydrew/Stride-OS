import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { HistoryWindow } from '../../types/history';

type Props = {
  load7d:  HistoryWindow;
  load30d: HistoryWindow;
};

function WindowColumn({
  window: win,
  label,
}: {
  window: HistoryWindow;
  label: string;
}) {
  const hasData = win.recordCount > 0;
  return (
    <View style={styles.column}>
      <Text style={styles.windowLabel}>{label}</Text>
      <Text style={[styles.loadValue, !hasData && styles.loadValueEmpty]}>
        {hasData ? win.totalLoad : '—'}
      </Text>
      <Text style={styles.loadUnit}>{hasData ? 'pts load' : 'no data'}</Text>
      {hasData ? (
        <>
          <Text style={styles.detail}>{win.totalMiles} mi</Text>
          <Text style={styles.detail}>
            {win.recordCount} session{win.recordCount !== 1 ? 's' : ''}
          </Text>
        </>
      ) : null}
    </View>
  );
}

export default function LoadWindowCard({ load7d, load30d }: Props) {
  return (
    <Card>
      <Text style={styles.title}>Load Windows</Text>
      <View style={styles.row}>
        <WindowColumn window={load7d}  label="7 DAYS"  />
        <View style={styles.divider} />
        <WindowColumn window={load30d} label="30 DAYS" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color:         colors.textMuted,
    fontSize:      FontSize.base,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom:  spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  column: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  windowLabel: {
    color:         colors.textDim,
    fontSize:      10,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  loadValue: {
    color:      colors.text,
    fontSize:   36,
    fontWeight: FontWeight.black,
    lineHeight: 40,
  },
  loadValueEmpty: {
    color: colors.textSubtle,
  },
  loadUnit: {
    color:    colors.textDim,
    fontSize: FontSize.xs,
  },
  detail: {
    color:    colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  divider: {
    width:           1,
    height:          80,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
    alignSelf:       'center',
  },
});
