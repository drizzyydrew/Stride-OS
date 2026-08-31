import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { RUN_LEVEL_DEFINITIONS, type RunLevelDefinition } from './runLevelDefinitions';
import type { UnitSystem } from '../../store/settingsStore';

type Props = {
  currentMeters: number;
  units: UnitSystem;
  style?: StyleProp<ViewStyle>;
};

function formatDistanceMeters(meters: number, units: UnitSystem): string {
  if (units === 'metric') return `${Math.round(meters / 1000).toLocaleString()} km`;
  return `${Math.round(meters / 1609.344).toLocaleString()} mi`;
}

function formatLifetimeDistance(meters: number, units: UnitSystem): string {
  if (units === 'metric') return `${Math.round(meters / 1000).toLocaleString()} lifetime km`;
  return `${Math.round(meters / 1609.344).toLocaleString()} lifetime miles`;
}

export function currentRunLevel(cumulativeMeters: number): RunLevelDefinition {
  return [...RUN_LEVEL_DEFINITIONS].reverse().find(level => cumulativeMeters >= level.thresholdMeters)
    ?? RUN_LEVEL_DEFINITIONS[0];
}

export function nextRunLevel(cumulativeMeters: number): RunLevelDefinition | null {
  return RUN_LEVEL_DEFINITIONS.find(level => cumulativeMeters < level.thresholdMeters) ?? null;
}

export default function RunLevelProgress({ currentMeters, units, style }: Props) {
  const current = currentRunLevel(currentMeters);
  const next = nextRunLevel(currentMeters);
  const previousThreshold = current.thresholdMeters;
  const nextThreshold = next?.thresholdMeters ?? current.thresholdMeters;
  const ratio = next
    ? Math.max(0, Math.min(1, (currentMeters - previousThreshold) / Math.max(1, nextThreshold - previousThreshold)))
    : 1;
  const remaining = next ? Math.max(0, next.thresholdMeters - currentMeters) : 0;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>CURRENT LEVEL</Text>
          <Text style={styles.title}>{current.title}</Text>
        </View>
        <Text style={styles.total}>{formatLifetimeDistance(currentMeters, units)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` as `${number}%` }]} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.remaining}>
          {next ? `${formatDistanceMeters(remaining, units)} to ${next.title}` : 'Highest run level reached'}
        </Text>
        <Text style={styles.target}>{next ? formatDistanceMeters(next.thresholdMeters, units) : formatDistanceMeters(current.thresholdMeters, units)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  kicker: { color: '#8F8A80', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#F3F1EB', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  total: { color: '#BEB6AA', fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  track: { height: 8, borderRadius: 999, backgroundColor: 'rgba(243, 241, 235, 0.13)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#DCC9B1' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  remaining: { color: '#DCC9B1', fontSize: 12, lineHeight: 17, fontWeight: '900' },
  target: { color: '#8F8A80', fontSize: 12, lineHeight: 17, fontWeight: '900' },
});
