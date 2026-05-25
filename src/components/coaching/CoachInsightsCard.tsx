import { StyleSheet, Text, View } from 'react-native';

import CoachInsightCard from './CoachInsightCard';
import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { CoachInsight } from '../../types/coaching';

type Props = {
  insights:   CoachInsight[];
  maxVisible?: number;        // default 3
};

export default function CoachInsightsCard({ insights, maxVisible = 3 }: Props) {
  if (insights.length === 0) {
    return (
      <Card>
        <Text style={styles.sectionLabel}>COACH INSIGHTS</Text>
        <Text style={styles.empty}>All signals look good — no urgent actions needed today.</Text>
      </Card>
    );
  }

  const visible  = insights.slice(0, maxVisible);
  const overflow = Math.max(0, insights.length - maxVisible);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>COACH INSIGHTS</Text>
        {overflow > 0 && (
          <Text style={styles.overflowNote}>+{overflow} more</Text>
        )}
      </View>

      {visible.map(insight => (
        <CoachInsightCard key={insight.id} insight={insight} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  overflowNote: {
    color:     colors.textDim,
    fontSize:  FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  empty: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 19,
    fontStyle:  'italic',
  },
});
