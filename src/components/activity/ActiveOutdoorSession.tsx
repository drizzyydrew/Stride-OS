import { useMemo, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Polyline as SvgPolyline } from 'react-native-svg';

import MapView, { Marker, Polyline } from '../maps/MapComponents';
import { useColors } from '../../theme/useColors';
import { buildRouteReviewObservations } from '../../utils/outdoorAnalysis';
import type { TrackPoint } from '../../utils/activityTracking';
import type { OutdoorSport } from '../../utils/outdoorSports';
import type { Activity } from '../../types/activity';

export type OutdoorSessionMetric = { label: string; value: string; detail?: string };

export function fitMetricFontSize(value: string, width: number | null, maximum: number, minimum: number, unit = '') {
  if (width == null || !Number.isFinite(width) || width <= 0) return minimum;
  const unitWidth = unit ? (unit.length + 1) * 14 * 0.65 : 0;
  // Long recordings can exceed the nominal minimum; preserve their full value.
  return Math.max(Math.min(minimum, 11), Math.min(maximum, Math.floor((width - unitWidth) / Math.max(1, value.length * 0.65))));
}
export type ActiveOutdoorSessionProps = {
  name: string;
  activityType: OutdoorSport;
  paused: boolean;
  ending?: boolean;
  startedAt: number | null;
  points: TrackPoint[];
  recordingPauses: { startTime: number; endTime: number }[];
  timeLabel: string;
  distanceLabel: string;
  distanceUnit: string;
  primaryMetrics: OutdoorSessionMetric[];
  additionalMetrics: OutdoorSessionMetric[];
  gpsStatus?: ReactNode;
  watchStatus: string;
  watchDetail?: string;
  interval?: { name: string; remaining: number };
  instruction?: string | null;
  coachingControls: ReactNode;
  powerSettings?: ReactNode;
  onPauseResume: () => void;
  onFinish: () => void;
};

export function liveOutdoorMapSegments(points: TrackPoint[], activityType: OutdoorSport,
  startedAt: number | null, recordingPauses: ActiveOutdoorSessionProps['recordingPauses']) {
  // A read-only route projection uses the same accuracy, spike and gap rules as review.
  const observations = buildRouteReviewObservations({ activityType, indoor: false,
    startTime: startedAt ?? points[0]?.timestamp ?? 0,
    metrics: { recordingPauses, routeCoordinates: points.map(point => ({ ...point, horizontalAccuracyMeters: point.accuracyMeters })) },
  } as Activity);
  const groups: TrackPoint[][] = [];
  for (const observation of observations) {
    if (!observation.continuous || !groups.length) groups.push([]);
    groups.at(-1)!.push(observation.point);
  }
  return groups;
}

/** Presentation only. Session ownership, telemetry and completion stay with the caller. */
export default function ActiveOutdoorSession(props: ActiveOutdoorSessionProps) {
  const C = useColors();
  const { height } = useWindowDimensions();
  const [followingLocation, setFollowingLocation] = useState(true);
  const groups = useMemo(() => liveOutdoorMapSegments(props.points, props.activityType, props.startedAt, props.recordingPauses),
    [props.points, props.activityType, props.startedAt, props.recordingPauses]);
  const points = groups.flat();
  const first = points[0];
  const last = points.at(-1);
  const region = last ? { latitude: last.latitude, longitude: last.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 } : undefined;
  const recenter = () => setFollowingLocation(true);
  // Preserve geographic proportions in the web trace; it is not a fabricated basemap.
  const latitude = first?.latitude ?? 0;
  const longitudeScale = Math.max(0.01, Math.cos(latitude * Math.PI / 180));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const point of points) {
    const x = point.longitude * longitudeScale;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, point.latitude); maxY = Math.max(maxY, point.latitude);
  }
  const scale = Math.min(296 / Math.max(0.00001, maxX - minX), 144 / Math.max(0.00001, maxY - minY));
  const xy = (point: TrackPoint) => ({
    x: 180 + (point.longitude * longitudeScale - (minX + maxX) / 2) * scale,
    y: 158 - (point.latitude - (minY + maxY) / 2) * scale,
  });

  return <View style={[s.root, { backgroundColor: C.bg }]}>
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      <View testID="active-outdoor-map" style={[s.map, { height: Math.max(210, Math.min(280, height * 0.31)), backgroundColor: C.cardAlt }]}>
        {last ? Platform.OS === 'web' ? <Svg width="100%" height="100%" viewBox="0 0 360 260" accessibilityLabel="Recorded live GPS trace">
          {groups.filter(group => group.length > 1).map((group, index) => <SvgPolyline key={index}
            points={group.map(point => { const p = xy(point); return `${p.x},${p.y}`; }).join(' ')}
            stroke={C.primary} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
          {first ? <Circle cx={xy(first).x} cy={xy(first).y} r={4} fill={C.bg} stroke={C.primary} strokeWidth={2} /> : null}
          <Circle cx={xy(last).x} cy={xy(last).y} r={6} fill={C.accent} stroke={C.bg} strokeWidth={2} />
        </Svg> : <MapView style={StyleSheet.absoluteFill} initialRegion={region}
          showsUserLocation followsUserLocation={followingLocation} showsMyLocationButton={false}
          onPanDrag={() => setFollowingLocation(false)}>
          {groups.filter(group => group.length > 1).map((group, index) => <Polyline key={index} coordinates={group} strokeColor={C.primary} strokeWidth={5} />)}
          {first ? <Marker coordinate={first} title="Recording start" pinColor={C.positive} /> : null}
          <Marker coordinate={last} title="Latest recorded location" pinColor={C.accent} />
        </MapView> : <View style={s.waiting}>
          <Ionicons name="location-outline" size={27} color={C.textMuted} />
          <Text style={[s.statusText, { color: C.textMuted }]}>Waiting for an accurate GPS location</Text>
        </View>}
        <View pointerEvents="none" style={[s.mapHeading, { backgroundColor: C.bg }]}>
          <Text numberOfLines={2} style={[s.sessionName, { color: C.text }]}>{props.name}</Text>
          <Text style={[s.state, { color: props.ending || props.paused ? C.warning : C.textMuted }]}>{props.ending ? 'Finishing' : props.paused ? 'Paused' : 'Recording'}</Text>
        </View>
        {Platform.OS !== 'web' ? <TouchableOpacity onPress={recenter} disabled={!last}
          accessibilityRole="button" accessibilityLabel="Recenter map on current location" accessibilityState={{ disabled: !last }}
          style={[s.mapButton, { backgroundColor: C.bg, borderColor: C.border, opacity: last ? 1 : 0.5 }]}>
          <Ionicons name="navigate-outline" size={21} color={C.text} />
        </TouchableOpacity> : last ? <Text style={[s.traceLabel, { color: C.textMuted }]}>Recorded GPS trace</Text> : null}
      </View>
      <View style={s.body}>
        <View testID="active-outdoor-primary" style={s.primaryRow}>
          <View style={s.primaryMetric}>
            <FittedMetricText value={props.timeLabel} primary color={C.text} />
            <Text style={[s.label, { color: C.textMuted }]}>Time</Text>
          </View>
          <View style={[s.primaryMetric, s.distance]}>
            <FittedMetricText value={props.distanceLabel} unit={props.distanceUnit} primary align="right" color={C.accent} />
            <Text style={[s.label, { color: C.textMuted }]}>Distance</Text>
          </View>
        </View>
        <View style={[s.metricRow, { borderColor: C.border }]}>
          {props.primaryMetrics.map(metric => <Metric key={metric.label} metric={metric} />)}
        </View>
        {props.additionalMetrics.length ? <View style={[s.metricRow, { borderColor: C.border }]}>
          {props.additionalMetrics.map(metric => <Metric key={metric.label} metric={metric} />)}
        </View> : null}
        {props.gpsStatus}
        {props.interval ? <View style={[s.instruction, { borderColor: C.border }]}>
          <Ionicons name="walk-outline" size={20} color={C.primary} />
          <Text style={[s.instructionText, { color: C.text }]}>{props.interval.name}<Text style={{ color: C.textMuted }}> · {props.interval.remaining}s remaining</Text></Text>
        </View> : null}
        {props.instruction ? <View style={[s.instruction, { borderColor: C.border }]}>
          <Ionicons name="navigate-outline" size={20} color={C.primary} />
          <Text style={[s.instructionText, { color: C.text }]}>{props.instruction}</Text>
        </View> : null}
        <View style={[s.watch, { borderColor: C.border }]}>
          <Ionicons name="watch-outline" size={18} color={C.primary} />
          <View style={s.statusBody}>
            <Text style={[s.statusTitle, { color: C.text }]}>Apple Watch</Text>
            <Text style={[s.statusText, { color: C.textMuted }]}>{props.watchStatus}</Text>
            {props.watchDetail ? <Text style={[s.statusText, { color: C.textMuted }]}>{props.watchDetail}</Text> : null}
          </View>
        </View>
        <View style={[s.coaching, { borderColor: C.border }]}>
          <Text style={[s.statusTitle, { color: C.text }]}>Voice coaching</Text>
          {props.coachingControls}
        </View>
        {props.powerSettings ? <View style={[s.powerSettings, { borderColor: C.border }]}>{props.powerSettings}</View> : null}
      </View>
    </ScrollView>
    <View style={[s.controls, { borderColor: C.border, backgroundColor: C.bg }]}>
      <TouchableOpacity onPress={props.ending ? undefined : props.onPauseResume} disabled={props.ending} accessibilityRole="button"
        accessibilityState={{ disabled: !!props.ending }}
        accessibilityLabel={props.ending ? 'Activity ending' : props.paused ? 'Resume activity' : 'Pause activity'} style={[s.pause, { backgroundColor: props.ending ? C.disabledSurface : C.primary }]}>
        <Ionicons name={props.paused && !props.ending ? 'play' : 'pause'} size={27} color={props.ending ? C.disabledText : C.onPrimary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={props.onFinish} accessibilityRole="button" accessibilityLabel={props.ending ? 'Retry finish activity' : 'Complete activity'} style={[s.finish, { backgroundColor: C.critical }]}>
        <Ionicons name="stop-circle" size={21} color="#FFFFFF" />
        <Text style={s.finishText}>{props.ending ? 'Retry Finish' : 'Finish'}</Text>
      </TouchableOpacity>
    </View>
  </View>;
}

function Metric({ metric }: { metric: OutdoorSessionMetric }) {
  const C = useColors();
  return <View style={s.metric}>
    <FittedMetricText value={metric.value} color={C.text} />
    <Text style={[s.label, { color: C.textMuted }]}>{metric.label}</Text>
    {metric.detail ? <Text style={[s.detail, { color: C.textMuted }]}>{metric.detail}</Text> : null}
  </View>;
}

function FittedMetricText({ value, unit = '', primary = false, align = 'left', color }: {
  value: string; unit?: string; primary?: boolean; align?: 'left' | 'right'; color: string;
}) {
  const [width, setWidth] = useState<number | null>(null);
  const fontSize = fitMetricFontSize(value, width, primary ? 40 : 16, primary ? 18 : 11, unit);
  return <View style={s.fittedValue} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
      style={[primary ? s.primaryValue : s.metricValue, { color, fontSize, textAlign: align }]}>
      {value}{unit ? <Text style={s.unit}> {unit}</Text> : null}
    </Text>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1 }, scroll: { flex: 1 }, scrollContent: { paddingBottom: 16 },
  map: { width: '100%', overflow: 'hidden' },
  mapHeading: { position: 'absolute', top: 12, left: 16, right: 76, paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'flex-start', borderRadius: 6 },
  sessionName: { fontSize: 15, fontWeight: '700' }, state: { fontSize: 11, marginTop: 2 },
  mapButton: { position: 'absolute', top: 12, right: 16, width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  traceLabel: { position: 'absolute', bottom: 8, left: 16, fontSize: 10 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 36, gap: 8 },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  primaryRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-end', paddingBottom: 14 },
  primaryMetric: { flex: 1, minWidth: 0 }, distance: { alignItems: 'flex-end' },
  fittedValue: { width: '100%', minWidth: 0 },
  primaryValue: { lineHeight: 48, fontWeight: '800', fontVariant: ['tabular-nums'] }, unit: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  metricRow: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 12, gap: 12 },
  metric: { flexGrow: 1, flexBasis: '27%', minWidth: 0 },
  metricValue: { lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] }, detail: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  instruction: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  instructionText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  watch: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, paddingVertical: 12 },
  statusBody: { flex: 1 }, statusTitle: { fontSize: 12, fontWeight: '700' }, statusText: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  coaching: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  powerSettings: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
  controls: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  pause: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  finish: { flex: 1, minHeight: 52, maxWidth: 230, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  finishText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
