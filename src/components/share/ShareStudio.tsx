import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Image,
  ImageBackground,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { RunLevelBadge, runLevelSlugFromId } from '../../achievements/runLevels';
import { firstAchievementDefinitionFromAchievementId } from '../../achievements/firsts';
import { strengthAchievementDefinitionFromAchievementId } from '../../achievements/strength';
import { recoveryAchievementDefinitionFromAchievementId } from '../../achievements/recovery';
import { lifetimeDistanceCyclingDefinitionFromAchievementId } from '../../achievements/lifetimeDistanceCycling';
import { lifetimeDistanceRunningDefinitionFromAchievementId } from '../../achievements/lifetimeDistanceRunning';
import { streakDefinitionFromAchievementId } from '../../achievements/streaks';
import { weeklyDistanceDefinitionFromAchievementId } from '../../achievements/weeklyDistance';
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
const SHARE_SAFE_MARGIN = 38;

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
      const maxX = Math.max(SHARE_SAFE_MARGIN, bounds.width - 64 - SHARE_SAFE_MARGIN);
      const maxY = Math.max(SHARE_SAFE_MARGIN, bounds.height - 64 - SHARE_SAFE_MARGIN);
      setOffset({
        x: Math.max(SHARE_SAFE_MARGIN, Math.min(maxX, start.current.x + gesture.dx)),
        y: Math.max(SHARE_SAFE_MARGIN, Math.min(maxY, start.current.y + gesture.dy)),
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

function StrideOSBrandMark() {
  return (
    <Image
      source={require('../../../assets/images/splash-icon.png')}
      style={styles.logoMark}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const routeEnabled = enabled.route && activity && activityHasShareableRoute(activity);
  const isOverlay = variant === 'transparent_overlay';
  const isStory = format === 'story';
  const activityTitle = activity ? displayLabel(activity.subtype === 'run_walk' ? 'run_walk' : activity.activityType).toUpperCase() : null;
  const runLevelSlug = achievement ? runLevelSlugFromId(achievement.id) : null;
  const lifetimeRunDefinition = achievement ? lifetimeDistanceRunningDefinitionFromAchievementId(achievement.id) : null;
  const lifetimeCyclingDefinition = achievement ? lifetimeDistanceCyclingDefinitionFromAchievementId(achievement.id) : null;
  const weeklyDistanceDefinition = achievement ? weeklyDistanceDefinitionFromAchievementId(achievement.id) : null;
  const streakDefinition = achievement ? streakDefinitionFromAchievementId(achievement.id) : null;
  const firstDefinition = achievement ? firstAchievementDefinitionFromAchievementId(achievement.id) : null;
  const strengthDefinition = achievement ? strengthAchievementDefinitionFromAchievementId(achievement.id) : null;
  const recoveryDefinition = achievement ? recoveryAchievementDefinitionFromAchievementId(achievement.id) : null;
  const canonicalBadgeDefinition = lifetimeRunDefinition ?? lifetimeCyclingDefinition ?? weeklyDistanceDefinition ?? streakDefinition ?? firstDefinition ?? strengthDefinition ?? recoveryDefinition;
  const bg = isOverlay ? 'transparent' : variant === 'editorial_card' ? '#F3F1EB' : '#0E0E0F';
  const foregroundDark = variant === 'editorial_card';
  const selectedMetrics = (['distance', 'time', 'pace', 'elevation'] as ToggleKey[])
    .map(key => ({ key, value: enabled[key] ? metricValue(activity, units, key) : null }))
    .filter((item): item is { key: ToggleKey; value: string } => Boolean(item.value));
  const selectedCount = keys.filter(key => enabled[key]).length;

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
        <MovableLayer initial={{ x: SHARE_SAFE_MARGIN, y: SHARE_SAFE_MARGIN }} style={styles.brandLayer}>
          <StrideOSBrandMark />
        </MovableLayer>
      ) : null}
      {achievement && enabled.achievement ? (
        <MovableLayer initial={{ x: isStory ? 78 : 54, y: isStory ? 168 : 116 }} style={styles.badgeLayer}>
          {runLevelSlug ? (
            <RunLevelBadge
              level={runLevelSlug}
              state={isOverlay ? 'share-transparent' : achievement.state === 'locked' ? 'locked' : 'share-opaque'}
              size={156}
              remainingMeters={achievement.remaining}
              units={units}
            />
          ) : (
            <AchievementBadge
              id={achievement.id}
              category={achievement.category}
              earned={achievement.state !== 'locked'}
              size="large"
              unitSystem={units}
              badgeState={canonicalBadgeDefinition ? (isOverlay ? 'share-transparent' : achievement.state === 'locked' ? 'locked' : 'share-opaque') : undefined}
            />
          )}
        </MovableLayer>
      ) : null}
      <MovableLayer initial={{ x: SHARE_SAFE_MARGIN, y: isStory ? 470 : 330 }} style={styles.titleLayer}>
        <Text style={[styles.kicker, foregroundDark ? styles.darkAccent : styles.lightAccent]}>
          {achievement ? 'ACHIEVEMENT UNLOCKED' : activityTitle ? 'ACTIVITY COMPLETE' : 'STRIDEOS'}
        </Text>
        <Text style={[styles.title, foregroundDark ? styles.darkInk : styles.lightInk]} numberOfLines={3} adjustsFontSizeToFit>
          {variant === 'activity_achievement' && activityTitle ? activityTitle : achievement?.title.toUpperCase() ?? activityTitle ?? 'TRAINING'}
        </Text>
        {achievement ? <Text style={[styles.support, foregroundDark ? styles.darkInkMuted : styles.lightInkMuted]}>{achievement.displayTarget}</Text> : null}
      </MovableLayer>
      {selectedMetrics.length ? (
        <MovableLayer initial={{ x: SHARE_SAFE_MARGIN, y: isStory ? 690 : 522 }} style={styles.metricsLayer}>
          {selectedMetrics.slice(0, 4).map(item => (
            <StatPill key={item.key} label={toggleLabel(item.key, activity).toUpperCase()} value={item.value} />
          ))}
        </MovableLayer>
      ) : null}
    </View>
  );

  return (
    <View style={styles.shell}>
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.detailsButton, detailsOpen ? styles.toggleOn : styles.toggleOff]}
          onPress={() => setDetailsOpen(open => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          accessibilityLabel="Share detail selector"
        >
          <Text style={[styles.toggleText, detailsOpen ? styles.toggleTextOn : styles.toggleTextOff]}>
            Share Details · {selectedCount}/{keys.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, styles.resetToggle]}
          onPress={() => setLayoutEpoch(current => current + 1)}
          accessibilityRole="button"
          accessibilityLabel="Reset share layout"
        >
          <Text style={[styles.toggleText, styles.toggleTextOff]}>Reset</Text>
        </TouchableOpacity>
      </View>
      {detailsOpen ? (
        <View style={styles.detailsMenu}>
          <View style={styles.detailsActions}>
            <TouchableOpacity
              style={[styles.smallAction, styles.toggleOn]}
              onPress={() => {
                if (keys.includes('route') && !enabled.route) onRoutePrivacyNotice?.(ROUTE_PRIVACY_NOTE);
                setEnabled(current => ({
                  ...current,
                  ...Object.fromEntries(keys.map(key => [key, true])),
                }));
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.toggleText, styles.toggleTextOn]}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallAction, styles.toggleOff]}
              onPress={() => setEnabled(current => ({
                ...current,
                route: false,
                distance: false,
                time: false,
                pace: false,
                elevation: false,
                achievement: false,
              }))}
              accessibilityRole="button"
            >
              <Text style={[styles.toggleText, styles.toggleTextOff]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {keys.map(key => {
            const active = enabled[key];
            return (
              <TouchableOpacity
                key={key}
                style={[styles.detailsRow, active && styles.detailsRowOn]}
                onPress={() => {
                  if (key === 'route' && !active) onRoutePrivacyNotice?.(ROUTE_PRIVACY_NOTE);
                  setEnabled(current => ({ ...current, [key]: !current[key] }));
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${toggleLabel(key, activity)} ${active ? 'enabled' : 'disabled'}`}
              >
                <Text style={[styles.detailsCheck, active ? styles.toggleTextOn : styles.toggleTextOff]}>{active ? '✓' : ''}</Text>
                <Text style={[styles.toggleText, active ? styles.toggleTextOn : styles.toggleTextOff]}>{toggleLabel(key, activity)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      <View key={layoutEpoch}>{canvas}</View>
      {keys.includes('route') ? <Text style={styles.privacy}>{routeEnabled ? ROUTE_PRIVACY_NOTE : 'Route is off by default.'}</Text> : null}
      {variant === 'transparent_overlay' ? <Text style={styles.privacy}>Transparent overlay export uses no card background.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: 10 },
  controlBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailsButton: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  detailsMenu: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(94,126,146,0.34)', backgroundColor: 'rgba(14,14,15,0.92)', padding: 10, gap: 8 },
  detailsActions: { flexDirection: 'row', gap: 8 },
  smallAction: { minHeight: 32, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  detailsRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailsRowOn: { backgroundColor: '#9DB2A0', borderRadius: 8, paddingHorizontal: 8 },
  detailsCheck: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(220,201,177,0.34)', textAlign: 'center', fontSize: 12, lineHeight: 17, fontWeight: '900' },
  toggle: { minHeight: 34, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: '#9DB2A0', borderColor: '#9DB2A0' },
  toggleOff: { backgroundColor: 'rgba(243,241,235,0.08)', borderColor: 'rgba(94,126,146,0.32)' },
  resetToggle: { backgroundColor: 'rgba(14,14,15,0.82)', borderColor: 'rgba(94,126,146,0.42)' },
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
  brandLayer: { alignItems: 'center', justifyContent: 'center' },
  logoMark: { width: 112, height: 112, borderRadius: 6 },
  badgeLayer: { alignItems: 'center', justifyContent: 'center' },
  titleLayer: { right: SHARE_SAFE_MARGIN, gap: 4 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 39, lineHeight: 42, fontWeight: '900', letterSpacing: 0 },
  support: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  metricsLayer: { right: SHARE_SAFE_MARGIN, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statPill: { minWidth: 116, borderRadius: 8, padding: 10, backgroundColor: 'rgba(14,14,15,0.68)', borderWidth: 1, borderColor: 'rgba(157,178,160,0.34)' },
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
