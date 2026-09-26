import { useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Mapbox, { Camera, CircleLayer, LineLayer, MapView, ShapeSource } from '@rnmapbox/maps';
import FallbackRoutePreviewMap from './RoutePreviewMapFallback';
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL, isMapboxConfigured } from '../../lib/mapboxConfig';
import { routeOfflineBounds } from '../../lib/mapboxOffline';
import type { RouteInterval, RoutePoint } from '../../store/routeStore';

type Props = {
  points: RoutePoint[];
  segments?: RouteInterval[];
  style?: StyleProp<ViewStyle>;
  lineColor: string;
  segmentColor: string;
  customMapStyle?: unknown;
};

if (isMapboxConfigured()) {
  void Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

function routeFeature(points: RoutePoint[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map(point => [point.longitude, point.latitude]),
    },
  };
}

function pointFeature(id: string, point: RoutePoint, kind: 'start' | 'segment') {
  return {
    type: 'Feature' as const,
    id,
    properties: { kind },
    geometry: {
      type: 'Point' as const,
      coordinates: [point.longitude, point.latitude],
    },
  };
}

type PointFeature = ReturnType<typeof pointFeature>;

function isPointFeature(feature: PointFeature | null): feature is PointFeature {
  return feature !== null;
}

export default function RoutePreviewMap({
  points,
  segments = [],
  style,
  lineColor,
  segmentColor,
  customMapStyle,
}: Props) {
  const mapboxReady = isMapboxConfigured() && points.length >= 2;
  const bounds = useMemo(() => routeOfflineBounds(points, 0.006), [points]);
  const routeShape = useMemo(() => routeFeature(points), [points]);
  const markerShape = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: [
      points[0] ? pointFeature('start', points[0], 'start') : null,
      ...segments.map(segment => pointFeature(segment.label, segment.point, 'segment')),
    ].filter(isPointFeature),
  }), [points, segments]);

  if (!mapboxReady || !bounds) {
    return (
      <FallbackRoutePreviewMap
        points={points}
        segments={segments}
        style={style}
        lineColor={lineColor}
        segmentColor={segmentColor}
        customMapStyle={customMapStyle}
      />
    );
  }

  const [ne, sw] = bounds;

  return (
    <MapView
      style={[styles.map, style]}
      styleURL={MAPBOX_STYLE_URL}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      compassEnabled={false}
      scaleBarEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
    >
      <Camera
        bounds={{
          ne,
          sw,
          paddingTop: 28,
          paddingBottom: 28,
          paddingLeft: 28,
          paddingRight: 28,
        }}
        animationDuration={0}
      />
      <ShapeSource id="route-preview-line" shape={routeShape}>
        <LineLayer
          id="route-preview-line-layer"
          style={{
            lineColor,
            lineWidth: 4,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </ShapeSource>
      <ShapeSource id="route-preview-points" shape={markerShape}>
        <CircleLayer
          id="route-preview-start-layer"
          filter={['==', ['get', 'kind'], 'start']}
          style={{
            circleColor: lineColor,
            circleRadius: 5,
            circleStrokeColor: '#ffffff',
            circleStrokeWidth: 2,
          }}
        />
        <CircleLayer
          id="route-preview-segment-layer"
          filter={['==', ['get', 'kind'], 'segment']}
          style={{
            circleColor: segmentColor,
            circleRadius: 4,
            circleStrokeColor: '#ffffff',
            circleStrokeWidth: 1.5,
          }}
        />
      </ShapeSource>
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    overflow: 'hidden',
  },
});
