import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Mapbox, {
  Camera,
  LineLayer,
  MapView as MapboxMapView,
  PointAnnotation,
  ShapeSource,
  UserLocation,
  type Camera as CameraRef,
} from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL, isMapboxConfigured } from '../../lib/mapboxConfig';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Region = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapViewRef = {
  animateToRegion: (region: Region, duration?: number) => void;
};

type MapViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  region?: Region;
  customMapStyle?: unknown;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain' | string;
  onMapReady?: () => void;
  onPress?: (event: { nativeEvent: { coordinate: LatLng } }) => void;
};

type MarkerProps = {
  coordinate: LatLng;
  children?: ReactNode;
  draggable?: boolean;
  title?: string;
  description?: string;
  pinColor?: string;
  anchor?: { x: number; y: number };
  onDragEnd?: (event: { nativeEvent: { coordinate: LatLng } }) => void;
  onCalloutPress?: () => void;
};

type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
};

if (isMapboxConfigured()) {
  void Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

function center(region: Region): [number, number] {
  return [region.longitude, region.latitude];
}

function zoomForRegion(region: Region): number {
  const delta = Math.max(region.latitudeDelta, region.longitudeDelta, 0.0001);
  return Math.max(3, Math.min(18, Math.log2(360 / delta)));
}

function styleUrlForMapType(mapType?: string): string {
  if (mapType === 'satellite' || mapType === 'hybrid') return Mapbox.StyleURL.SatelliteStreet;
  return MAPBOX_STYLE_URL;
}

function eventCoordinate(event: unknown): LatLng | null {
  const payload = event as {
    geometry?: { coordinates?: unknown };
    coordinates?: unknown;
    nativeEvent?: { payload?: string };
  };
  let coordinates = payload.geometry?.coordinates ?? payload.coordinates;
  if (!coordinates && typeof payload.nativeEvent?.payload === 'string') {
    try {
      const parsed = JSON.parse(payload.nativeEvent.payload) as { geometry?: { coordinates?: unknown } };
      coordinates = parsed.geometry?.coordinates;
    } catch {
      coordinates = undefined;
    }
  }
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude };
}

function lineFeature(coordinates: LatLng[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: coordinates.map(point => [point.longitude, point.latitude]),
    },
  };
}

function layerSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

const MapView = forwardRef<MapViewRef, MapViewProps>(({
  children,
  style,
  initialRegion,
  region,
  scrollEnabled = true,
  zoomEnabled = true,
  rotateEnabled = true,
  pitchEnabled = true,
  showsUserLocation = false,
  followsUserLocation = false,
  mapType,
  onMapReady,
  onPress,
}, ref) => {
  const cameraRef = useRef<CameraRef>(null);
  const [cameraRegion, setCameraRegion] = useState<Region | undefined>(region ?? initialRegion);

  useEffect(() => {
    if (region) setCameraRegion(region);
  }, [region]);

  useImperativeHandle(ref, () => ({
    animateToRegion(nextRegion: Region, duration = 0) {
      setCameraRegion(nextRegion);
      cameraRef.current?.setCamera({
        centerCoordinate: center(nextRegion),
        zoomLevel: zoomForRegion(nextRegion),
        animationDuration: duration,
      });
    },
  }), []);

  const cameraProps = cameraRegion
    ? {
      centerCoordinate: center(cameraRegion),
      zoomLevel: zoomForRegion(cameraRegion),
      animationDuration: 0,
    }
    : {};

  return (
    <MapboxMapView
      style={[styles.map, style]}
      styleURL={styleUrlForMapType(mapType)}
      scrollEnabled={scrollEnabled}
      zoomEnabled={zoomEnabled}
      rotateEnabled={rotateEnabled}
      pitchEnabled={pitchEnabled}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={false}
      scaleBarEnabled={false}
      onDidFinishLoadingMap={onMapReady}
      onPress={(event) => {
        const coordinate = eventCoordinate(event);
        if (coordinate) onPress?.({ nativeEvent: { coordinate } });
      }}
    >
      <Camera
        ref={cameraRef}
        followUserLocation={followsUserLocation}
        followZoomLevel={cameraRegion ? zoomForRegion(cameraRegion) : undefined}
        {...cameraProps}
      />
      {showsUserLocation ? <UserLocation visible animated /> : null}
      {children}
    </MapboxMapView>
  );
});

MapView.displayName = 'MapboxMapComponentsMapView';

export function Marker({
  coordinate,
  children,
  draggable,
  pinColor = '#7B96A4',
  onDragEnd,
  onCalloutPress,
}: MarkerProps) {
  const idRef = useRef<string | null>(null);
  if (!idRef.current) idRef.current = `marker-${Math.random().toString(36).slice(2)}`;
  return (
    <PointAnnotation
      id={idRef.current}
      coordinate={[coordinate.longitude, coordinate.latitude]}
      draggable={draggable}
      onSelected={() => onCalloutPress?.()}
      onDragEnd={(event) => {
        const next = eventCoordinate(event);
        if (next) onDragEnd?.({ nativeEvent: { coordinate: next } });
      }}
    >
      {React.isValidElement(children) ? children : (
        <View style={[styles.marker, { backgroundColor: pinColor }]}>
          <View style={styles.markerCore} />
        </View>
      )}
    </PointAnnotation>
  );
}

export function Polyline({
  coordinates,
  strokeColor = '#7B96A4',
  strokeWidth = 4,
  lineDashPattern,
}: PolylineProps) {
  // Stable ids: the ShapeSource updates its geometry in place. Ids that change
  // with the geometry remount the source and layers on every waypoint edit,
  // which flickers and can leave a stale layer behind.
  const idRef = useRef<string | null>(null);
  if (!idRef.current) idRef.current = layerSafeId(`polyline-${Math.random().toString(36).slice(2)}`);
  const shape = useMemo(() => lineFeature(coordinates), [coordinates]);
  if (coordinates.length < 2) return null;
  const id = idRef.current;

  // Unresolved / unsnapped path: one thin dashed line, no casing. Dashing the
  // casing and shadow as well makes their (different-width) dash periods drift
  // apart and reads as a beaded trail.
  if (lineDashPattern) {
    return (
      <ShapeSource id={id} shape={shape}>
        <LineLayer
          id={`${id}-dashed-layer`}
          style={{
            lineColor: strokeColor,
            lineWidth: strokeWidth,
            lineCap: 'butt',
            lineJoin: 'round',
            lineOpacity: 0.9,
            lineDasharray: lineDashPattern,
          }}
        />
      </ShapeSource>
    );
  }

  // Solid route: soft outer shadow, white casing, then the colored line on
  // top. Layers added after the style loads already render above the basemap
  // road/trail layers, so no layerIndex or slot is needed (slots only exist in
  // the Mapbox Standard style).
  const lineWidth = Math.max(strokeWidth, 5);
  const casingWidth = lineWidth + 4;
  const shadowWidth = casingWidth + 3;

  return (
    <ShapeSource id={id} shape={shape}>
      <LineLayer
        id={`${id}-shadow-layer`}
        style={{
          lineColor: 'rgba(9, 8, 7, 0.22)',
          lineWidth: shadowWidth,
          lineCap: 'round',
          lineJoin: 'round',
          lineBlur: 1.5,
        }}
      />
      <LineLayer
        id={`${id}-casing-layer`}
        style={{
          lineColor: '#FFFFFF',
          lineWidth: casingWidth,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      <LineLayer
        id={`${id}-line-layer`}
        style={{
          lineColor: strokeColor,
          lineWidth,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </ShapeSource>
  );
}

export default MapView;

const styles = StyleSheet.create({
  map: {
    overflow: 'hidden',
  },
  marker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
});
