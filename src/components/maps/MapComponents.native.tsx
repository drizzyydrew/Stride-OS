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

function coordinateKey(point: LatLng | undefined): string {
  if (!point) return 'none';
  return `${point.latitude.toFixed(5)}-${point.longitude.toFixed(5)}`;
}

function routeGeometryDigest(coordinates: LatLng[]): string {
  const first = coordinates[0];
  const middle = coordinates[Math.floor(coordinates.length / 2)];
  const last = coordinates[coordinates.length - 1];
  return layerSafeId(`${coordinates.length}-${coordinateKey(first)}-${coordinateKey(middle)}-${coordinateKey(last)}`);
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
  const idRef = useRef<string | null>(null);
  if (!idRef.current) idRef.current = `polyline-${Math.random().toString(36).slice(2)}`;
  const shape = useMemo(() => lineFeature(coordinates), [coordinates]);
  if (coordinates.length < 2) return null;
  const id = layerSafeId(`${idRef.current}-${routeGeometryDigest(coordinates)}-${strokeColor}-${strokeWidth}-${lineDashPattern?.join('-') ?? 'solid'}`);
  const borderWidth = Math.max(strokeWidth + 5, 8);
  const visibleLineWidth = Math.max(strokeWidth, 6);
  const lineDashStyle = lineDashPattern ? { lineDasharray: lineDashPattern } : null;

  return (
    <ShapeSource id={id} shape={shape}>
      <LineLayer
        id={`${id}-border-layer`}
        layerIndex={998}
        slot="top"
        style={{
          lineColor: 'rgba(255, 255, 255, 0.96)',
          lineWidth: borderWidth,
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 1,
          ...lineDashStyle,
        }}
      />
      <LineLayer
        id={`${id}-shadow-layer`}
        layerIndex={999}
        slot="top"
        style={{
          lineColor: 'rgba(9, 8, 7, 0.34)',
          lineWidth: Math.max(visibleLineWidth + 2, 8),
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 1,
          ...lineDashStyle,
        }}
      />
      <LineLayer
        id={`${id}-line-layer`}
        layerIndex={1000}
        slot="top"
        style={{
          lineColor: strokeColor,
          lineWidth: visibleLineWidth,
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 1,
          ...lineDashStyle,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
});
