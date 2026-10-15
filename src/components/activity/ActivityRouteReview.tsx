import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline as SvgPolyline } from 'react-native-svg';
import MapView, { Marker, Polyline } from '../maps/MapComponents';
import VideoScrubBar from '../movement/VideoScrubBar';
import type { Activity } from '../../types/activity';
import type { UnitSystem } from '../../store/settingsStore';
import { useColors } from '../../theme/useColors';
import { buildRouteReviewObservations, routeObservationAtFraction, sampleAtTime, type RouteObservation } from '../../utils/outdoorAnalysis';
import { formatDuration } from '../../utils/activitySummary';
import { formatDistance, formatPaceSecPerMile, formatSpeedMps } from '../../lib/units';
import { isOutdoorSport, OUTDOOR_SPORTS } from '../../utils/outdoorSports';
import { powerSampleLabel, routePowerSample } from '../../utils/outdoorPower';

export default function ActivityRouteReview({ activity, units, onInteractionActiveChange }: {
  activity: Activity; units: UnitSystem; onInteractionActiveChange?: (active: boolean) => void;
}) {
  const C = useColors();
  const [fraction, setFraction] = useState(0);
  const observations = useMemo(() => buildRouteReviewObservations(activity), [activity]);
  const plot = useMemo(() => {
    const stride = Math.max(1, Math.ceil(observations.length / 800));
    return observations.filter((point, index) => index % stride === 0 || index === observations.length - 1 || !point.continuous || !observations[index + 1]?.continuous
      || Number.isFinite(point.point.altitudeMeters) !== Number.isFinite(observations[index + 1]?.point.altitudeMeters));
  }, [observations]);
  const groups = useMemo(() => {
    const output: RouteObservation[][] = [];
    for (const point of plot) {
      if (!point.continuous || !output.length) output.push([]);
      output.at(-1)!.push(point);
    }
    return output;
  }, [plot]);
  const selected = routeObservationAtFraction(observations, fraction);
  if (!selected || observations.length < 2) return null;
  const first = observations[0]!.point;
  const lats = plot.map(item => item.point.latitude);
  const lngs = plot.map(item => item.point.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pointXY = (point: RouteObservation) => ({ x: 16 + (point.point.longitude - minLng) / Math.max(0.00001, maxLng - minLng) * 288, y: 224 - (point.point.latitude - minLat) / Math.max(0.00001, maxLat - minLat) * 208 });
  const altitudes = plot.map(item => item.point.altitudeMeters).filter((value): value is number => Number.isFinite(value));
  const minAlt = Math.min(...altitudes), maxAlt = Math.max(...altitudes);
  const totalDistance = Math.max(1, observations.at(-1)!.distanceMeters);
  const altitudeY = (altitude: number) => 88 - (altitude - minAlt) / Math.max(1, maxAlt - minAlt) * 76;
  let altitudePath = '';
  let drawingAltitude = false;
  for (const point of plot) {
    const altitude = point.point.altitudeMeters;
    if (!Number.isFinite(altitude)) { drawingAltitude = false; continue; }
    altitudePath += `${!point.continuous || !drawingAltitude ? 'M' : 'L'}${(point.distanceMeters / totalDistance * 320).toFixed(2)} ${altitudeY(altitude!).toFixed(2)} `;
    drawingAltitude = true;
  }
  const hr = sampleAtTime(activity.metrics.rawHeartRateSamples, selected.point.timestamp, 30_000, activity.metrics.recordingPauses);
  const cadence = sampleAtTime(activity.metrics.cadenceSamples, selected.point.timestamp, 10_000, activity.metrics.recordingPauses);
  const power = routePowerSample(activity, selected.point.timestamp);
  const speedBased = isOutdoorSport(activity.activityType) && OUTDOOR_SPORTS[activity.activityType].speedBased;
  const elevation = (value?: number) => Number.isFinite(value) ? `${Math.round(value! * (units === 'metric' ? 1 : 3.28084))} ${units === 'metric' ? 'm' : 'ft'}` : '--';
  const rows = [
    ['Distance', formatDistance(selected.distanceMeters / 1609.344, units)],
    ['Time', formatDuration(selected.activeSeconds)],
    ['Elevation', elevation(selected.point.altitudeMeters)],
    ['Grade', selected.grade == null ? '--' : `${(selected.grade * 100).toFixed(1)}%`],
    ['Heart rate', hr ? `${Math.round(hr.bpm)} bpm` : '--'],
    [speedBased ? 'Speed' : 'Pace', selected.speedMps ? speedBased ? formatSpeedMps(selected.speedMps, units) : formatPaceSecPerMile(1609.344 / selected.speedMps, units) : '--'],
    ...(cadence ? [['Cadence', cadence.kind === 'steps' ? `${Math.round(cadence.cadenceSpm)} spm` : `${Math.round(cadence.cadenceRpm)} rpm`]] : []),
    ...(power ? [[powerSampleLabel(power), `${Math.round(power.watts)} W`]] : []),
  ];
  const xy = pointXY(selected);
  return <View style={s.root}>
    <Text style={[s.heading, { color: C.textDim }]}>ROUTE REVIEW</Text>
    <View style={[s.map, { backgroundColor: C.cardAlt }]}>
      {Platform.OS === 'web' ? <Svg width="100%" height="100%" viewBox="0 0 320 240">
        {groups.map((group, index) => <SvgPolyline key={index} points={group.map(point => { const p = pointXY(point); return `${p.x},${p.y}`; }).join(' ')} stroke={C.positive} strokeWidth={4} fill="none" />)}
        <Circle cx={xy.x} cy={xy.y} r={6} fill={C.primary} stroke={C.text} strokeWidth={2} />
      </Svg> : <MapView style={StyleSheet.absoluteFill} initialRegion={{ latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2, latitudeDelta: Math.max(0.006, (maxLat - minLat) * 1.4), longitudeDelta: Math.max(0.006, (maxLng - minLng) * 1.4) }}>
        {groups.filter(group => group.length > 1).map((group, index) => <Polyline key={index} coordinates={group.map(item => item.point)} strokeColor={C.positive} strokeWidth={5} />)}
        <Marker coordinate={first} title="Start" />
        <Marker coordinate={selected.point} title={formatDuration(selected.activeSeconds)} pinColor={C.primary} />
      </MapView>}
    </View>
    {altitudes.length > 1 ? <Svg width="100%" height={100} viewBox="0 0 320 100" accessibilityLabel="Recorded elevation profile">
      <Line x1={0} y1={94} x2={320} y2={94} stroke={C.border} />
      <Path d={altitudePath} fill="none" stroke={C.primary} strokeWidth={2} />
      <Line x1={selected.distanceMeters / totalDistance * 320} y1={4} x2={selected.distanceMeters / totalDistance * 320} y2={94} stroke={C.textMuted} />
    </Svg> : null}
    <VideoScrubBar progress={fraction} onScrub={setFraction} onScrubStart={() => onInteractionActiveChange?.(true)} onScrubEnd={() => onInteractionActiveChange?.(false)} onScrubCancel={() => onInteractionActiveChange?.(false)} accessibilityLabel="Recorded route timeline" />
    <View style={[s.readout, { borderColor: C.border }]}>
      {rows.map(([label, value]) => <View key={label} style={s.metric}>
        <Text style={[s.value, { color: C.text }]}>{value}</Text>
        <Text style={[s.label, { color: C.textDim }]}>{label}</Text>
      </View>)}
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 10 }, heading: { fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  map: { height: 260, width: '100%', overflow: 'hidden', borderRadius: 8 },
  readout: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 14 },
  metric: { minWidth: 84, flexGrow: 1, flexBasis: '27%' },
  value: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { fontSize: 11, marginTop: 3 },
});
