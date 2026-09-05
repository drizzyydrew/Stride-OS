import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

import type { UnitSystem } from '../../store/settingsStore';
import type { Activity, ActivityCoordinate } from '../../types/activity';
import { buildActivitySummary } from '../../utils/activitySummary';
import { displayLabel } from '../../utils/displayLabels';
import { activityHasShareableRoute, normalizeRouteForOverlay, routePointsToSvgPolyline } from '../../utils/routeOverlay';

export type ActivityShareVariant = 'performance_dark' | 'route_story' | 'photo_overlay';

const ROUTE_TRACE_ACCENT = '#9DB2A0';

type Props = {
  activity: Activity;
  units: UnitSystem;
  variant: ActivityShareVariant;
};

export const ACTIVITY_SHARE_VARIANTS: Array<{ id: ActivityShareVariant; label: string; description: string }> = [
  { id: 'performance_dark', label: 'Performance', description: 'Bold dark recap' },
  { id: 'route_story', label: 'Route Story', description: 'Abstract route art' },
  { id: 'photo_overlay', label: 'Overlay', description: 'Photo-friendly PNG' },
];

function publicMetrics(activity: Activity, units: UnitSystem) {
  return buildActivitySummary(activity, units, { dataRich: false, includePrivate: false }).primary
    .filter(item => item.privacy === 'public')
    .slice(0, 4);
}

function normalizeRoute(route: ActivityCoordinate[]): string {
  return routePointsToSvgPolyline(normalizeRouteForOverlay(route, { width: 180, height: 160 }, 0.13).points);
}

function MetricRow({ label, value, light = false }: { label: string; value: string; light?: boolean }) {
  return (
    <View style={styles.metricRow}>
      <Text style={[styles.metricLabel, light ? styles.lightMuted : styles.darkMuted]}>{label}</Text>
      <Text style={[styles.metricValue, light ? styles.lightText : styles.darkText]}>{value}</Text>
    </View>
  );
}

function RouteSketch({ route }: { route: ActivityCoordinate[] }) {
  const points = normalizeRoute(route);
  if (!points) {
    return (
      <View style={styles.routeUnavailable}>
        <Text style={styles.privacyNote}>Route unavailable for this activity.</Text>
      </View>
    );
  }
  return (
    <Svg width="100%" height={180} viewBox="0 0 180 160">
      <Rect x="8" y="8" width="164" height="144" rx="22" fill="#F3F1EB" opacity={0.14} />
      <Circle cx="33" cy="121" r="7" fill="#A8B9A1" />
      <Circle cx="145" cy="39" r="7" fill="#DCC9B1" />
      <Polyline points={points} stroke="#F3F1EB" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.34} />
      <Polyline points={points} stroke={ROUTE_TRACE_ACCENT} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.96} />
    </Svg>
  );
}

export default function ActivityShareCard({ activity, units, variant }: Props) {
  const metrics = publicMetrics(activity, units);
  const title = displayLabel(activity.subtype === 'run_walk' ? 'run_walk' : activity.activityType);
  const route = activity.metrics.routeCoordinates ?? [];

  if (variant === 'route_story') {
    return (
      <View style={[styles.card, styles.route]} collapsable={false}>
        <View>
          <Text style={styles.routeBrand}>STRIDEOS</Text>
          <Text style={styles.routeTitle}>{title}</Text>
        </View>
        {activityHasShareableRoute(activity) ? <RouteSketch route={route} /> : (
          <View style={styles.routeUnavailable}>
            <Text style={styles.privacyNote}>No recorded GPS route available.</Text>
          </View>
        )}
        <View style={styles.routeGrid}>
          {metrics.slice(0, 4).map(item => (
            <View key={item.label} style={styles.routeMetric}>
              <Text style={styles.routeMetricValue}>{item.value}</Text>
              <Text style={styles.routeMetricLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.privacyNote}>Route shape is drawn from recorded GPS only.</Text>
      </View>
    );
  }

  if (variant === 'photo_overlay') {
    return (
      <View style={[styles.card, styles.overlay]} collapsable={false}>
        <View style={styles.overlayPanel}>
          <View>
            <Text style={styles.overlayBrand}>STRIDEOS</Text>
            <Text style={styles.overlayTitle}>{title}</Text>
          </View>
          <View style={styles.overlayMetricGrid}>
            {metrics.slice(0, 3).map(item => (
              <View key={item.label} style={styles.overlayMetric}>
                <Text style={styles.overlayValue}>{item.value}</Text>
                <Text style={styles.overlayLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.overlayChevrons}>{'>>>>>'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.dark]} collapsable={false}>
      <View style={styles.darkTop}>
        <Text style={styles.darkBrand}>STRIDEOS</Text>
        <Text style={styles.darkChevrons}>{'>>>>>'}</Text>
      </View>
      <View>
        <Text style={styles.darkKicker}>ACTIVITY COMPLETE</Text>
        <Text style={styles.darkTitle}>{title}</Text>
      </View>
      <View style={styles.motionMark}>
        <Svg width="100%" height={120} viewBox="0 0 260 120">
          <Path d="M24 84 C70 15, 145 15, 235 84" stroke="#DCC9B1" strokeWidth={13} strokeLinecap="round" fill="none" />
          <Path d="M47 84 C92 44, 151 42, 211 84" stroke="#A8B9A1" strokeWidth={7} strokeLinecap="round" fill="none" />
          <Circle cx="24" cy="84" r="8" fill="#E08A5C" />
          <Circle cx="235" cy="84" r="8" fill="#4E6A87" />
        </Svg>
      </View>
      <View>
        {metrics.map(item => (
          <MetricRow key={item.label} label={item.label} value={item.value} light />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 430,
    overflow: 'hidden',
  },
  dark: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#0E0E0F',
    justifyContent: 'space-between',
  },
  route: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#2D4256',
    justifyContent: 'space-between',
  },
  overlay: {
    minHeight: 360,
    padding: 16,
    backgroundColor: 'rgba(14, 14, 15, 0.02)',
    justifyContent: 'flex-end',
  },
  darkTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  darkBrand: {
    color: '#F3F1EB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  darkChevrons: {
    color: '#DCC9B1',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  darkKicker: {
    color: '#A8B9A1',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  darkTitle: {
    color: '#F3F1EB',
    fontSize: 50,
    lineHeight: 54,
    fontWeight: '900',
  },
  motionMark: {
    marginVertical: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(243, 241, 235, 0.16)',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  metricValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '900',
  },
  lightText: {
    color: '#F3F1EB',
  },
  lightMuted: {
    color: '#DCC9B1',
  },
  darkText: {
    color: '#0E0E0F',
  },
  darkMuted: {
    color: '#4D433E',
  },
  routeBrand: {
    color: '#DCC9B1',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  routeTitle: {
    color: '#F3F1EB',
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    marginTop: 8,
  },
  routeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  routeMetric: {
    width: '47%',
    borderRadius: 18,
    padding: 13,
    backgroundColor: 'rgba(243, 241, 235, 0.11)',
  },
  routeUnavailable: {
    minHeight: 180,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(243, 241, 235, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  routeMetricValue: {
    color: '#F3F1EB',
    fontSize: 23,
    fontWeight: '900',
  },
  routeMetricLabel: {
    color: '#DCC9B1',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  privacyNote: {
    color: 'rgba(243, 241, 235, 0.66)',
    fontSize: 12,
    fontWeight: '800',
  },
  overlayPanel: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: 'rgba(14, 14, 15, 0.78)',
    gap: 16,
  },
  overlayBrand: {
    color: '#DCC9B1',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  overlayTitle: {
    color: '#F3F1EB',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 5,
  },
  overlayMetricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  overlayMetric: {
    flex: 1,
    minWidth: 0,
  },
  overlayValue: {
    color: '#F3F1EB',
    fontSize: 18,
    fontWeight: '900',
  },
  overlayLabel: {
    color: '#A8B9A1',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  overlayChevrons: {
    color: '#E08A5C',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
