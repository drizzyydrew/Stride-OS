import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
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
import Svg, { Circle, Polyline } from 'react-native-svg';

import { RunLevelBadge, runLevelSlugFromId } from '../../achievements/runLevels';
import { firstAchievementDefinitionFromAchievementId } from '../../achievements/firsts';
import { strengthAchievementDefinitionFromAchievementId } from '../../achievements/strength';
import { recoveryAchievementDefinitionFromAchievementId } from '../../achievements/recovery';
import { lifetimeDistanceCyclingDefinitionFromAchievementId } from '../../achievements/lifetimeDistanceCycling';
import { lifetimeDistanceRunningDefinitionFromAchievementId } from '../../achievements/lifetimeDistanceRunning';
import { streakDefinitionFromAchievementId } from '../../achievements/streaks';
import { weeklyDistanceDefinitionFromAchievementId } from '../../achievements/weeklyDistance';
import { monthlyDistanceDefinitionFromAchievementId } from '../../achievements/monthlyDistance';
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
type EditableLayerKey = 'brand' | 'achievement';
const SHARE_EDGE_MARGIN = 0;

type Props = {
  activity?: Activity;
  achievement?: EvaluatedAchievement;
  units: UnitSystem;
  variant: ShareStudioVariant;
  format: ShareStudioFormat;
  photoUri?: string;
  onRoutePrivacyNotice?: (message: string) => void;
  canvasRef?: RefObject<View | null>;
  onInteractionActiveChange?: (active: boolean) => void;
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

function shareActivityLabel(activity: Activity | undefined): string | null {
  if (!activity) return null;
  if (activity.subtype === 'run_walk') return 'RUN / WALK';
  if (activity.activityType === 'running') return 'RUN';
  if (activity.activityType === 'walking') return 'WALK';
  if (activity.activityType === 'cycling' || activity.activityType === 'indoor_cycling') return 'RIDE';
  return displayLabel(activity.activityType).toUpperCase();
}

function MovableLayer({
  children,
  initial,
  bounds,
  baseWidth = 64,
  baseHeight = baseWidth,
  scale = 1,
  onSelect,
  onInteractionActiveChange,
  style,
}: {
  children: ReactNode;
  initial: { x: number; y: number };
  bounds: { width: number; height: number };
  baseWidth?: number;
  baseHeight?: number;
  scale?: number;
  onSelect?: () => void;
  onInteractionActiveChange?: (active: boolean) => void;
  style?: ViewStyle;
}) {
  const [offset, setOffset] = useState(initial);
  const start = useRef(initial);
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    start.current = initial;
    setOffset(initial);
  }, [initial.x, initial.y]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      touched.current = true;
      onSelect?.();
      onInteractionActiveChange?.(true);
      start.current = offset;
    },
    onPanResponderMove: (_, gesture) => {
      const scaledWidth = Math.max(32, baseWidth * scale);
      const scaledHeight = Math.max(32, baseHeight * scale);
      const maxX = Math.max(SHARE_EDGE_MARGIN, bounds.width - scaledWidth - SHARE_EDGE_MARGIN);
      const maxY = Math.max(SHARE_EDGE_MARGIN, bounds.height - scaledHeight - SHARE_EDGE_MARGIN);
      setOffset({
        x: Math.max(SHARE_EDGE_MARGIN, Math.min(maxX, start.current.x + gesture.dx)),
        y: Math.max(SHARE_EDGE_MARGIN, Math.min(maxY, start.current.y + gesture.dy)),
      });
    },
    onPanResponderRelease: () => onInteractionActiveChange?.(false),
    onPanResponderTerminate: () => onInteractionActiveChange?.(false),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [baseHeight, baseWidth, bounds.height, bounds.width, offset, onInteractionActiveChange, onSelect, scale]);

  return (
    <View
      style={[styles.movable, { left: offset.x, top: offset.y, transform: [{ scale }] }, style]}
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

function StatPill({ label, value, transparent = false }: { label: string; value: string; transparent?: boolean }) {
  return (
    <View style={[styles.statPill, transparent && styles.statPillTransparent]}>
      <Text style={[styles.statValue, transparent && styles.overlayTextShadow]}>{value}</Text>
      <Text style={[styles.statLabel, transparent && styles.overlayTextShadow]}>{label}</Text>
    </View>
  );
}

function StrideOSBrandMark() {
  return (
    <View style={styles.logoMark} accessible accessibilityLabel="StrideOS logo">
      <Text style={styles.logoWord}>
        <Text style={styles.logoStride}>Stride</Text>
        <Text style={styles.logoOS}>OS</Text>
      </Text>
      <View style={styles.logoChevronRow}>
        {['#B8C4A9', '#A6C0B4', '#E3CDB8', '#78A3BE', '#5E7E92'].map((color, index) => (
          <Text key={`${color}-${index}`} style={[styles.logoChevron, { color }]}>{'>'}</Text>
        ))}
      </View>
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
  onInteractionActiveChange,
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
  useEffect(() => {
    setEnabled(current => ({
      ...current,
      distance: current.distance || keys.includes('distance'),
      time: current.time || keys.includes('time'),
      pace: current.pace || keys.includes('pace'),
      elevation: current.elevation || keys.includes('elevation'),
      achievement: current.achievement || Boolean(achievement && achievementShareAllowed(achievement)),
      brand: current.brand || keys.includes('brand'),
    }));
  }, [achievement?.id, achievement?.state, keys.join('|')]);
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showStoryActivityTitle, setShowStoryActivityTitle] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<EditableLayerKey>('achievement');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [layerScale, setLayerScale] = useState<Record<EditableLayerKey, number>>({
    achievement: 1,
    brand: 1,
  });
  const routeEnabled = enabled.route && activity && activityHasShareableRoute(activity);
  const isOverlay = variant === 'transparent_overlay';
  const isStory = format === 'story';
  const activityTitle = shareActivityLabel(activity);
  const runLevelSlug = achievement ? runLevelSlugFromId(achievement.id) : null;
  const lifetimeRunDefinition = achievement ? lifetimeDistanceRunningDefinitionFromAchievementId(achievement.id) : null;
  const lifetimeCyclingDefinition = achievement ? lifetimeDistanceCyclingDefinitionFromAchievementId(achievement.id) : null;
  const weeklyDistanceDefinition = achievement ? weeklyDistanceDefinitionFromAchievementId(achievement.id) : null;
  const monthlyDistanceDefinition = achievement ? monthlyDistanceDefinitionFromAchievementId(achievement.id) : null;
  const streakDefinition = achievement ? streakDefinitionFromAchievementId(achievement.id) : null;
  const firstDefinition = achievement ? firstAchievementDefinitionFromAchievementId(achievement.id) : null;
  const strengthDefinition = achievement ? strengthAchievementDefinitionFromAchievementId(achievement.id) : null;
  const recoveryDefinition = achievement ? recoveryAchievementDefinitionFromAchievementId(achievement.id) : null;
  const canonicalBadgeDefinition = lifetimeRunDefinition ?? lifetimeCyclingDefinition ?? weeklyDistanceDefinition ?? monthlyDistanceDefinition ?? streakDefinition ?? firstDefinition ?? strengthDefinition ?? recoveryDefinition;
  const achievementShareTitle = weeklyDistanceDefinition
    ? `${weeklyDistanceDefinition.milestoneLabel} WEEK`
    : monthlyDistanceDefinition
      ? `${monthlyDistanceDefinition.milestoneLabel} MONTH`
      : achievement?.title.toUpperCase();
  const achievementSupport = weeklyDistanceDefinition || monthlyDistanceDefinition
    ? null
    : achievement?.displayTarget;
  const bg = isOverlay ? 'transparent' : variant === 'editorial_card' ? '#F3F1EB' : '#0E0E0F';
  const foregroundDark = variant === 'editorial_card';
  const selectedMetrics = (['distance', 'time', 'pace', 'elevation'] as ToggleKey[])
    .map(key => ({ key, value: enabled[key] ? metricValue(activity, units, key) : null }))
    .filter((item): item is { key: ToggleKey; value: string } => Boolean(item.value));
  const selectedCount = keys.filter(key => enabled[key]).length;
  const fixedActivityLayout = Boolean(activity);
  const editableLayers = fixedActivityLayout ? [] : ([
    enabled.brand ? 'brand' : null,
    achievement && enabled.achievement ? 'achievement' : null,
  ] as Array<EditableLayerKey | null>).filter((item): item is EditableLayerKey => Boolean(item));
  const activeEditableLayer = editableLayers.includes(selectedLayer) ? selectedLayer : editableLayers[0] ?? null;
  const layerBounds = canvasSize.width > 0 && canvasSize.height > 0 ? canvasSize : { width: 320, height: isStory ? 568 : 320 };
  const centerLayer = (width: number, height: number) => ({
    x: Math.max(0, (layerBounds.width - width) / 2),
    y: Math.max(0, (layerBounds.height - height) / 2),
  });
  const adjustSelectedLayerScale = (delta: number) => {
    if (!activeEditableLayer) return;
    setLayerScale(current => {
      const next = Math.max(0.5, Math.min(2, Number((current[activeEditableLayer] + delta).toFixed(2))));
      return { ...current, [activeEditableLayer]: next };
    });
  };
  const titleInitial = {
    x: 28,
    y: isStory ? Math.max(24, layerBounds.height - 156) : 24,
  };
  const metricsInitial = {
    x: 28,
    y: isStory ? Math.max(24, layerBounds.height - 284) : Math.max(24, layerBounds.height - 100),
  };
  const showTitleLayer = !(isStory && activityTitle && !showStoryActivityTitle);
  const fixedRouteStyle = [
    styles.fixedRoute,
    variant === 'editorial_card'
      ? (isStory ? styles.fixedRouteStoryEditorial : styles.fixedRouteSquareEditorial)
      : variant === 'activity_achievement'
        ? (isStory ? styles.fixedRouteStoryActivity : styles.fixedRouteSquareActivity)
        : (isStory ? styles.fixedRouteStory : styles.fixedRouteSquare),
  ];
  const fixedBrandStyle = [
    styles.fixedBrand,
    isStory ? styles.fixedBrandStory : styles.fixedBrandSquare,
    variant === 'editorial_card' && styles.fixedBrandEditorial,
  ];
  const fixedTitleStyle = [
    styles.fixedTitle,
    variant === 'editorial_card'
      ? (isStory ? styles.fixedTitleStoryEditorial : styles.fixedTitleSquareEditorial)
      : (isStory ? styles.fixedTitleStory : styles.fixedTitleSquare),
  ];
  const fixedMetricsStyle = [
    styles.fixedMetrics,
    variant === 'editorial_card'
      ? (isStory ? styles.fixedMetricsStoryEditorial : styles.fixedMetricsSquareEditorial)
      : variant === 'activity_achievement'
        ? (isStory ? styles.fixedMetricsStoryActivity : styles.fixedMetricsSquareActivity)
        : (isStory ? styles.fixedMetricsStory : styles.fixedMetricsSquare),
  ];
  const fixedAchievementStyle = [
    styles.fixedAchievement,
    isStory ? styles.fixedAchievementStory : styles.fixedAchievementSquare,
  ];

  const canvas = (
    <View
      ref={canvasRef}
      collapsable={false}
      onLayout={(event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout;
        setCanvasSize(current => (
          Math.round(current.width) === Math.round(next.width) && Math.round(current.height) === Math.round(next.height)
            ? current
            : { width: next.width, height: next.height }
        ));
      }}
      style={[
        styles.canvas,
        isStory ? styles.story : styles.square,
        { backgroundColor: bg },
      ]}
    >
      {photoUri ? <ImageBackground source={{ uri: photoUri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      {photoUri && !isOverlay ? <View style={styles.photoScrim} /> : null}
      {routeEnabled ? <View style={fixedActivityLayout ? fixedRouteStyle : styles.routeLayer}><RouteOverlay activity={activity} light={foregroundDark} /></View> : null}
      {enabled.brand && fixedActivityLayout ? (
        <View style={fixedBrandStyle}>
          <StrideOSBrandMark />
        </View>
      ) : enabled.brand ? (
        <MovableLayer
          initial={{ x: 22, y: 22 }}
          bounds={layerBounds}
          baseWidth={112}
          baseHeight={74}
          scale={layerScale.brand}
          onSelect={() => setSelectedLayer('brand')}
          onInteractionActiveChange={onInteractionActiveChange}
          style={styles.brandLayer}
        >
          <StrideOSBrandMark />
        </MovableLayer>
      ) : null}
      {achievement && enabled.achievement && fixedActivityLayout ? (
        <View style={fixedAchievementStyle}>
          {runLevelSlug ? (
            <RunLevelBadge
              level={runLevelSlug}
              state={isOverlay ? 'share-transparent' : achievement.state === 'locked' ? 'locked' : 'share-opaque'}
              size={132}
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
        </View>
      ) : achievement && enabled.achievement ? (
        <MovableLayer
          initial={centerLayer(156, 156)}
          bounds={layerBounds}
          baseWidth={156}
          baseHeight={156}
          scale={layerScale.achievement}
          onSelect={() => setSelectedLayer('achievement')}
          onInteractionActiveChange={onInteractionActiveChange}
          style={styles.badgeLayer}
        >
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
      {showTitleLayer && fixedActivityLayout ? (
        <View style={fixedTitleStyle}>
          <Text style={[styles.kicker, foregroundDark ? styles.darkAccent : styles.lightAccent, styles.overlayTextShadow]}>
            {achievement ? 'ACHIEVEMENT UNLOCKED' : activityTitle ? 'ACTIVITY COMPLETE' : 'STRIDEOS'}
          </Text>
          <Text style={[styles.title, styles.fixedActivityTitle, foregroundDark ? styles.darkInk : styles.lightInk, !foregroundDark && styles.overlayTextShadow]} numberOfLines={3} adjustsFontSizeToFit>
            {variant === 'activity_achievement' && activityTitle && achievementShareTitle
              ? `${activityTitle} + ${achievementShareTitle}`
              : achievementShareTitle ?? activityTitle ?? 'TRAINING'}
          </Text>
          {achievementSupport ? <Text style={[styles.support, foregroundDark ? styles.darkInkMuted : styles.lightInkMuted, !foregroundDark && styles.overlayTextShadow]}>{achievementSupport}</Text> : null}
        </View>
      ) : showTitleLayer ? (
        <MovableLayer
          initial={titleInitial}
          bounds={layerBounds}
          baseWidth={244}
          baseHeight={128}
          onInteractionActiveChange={onInteractionActiveChange}
          style={styles.titleLayer}
        >
          <Text style={[styles.kicker, foregroundDark ? styles.darkAccent : styles.lightAccent]}>
            {achievement ? 'ACHIEVEMENT UNLOCKED' : activityTitle ? 'ACTIVITY COMPLETE' : 'STRIDEOS'}
          </Text>
          <Text style={[styles.title, foregroundDark ? styles.darkInk : styles.lightInk]} numberOfLines={3} adjustsFontSizeToFit>
            {variant === 'activity_achievement' && activityTitle && achievementShareTitle
              ? `${activityTitle} + ${achievementShareTitle}`
              : achievementShareTitle ?? activityTitle ?? 'TRAINING'}
          </Text>
          {achievementSupport ? <Text style={[styles.support, foregroundDark ? styles.darkInkMuted : styles.lightInkMuted]}>{achievementSupport}</Text> : null}
        </MovableLayer>
      ) : null}
      {selectedMetrics.length && fixedActivityLayout ? (
        <View style={fixedMetricsStyle}>
          {selectedMetrics.slice(0, 6).map(item => (
            <StatPill key={item.key} label={toggleLabel(item.key, activity).toUpperCase()} value={item.value} transparent />
          ))}
        </View>
      ) : selectedMetrics.length ? (
        <MovableLayer
          initial={metricsInitial}
          bounds={layerBounds}
          baseWidth={244}
          baseHeight={100}
          onInteractionActiveChange={onInteractionActiveChange}
          style={styles.metricsLayer}
        >
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
          onPress={() => {
            setLayerScale({ achievement: 1, brand: 1 });
            setLayoutEpoch(current => current + 1);
          }}
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
                brand: false,
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
          {isStory && activityTitle ? (
            <TouchableOpacity
              style={[styles.detailsRow, showStoryActivityTitle && styles.detailsRowOn]}
              onPress={() => setShowStoryActivityTitle(current => !current)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: showStoryActivityTitle }}
              accessibilityLabel={`Activity title ${showStoryActivityTitle ? 'enabled' : 'disabled'}`}
            >
              <Text style={[styles.detailsCheck, showStoryActivityTitle ? styles.toggleTextOn : styles.toggleTextOff]}>{showStoryActivityTitle ? '✓' : ''}</Text>
              <Text style={[styles.toggleText, showStoryActivityTitle ? styles.toggleTextOn : styles.toggleTextOff]}>Activity Title</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {activeEditableLayer ? (
        <View style={styles.layerControls}>
          {editableLayers.map(layer => {
            const active = layer === activeEditableLayer;
            return (
              <TouchableOpacity
                key={layer}
                style={[styles.layerChip, active ? styles.toggleOn : styles.toggleOff]}
                onPress={() => setSelectedLayer(layer)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.toggleText, active ? styles.toggleTextOn : styles.toggleTextOff]}>
                  {layer === 'brand' ? 'Logo' : 'Badge'}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.sizeControls}>
            <TouchableOpacity
              style={[styles.sizeButton, styles.toggleOff]}
              onPress={() => adjustSelectedLayerScale(-0.08)}
              accessibilityRole="button"
              accessibilityLabel={`Make ${activeEditableLayer === 'brand' ? 'logo' : 'badge'} smaller`}
            >
              <Text style={[styles.toggleText, styles.toggleTextOff]}>-</Text>
            </TouchableOpacity>
            <Text style={styles.sizeValue}>{Math.round(layerScale[activeEditableLayer] * 100)}%</Text>
            <TouchableOpacity
              style={[styles.sizeButton, styles.toggleOff]}
              onPress={() => adjustSelectedLayerScale(0.08)}
              accessibilityRole="button"
              accessibilityLabel={`Make ${activeEditableLayer === 'brand' ? 'logo' : 'badge'} larger`}
            >
              <Text style={[styles.toggleText, styles.toggleTextOff]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      <View key={layoutEpoch} style={styles.canvasPreviewFrame}>{canvas}</View>
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
  layerControls: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(94,126,146,0.34)', backgroundColor: 'rgba(14,14,15,0.78)', padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  layerChip: { minHeight: 30, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  sizeControls: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7 },
  sizeButton: { width: 32, height: 30, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sizeValue: { color: '#DCC9B1', minWidth: 42, textAlign: 'center', fontSize: 11, fontWeight: '900' },
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
  canvasPreviewFrame: { borderRadius: 18, overflow: 'hidden' },
  canvas: { width: '100%', overflow: 'hidden', borderRadius: 0 },
  square: { aspectRatio: 1 },
  story: { aspectRatio: 9 / 16 },
  photoScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.26)' },
  routeLayer: { ...StyleSheet.absoluteFill },
  movable: { position: 'absolute' },
  brandLayer: { alignItems: 'center', justifyContent: 'center' },
  fixedBrand: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  fixedBrandSquare: { left: 0, right: 0, bottom: 22 },
  fixedBrandStory: { left: 0, right: 0, bottom: 42 },
  fixedBrandEditorial: { opacity: 0.94 },
  logoMark: { width: 112, minHeight: 74, alignItems: 'center', justifyContent: 'center' },
  logoWord: { fontSize: 25, lineHeight: 30, fontWeight: '900', fontFamily: 'CormorantGaramond_700Bold' },
  logoStride: { color: '#F3F1EB' },
  logoOS: { color: '#6F97B0' },
  logoChevronRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 5 },
  logoChevron: { fontSize: 27, lineHeight: 28, fontWeight: '900' },
  badgeLayer: { alignItems: 'center', justifyContent: 'center' },
  fixedAchievement: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  fixedAchievementSquare: { left: 0, right: 0, top: '32%' },
  fixedAchievementStory: { left: 0, right: 0, top: '38%' },
  titleLayer: { right: 38, gap: 4 },
  fixedTitle: { position: 'absolute', gap: 2 },
  fixedTitleSquare: { left: 24, right: 24, top: 24, alignItems: 'flex-start' },
  fixedTitleStory: { left: 28, right: 28, top: 42, alignItems: 'center' },
  fixedTitleSquareEditorial: { left: 24, right: 24, top: 28, alignItems: 'center' },
  fixedTitleStoryEditorial: { left: 28, right: 28, top: 54, alignItems: 'center' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 39, lineHeight: 42, fontWeight: '900', letterSpacing: 0 },
  fixedActivityTitle: { fontSize: 34, lineHeight: 36, maxWidth: 260 },
  support: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  metricsLayer: { right: 38, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fixedMetrics: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fixedMetricsSquare: { left: 24, right: 24, bottom: 108, justifyContent: 'center' },
  fixedMetricsStory: { left: 34, right: 34, top: 142, justifyContent: 'center' },
  fixedMetricsSquareEditorial: { left: 28, right: 28, top: 104, justifyContent: 'center' },
  fixedMetricsStoryEditorial: { left: 34, right: 34, top: 150, justifyContent: 'center' },
  fixedMetricsSquareActivity: { left: 24, right: 24, bottom: 96, justifyContent: 'center' },
  fixedMetricsStoryActivity: { left: 34, right: 34, top: 132, justifyContent: 'center' },
  fixedRoute: { position: 'absolute' },
  fixedRouteSquare: { left: 62, right: 62, top: 118, bottom: 126 },
  fixedRouteStory: { left: 56, right: 56, top: 260, bottom: 176 },
  fixedRouteSquareEditorial: { left: 62, right: 62, top: 148, bottom: 118 },
  fixedRouteStoryEditorial: { left: 56, right: 56, top: 292, bottom: 180 },
  fixedRouteSquareActivity: { left: 68, right: 68, top: 158, bottom: 144 },
  fixedRouteStoryActivity: { left: 56, right: 56, top: 318, bottom: 198 },
  statPill: { minWidth: 116, borderRadius: 8, padding: 10, backgroundColor: 'rgba(14,14,15,0.68)', borderWidth: 1, borderColor: 'rgba(157,178,160,0.34)' },
  statPillTransparent: { minWidth: 84, padding: 2, backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent', alignItems: 'center' },
  statValue: { color: '#F3F1EB', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#DCC9B1', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  overlayTextShadow: { textShadowColor: 'rgba(0,0,0,0.62)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  lightInk: { color: '#F3F1EB' },
  lightInkMuted: { color: '#DCC9B1' },
  lightAccent: { color: '#DCC9B1' },
  darkInk: { color: '#0E0E0F' },
  darkInkMuted: { color: '#4D433E' },
  darkAccent: { color: '#8B6B52' },
  privacy: { color: '#9C948A', fontSize: 11, lineHeight: 16 },
});
