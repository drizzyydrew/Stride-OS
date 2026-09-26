import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  routeOfflineBounds,
  routeOfflineButtonLabel,
  routeOfflineDeleteButtonLabel,
  routeOfflinePackName,
  routeOfflinePackOptions,
  routeOfflineStatusLabel,
} from '../../src/lib/mapboxOffline';
import type { RunRoute } from '../../src/store/routeStore';

const route: RunRoute = {
  id: 'route:with/slashes',
  name: 'Pilot Butte Loop',
  folder: 'custom',
  difficulty: 'Custom',
  distanceMiles: 4,
  elevationGainFt: 240,
  estimatedMinutes: 42,
  segments: [],
  points: [
    { latitude: 44.050, longitude: -121.310 },
    { latitude: 44.060, longitude: -121.300 },
    { latitude: 44.055, longitude: -121.320 },
  ],
};

test('Mapbox Expo config plugin is registered for native builds', () => {
  const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8')) as {
    expo?: { plugins?: unknown[] };
  };
  assert.ok(appConfig.expo?.plugins?.some(plugin => plugin === '@rnmapbox/maps'));
});

test('shared native map adapter uses Mapbox instead of Apple MapKit', () => {
  const nativeMap = fs.readFileSync('src/components/maps/MapComponents.native.tsx', 'utf8');
  const training = fs.readFileSync('app/(tabs)/training/index.tsx', 'utf8');
  const routeBuilder = fs.readFileSync('app/(tabs)/training/route-builder.tsx', 'utf8');

  assert.match(nativeMap, /@rnmapbox\/maps/);
  assert.match(nativeMap, /MapboxMapView/);
  assert.match(nativeMap, /PointAnnotation/);
  assert.match(nativeMap, /ShapeSource/);
  assert.doesNotMatch(nativeMap, /react-native-maps/);
  assert.match(training, /from '..\/..\/..\/src\/components\/maps\/MapComponents'/);
  assert.match(routeBuilder, /from '..\/..\/..\/src\/components\/maps\/MapComponents'/);
});

test('route offline pack names are deterministic and filesystem-safe', () => {
  assert.equal(routeOfflinePackName(route.id), 'strideos-route-route-with-slashes');
});

test('route offline bounds use Mapbox northeast and southwest coordinate ordering', () => {
  const bounds = routeOfflineBounds(route.points, 0.01);
  assert.deepEqual(bounds, [
    [-121.29000000000001, 44.07],
    [-121.33, 44.04],
  ]);
});

test('route offline pack options carry route metadata and outdoor style defaults', () => {
  const options = routeOfflinePackOptions(route, 123);
  assert.equal(options?.name, 'strideos-route-route-with-slashes');
  assert.equal(options?.styleURL, 'mapbox://styles/mapbox/outdoors-v11');
  assert.equal(options?.minZoom, 10);
  assert.equal(options?.maxZoom, 17);
  assert.deepEqual(options?.metadata, {
    routeId: route.id,
    routeName: route.name,
    provider: 'mapbox',
    createdAt: 123,
  });
});

test('route offline labels stay explicit for the saved-route UI', () => {
  assert.equal(routeOfflineStatusLabel(undefined), 'Offline map not saved');
  assert.equal(routeOfflineStatusLabel('ready'), 'Offline map ready');
  assert.equal(routeOfflineButtonLabel('failed'), 'Retry Offline Map');
  assert.equal(routeOfflineDeleteButtonLabel('ready'), 'Delete Offline Map');
});

test('routes tab exposes offline-map deletion and saved-route deletion controls', () => {
  const training = fs.readFileSync('app/(tabs)/training/index.tsx', 'utf8');
  assert.match(training, /deleteRouteOfflinePack/);
  assert.match(training, /removeRouteOfflineMap/);
  assert.match(training, /Delete Saved Route/);
  assert.match(training, /routeOfflineDeleteButtonLabel/);
});

test('route builder keeps snap-to-path visible without exposing direct mode', () => {
  const routeBuilder = fs.readFileSync('app/(tabs)/training/route-builder.tsx', 'utf8');
  assert.match(routeBuilder, /Snap to paths/);
  assert.doesNotMatch(routeBuilder, />Direct</);
  assert.match(routeBuilder, /routeMarker/);
  assert.match(routeBuilder, /routeMarkerCore/);
  assert.match(routeBuilder, /backgroundColor: isStart \? C\.positive : isEnd \? C\.primary : C\.card/);
  assert.match(routeBuilder, /backgroundColor: '#FFFFFF'/);
  assert.match(routeBuilder, /lineDashPattern=\{snapUnresolved \? \[10, 8\] : undefined\}/);
  assert.doesNotMatch(routeBuilder, /routed\?\.provider === 'direct'/);
  assert.doesNotMatch(routeBuilder, /routeMarkerText/);
});

test('native Mapbox route lines render as solid cased lines without route-dot fallback', () => {
  const nativeMap = fs.readFileSync('src/components/maps/MapComponents.native.tsx', 'utf8');
  assert.match(nativeMap, /id=\{`\$\{id\}-border-layer`\}/);
  assert.match(nativeMap, /slot="top"/);
  assert.match(nativeMap, /layerIndex=\{998\}/);
  assert.match(nativeMap, /layerIndex=\{999\}/);
  assert.match(nativeMap, /layerIndex=\{1000\}/);
  assert.match(nativeMap, /lineColor: 'rgba\(255, 255, 255, 0\.96\)'/);
  assert.match(nativeMap, /lineColor: 'rgba\(9, 8, 7, 0\.34\)'/);
  assert.match(nativeMap, /lineOpacity: 1/);
  assert.match(nativeMap, /routeGeometryDigest/);
  assert.match(nativeMap, /id=\{`\$\{id\}-line-layer`\}/);
  assert.doesNotMatch(nativeMap, /routeDotCoordinates/);
  assert.doesNotMatch(nativeMap, /MAX_ROUTE_DOT_ANNOTATIONS/);
  assert.doesNotMatch(nativeMap, /routeDotCore/);
  assert.doesNotMatch(nativeMap, /route-dot/);
});
