import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  ImageBackground,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';

import AchievementBadge from '../achievements/AchievementBadge';
import type { UnitSystem } from '../../store/settingsStore';
import type { Activity } from '../../types/activity';
import type { EvaluatedAchievement } from '../../utils/achievementSystem';
import { achievementShareAllowed } from '../../utils/achievementSystem';
import { buildActivitySummary } from '../../utils/activitySummary';
import { displayLabel } from '../../utils/displayLabels';
import {
  ROUTE_PRIVACY_NOTE,
  activityHasShareableRoute,
  normalizeRouteForOverlay,
  routePointsToSvgPolyline,
} from '../../utils/routeOverlay';

export type ShareStudioVariant = 'minimal_card' | 'transparent_overlay' | 'editorial_card' | 'activity_achievement';
export type ShareStudioFormat = 'square' | 'story';

type ToggleKey = 'route' | 'distance' | 'time' | 'pace' | 'elevation' | 'achievement' | 'brand';

type Props = {
  activity?: Activity;
  achievement?: EvaluatedAchievement;
  units: UnitSystem;
  variant: ShareStudioVariant;
  format: ShareStudioFormat;
  photoUri?: string;
  onRoutePrivacyNotice?: (message: string) => void;
  canvasRef?: RefObject<View | null>;
};

export const SHARE_STUDIO_VARIANTS: Array<{ id: ShareStudioVariant; label: string }> = [
  { id: 'minimal_card', label: 'Minimal' },
  { id: 'transparent_overlay', label: 'Overlay' },
  { id: 'editorial_card', label: 'Editorial' },
  { id: 'activity_achievement', label: 'Activity +' },
];

export const SHARE_STUDIO_FORMATS: Array<{ id: ShareStudioFormat; label: string }> = [
  { id: 'square', label: 'Square' },
  { id: 'story', label: 'Story' },
];

function metricValue(activity: Activity | undefined, units: UnitSystem, key: ToggleKey): string | null {
  if (!activity) return null;
  const summary = buildActivitySummary(activity, units, { dataRich: false, includePrivate: false });
  const metrics = summary.primary.filter(item => item.privacy === 'public');
  if (key === 'distance') return metrics.find(item => item.label === 'Distance')?.value ?? null;
  if (key === 'time') return metrics.find(item => item.label === 'Duration')?.value ?? null;
  if (key === 'pace') return metrics.find(item => item.label === 'Average pace' || item.label === 'Average speed')?.value ?? null;
  if (key === 'elevation') return metrics.find(item => item.label === 'Elevation gain')?.value ?? null;
  return null;
}

function availableToggles(activity: Activity | undefined, achievement: EvaluatedAchievement | undefined): ToggleKey[] {
  const keys: ToggleKey[] = [];
  if (metricValue(activity, 'imperial', 'distance')) keys.push('distance');
  if (metricValue(activity, 'imperial', 'time')) keys.push('time');
  if (metricValue(activity, 'imperial', 'pace')) keys.push('pace');
  if (metricValue(activity, 'imperial', 'elevation')) keys.push('elevation');
  if (activity && activityHasShareableRoute(activity)) keys.push('route');
  if (achievement && achievementShareAllowed(achievement)) keys.push('achievement');
  keys.push('brand');
  return keys;
}

function toggleLabel(key: ToggleKey, activity?: Activity): string {
  if (key === 'route') return 'Route';
  if (key === 'time') return 'Time';
  if (key === 'pace') return activity && ['cycling', 'indoor_cycling'].includes(activity.activityType) ? 'Speed' : 'Pace';
  if (key === 'achievement') return 'Badge';
  if (key === 'brand') return 'StrideOS';
  return displayLabel(key);
}

function MovableLayer({
  children,
  initial,
  style,
}: {
  children: ReactNode;
  initial: { x: number; y: number };
  style?: ViewStyle;
}) {
  const [offset, setOffset] = useState(initial);
  const [bounds, setBounds] = useState({ width: 320, height: 320 });
  const start = useRef(initial);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      start.current = offset;
    },
    onPanResponderMove: (_, gesture) => {
      const maxX = Math.max(0, bounds.width - 64);
      const maxY = Math.max(0, bounds.height - 64);
      setOffset({
        x: Math.max(0, Math.min(maxX, start.current.x + gesture.dx)),
        y: Math.max(0, Math.min(maxY, start.current.y + gesture.dy)),
      });
    },
  }), [bounds.height, bounds.width, offset]);
  return (
    <View
      onLayout={(event: LayoutChangeEvent) => {
        const parent = event.nativeEvent.layout;
        if (parent.width > bounds.width || parent.height > bounds.height) {
          setBounds({ width: Math.max(bounds.width, parent.width), height: Math.max(bounds.height, parent.height) });
        }
      }}
      style={[styles.movable, { left: offset.x, top: offset.y }, style]}
      {...pan.panHandlers}
    >
      {children}
    </View>
  );
}

function RouteOverlay({ activity, light = false }: { activity?: Activity; light?: boolean }) {
  if (!activity || !activityHasShareableRoute(activity)) return null;
  const route = normalizeRouteForOverlay(activity.metrics.routeCoordinates, { width: 1080, height: 1080 }, 0.18);
  if (!route.hasRoute) return null;
  const points = routePointsToSvgPolyline(route.points);
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${route.viewBox.width} ${route.viewBox.height}`} pointerEvents="none">
      <Polyline points={points} stroke={light ? '#0E0E0F' : '#F3F1EB'} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.22} />
      <Polyline points={points} stroke={light ? '#DCC9B1' : '#DCC9B1'} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
      {route.points[0] ? <Circle cx={route.points[0].x} cy={route.points[0].y} r={18} fill="#A8B9A1" /> : null}
      {route.points.at(-1) ? <Circle cx={route.points.at(-1)!.x} cy={route.points.at(-1)!.y} r={18} fill="#DCC9B1" /> : null}
    </Svg>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ShareStudio({
  activity,
  achievement,
  units,
  variant,
  format,
  photoUri,
  onRoutePrivacyNotice,
  canvasRef,
}: Props) {
  const keys = availableToggles(activity, achievement);
  const [enabled, setEnabled] = useState<Record<ToggleKey, boolean>>({
    route: false,
    distance: keys.includes('distance'),
    time: keys.includes('time'),
    pace: keys.includes('pace'),
    elevation: keys.includes('elevation'),
    achievement: Boolean(achievement && achievementShareAllowed(achievement)),
    brand: true,
  });
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const routeEnabled = enabled.route && activity && activityHasShareableRoute(activity);
  const isOverlay = variant === 'transparent_overlay';
  const isStory = format === 'story';
  const activityTitle = activity ? displayLabel(activity.subtype === 'run_walk' ? 'run_walk' : activity.activityType).toUpperCase() : null;
  const bg = isOverlay ? 'transparent' : variant === 'editorial_card' ? '#F3F1EB' : '#0E0E0F';
  const foregroundDark = variant === 'editorial_card';
  const selectedMetrics = (['distance', 'time', 'pace', 'elevation'] as ToggleKey[])
    .map(key => ({ key, value: enabled[key] ? metricValue(activity, units, key) : null }))
    .filter((item): item is { key: ToggleKey; value: string } => Boolean(item.value));

  const canvas = (
    <View
      ref={canvasRef}
      collapsable={false}
      style={[
        styles.canvas,
        isStory ? styles.story : styles.square,
        { backgroundColor: bg },
        isOverlay && !photoUri ? styles.transparentCanvas : null,
      ]}
    >
      {photoUri ? <ImageBackground source={{ uri: photoUri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      {photoUri && !isOverlay ? <View style={styles.photoScrim} /> : null}
      {routeEnabled ? <View style={styles.routeLayer}><RouteOverlay activity={activity} light={foregroundDark} /></View> : null}
      {enabled.brand ? (
        <MovableLayer initial={{ x: 24, y: 24 }} style={styles.brandLayer}>
          <Text style={[styles.brand, foregroundDark ? styles.darkInk : styles.lightInk]}>STRIDEOS</Text>
          <Text style={[styles.chevrons, foregroundDark ? styles.darkAccent : styles.lightAccent]}>{'>>>>>'}</Text>
        </MovableLayer>
      ) : null}
      {achievement && enabled.achievement ? (
        <MovableLayer initial={{ x: isStory ? 78 : 54, y: isStory ? 168 : 116 }} style={styles.badgeLayer}>
          <AchievementBadge id={achievement.id} category={achievement.category} earned={achievement.state !== 'locked'} size="large" />
        </MovableLayer>
      ) : null}
      <MovableLayer initial={{ x: 26, y: isStory ? 470 : 330 }} style={styles.titleLayer}>
        <Text style={[styles.kicker, foregroundDark ? styles.darkAccent : styles.lightAccent]}>
          {achievement ? 'ACHIEVEMENT UNLOCKED' : activityTitle ? 'ACTIVITY COMPLETE' : 'STRIDEOS'}
        </Text>
        <Text style={[styles.title, foregroundDark ? styles.darkInk : styles.lightInk]} numberOfLines={3} adjustsFontSizeToFit>
          {variant === 'activity_achievement' && activityTitle ? activityTitle : achievement?.title.toUpperCase() ?? activityTitle ?? 'TRAINING'}
        </Text>
        {achievement ? <Text style={[styles.support, foregroundDark ? styles.darkInkMuted : styles.lightInkMuted]}>{achievement.displayTarget}</Text> : null}
      </MovableLayer>
      {selectedMetrics.length ? (
        <MovableLayer initial={{ x: 24, y: isStory ? 690 : 522 }} style={styles.metricsLayer}>
          {selectedMetrics.slice(0, 4).map(item => (
            <StatPill key={item.key} label={toggleLabel(item.key, activity).toUpperCase()} value={item.value} />
          ))}
        </MovableLayer>
      ) : null}
    </View>
  );

  return (
    <View style={styles.shell}>
      <View style={styles.toggleRow}>
        {keys.map(key => {
          const active = enabled[key];
          return (
            <TouchableOpacity
              key={key}
              style={[styles.toggle, active ? styles.toggleOn : styles.toggleOff]}
              onPress={() => {
                if (key === 'route' && !active) onRoutePrivacyNotice?.(ROUTE_PRIVACY_NOTE);
                setEnabled(current => ({ ...current, [key]: !current[key] }));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${toggleLabel(key, activity)} ${active ? 'enabled' : 'disabled'}`}
            >
              <Text style={[styles.toggleText, active ? styles.toggleTextOn : styles.toggleTextOff]}>{toggleLabel(key, activity)}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.toggle, styles.resetToggle]}
          onPress={() => setLayoutEpoch(current => current + 1)}
          accessibilityRole="button"
          accessibilityLabel="Reset share layout"
        >
          <Text style={[styles.toggleText, styles.toggleTextOff]}>Reset</Text>
        </TouchableOpacity>
      </View>
      <View key={layoutEpoch}>{canvas}</View>
      {keys.includes('route') ? <Text style={styles.privacy}>{routeEnabled ? ROUTE_PRIVACY_NOTE : 'Route is off by default.'}</Text> : null}
      {variant === 'transparent_overlay' ? <Text style={styles.privacy}>Transparent overlay export uses no card background.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 10 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: { minHeight: 34, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: '#DCC9B1', borderColor: '#DCC9B1' },
  toggleOff: { backgroundColor: 'rgba(243,241,235,0.08)', borderColor: 'rgba(243,241,235,0.18)' },
  resetToggle: { backgroundColor: 'rgba(14,14,15,0.82)', borderColor: 'rgba(220,201,177,0.34)' },
  toggleText: { fontSize: 11, fontWeight: '900' },
  toggleTextOn: { color: '#0E0E0F' },
  toggleTextOff: { color: '#DCC9B1' },
  canvas: { width: '100%', overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(220,201,177,0.28)' },
  square: { aspectRatio: 1 },
  story: { aspectRatio: 9 / 16 },
  transparentCanvas: { borderStyle: 'dashed' },
  photoScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.26)' },
  routeLayer: { ...StyleSheet.absoluteFill },
  movable: { position: 'absolute' },
  brandLayer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  chevrons: { fontSize: 14, fontWeight: '900', letterSpacing: 0 },
  badgeLayer: { alignItems: 'center', justifyContent: 'center' },
  titleLayer: { right: 20, gap: 4 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 39, lineHeight: 42, fontWeight: '900', letterSpacing: 0 },
  support: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  metricsLayer: { right: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statPill: { minWidth: 116, borderRadius: 8, padding: 10, backgroundColor: 'rgba(14,14,15,0.68)', borderWidth: 1, borderColor: 'rgba(220,201,177,0.32)' },
  statValue: { color: '#F3F1EB', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#DCC9B1', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  lightInk: { color: '#F3F1EB' },
  lightInkMuted: { color: '#DCC9B1' },
  lightAccent: { color: '#DCC9B1' },
  darkInk: { color: '#0E0E0F' },
  darkInkMuted: { color: '#4D433E' },
  darkAccent: { color: '#8B6B52' },
  privacy: { color: '#9C948A', fontSize: 11, lineHeight: 16 },
});
