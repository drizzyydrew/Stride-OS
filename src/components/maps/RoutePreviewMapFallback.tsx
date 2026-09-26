import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, type LatLng, type Region } from './MapComponents';
import type { RouteInterval, RoutePoint } from '../../store/routeStore';

type Props = {
  points: RoutePoint[];
  segments?: RouteInterval[];
  style?: StyleProp<ViewStyle>;
  lineColor: string;
  segmentColor: string;
  customMapStyle?: unknown;
};

function routeRegion(points: RoutePoint[]): Region {
  if (points.length === 0) {
    return { latitude: 44.058, longitude: -121.315, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }

  const latitudes = points.map(point => point.latitude);
  const longitudes = points.map(point => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.45, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.45, 0.01),
  };
}

function toLatLng(points: RoutePoint[]): LatLng[] {
  return points.map(point => ({ latitude: point.latitude, longitude: point.longitude }));
}

export default function RoutePreviewMapFallback({
  points,
  segments = [],
  style,
  lineColor,
  segmentColor,
  customMapStyle,
}: Props) {
  return (
    <MapView
      style={[styles.map, style]}
      initialRegion={routeRegion(points)}
      customMapStyle={customMapStyle}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      <Polyline coordinates={toLatLng(points)} strokeColor={lineColor} strokeWidth={4} />
      {points[0] ? <Marker coordinate={points[0]} title="Start" /> : null}
      {segments.map(segment => (
        <Marker
          key={segment.label}
          coordinate={segment.point}
          title={`Segment ${segment.label}`}
          description={`${segment.distanceMiles.toFixed(2)} mi from start`}
          pinColor={segmentColor}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    overflow: 'hidden',
  },
});
