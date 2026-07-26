import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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

const MapView = forwardRef<MapViewRef, MapViewProps>(({ children, style }, ref) => {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
  }), []);

  return <View style={[styles.webMapFallback, style]}>{children}</View>;
});

MapView.displayName = 'MapViewFallback';

export function Marker(_props: MarkerProps) {
  return null;
}

export function Polyline(_props: PolylineProps) {
  return null;
}

export default MapView;

const styles = StyleSheet.create({
  webMapFallback: {
    backgroundColor: '#101820',
  },
});
