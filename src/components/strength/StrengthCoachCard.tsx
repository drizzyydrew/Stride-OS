import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';

type StrengthInsight = {
  id:       string;
  category: 'readiness' | 'adherence' | 'phase' | 'load' | 'pattern';
  priority: 'high' | 'medium' | 'low';
  headline: string;
  body:     string;
  action?:  string;
};

type Props = {
  insights: StrengthInsight[];
};

function priorityColors(colors: ThemeColors) {
  return {
    high:   { dot: colors.critical, bg: colors.criticalDim },
    medium: { dot: colors.warning,  bg: colors.warningDim  },
    low:    { dot: colors.primary,  bg: colors.primaryDim  },
  };
}

export type { StrengthInsight };

export default function StrengthCoachCard({ insights }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const PRIORITY_COLORS = useMemo(() => priorityColors(colors), [colors]);

  if (insights.length === 0) return null;

  const top = insights.slice(0, 3);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Strength Coach</Text>

      <View style={styles.insights}>
        {top.map(insight => {
          const config = PRIORITY_COLORS[insight.priority];
          return (
            <View key={insight.id} style={[styles.insight, { backgroundColor: config.bg }]}>
              <View style={[styles.dot, { backgroundColor: config.dot }]} />
              <View style={styles.insightBody}>
                <Text style={styles.headline}>{insight.headline}</Text>
                <Text style={styles.body}>{insight.body}</Text>
                {insight.action && (
                  <Text style={styles.action}>{insight.action}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card:        { marginBottom: spacing.cardGap },
  title:       { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: spacing.md },
  insights:    { gap: spacing.sm },
  insight:     { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 10 },
  dot:         { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  insightBody: { flex: 1, gap: 3 },
  headline:    { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  body:        { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18 },
  action:      { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: 2 },
  });
}
