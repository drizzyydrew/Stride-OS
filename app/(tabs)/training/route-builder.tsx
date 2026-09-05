// ─── Route Builder ────────────────────────────────────────────────────────────
//
// Map-first route creation: tap to drop waypoints, drag to reshape, and the
// route line snaps to runnable roads/paths/trails via OSRM's foot profile
// (see src/lib/routing.ts for the provider decision). Distance, elevation
// gain/loss, and estimated time update live. Falls back to direct lines —
// clearly labeled — whenever the router is unreachable.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, type MapViewRef } from '../../../src/components/maps/MapComponents';

import { useColors } from '../../../src/theme/useColors';
import { useThemeMode } from '../../../src/store/themeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useRouteStore, routeDistanceMiles, type RoutePoint, type RunRoute, type RouteSurface } from '../../../src/store/routeStore';
import {
  buildDirectPath, fetchRouteElevation, snapRouteToPaths, TANGENTS_EDUCATION_COPY,
  type ElevationSummary, type RoutedPath,
} from '../../../src/lib/routing';
import {
  buildGeneratedRouteWaypoints,
  type GeneratedRouteElevationIntent,
  type GeneratedRouteHillIntent,
  type GeneratedRouteShape,
} from '../../../src/utils/routeGeneration';
import { estimateEasyPaceSecPerMi } from '../../../src/utils/hydrationEngine';
import { DEFAULT_MAP_REGION, MAP_STYLE_DARK, MAP_STYLE_LIGHT, regionForPoints } from '../../../src/constants/mapStyles';

const FOLDERS: { key: RunRoute['folder']; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'tempo', label: 'Tempo' },
  { key: 'long', label: 'Long Run' },
  { key: 'custom', label: 'Custom' },
];

type PlaceSearchResult = {
  id: string;
  label: string;
  subtitle: string;
  point: RoutePoint;
};

type AutoAnchorMode = 'current' | 'to_place' | 'from_place' | 'around_place';

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function RouteBuilderScreen() {
  const C = useColors();
  const mode = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const weeklyMileage = useAthleteStore(s => s.weeklyMileage);
  const addRoute = useRouteStore(s => s.addRoute);

  const [waypoints, setWaypoints] = useState<RoutePoint[]>([]);
  const [routed, setRouted] = useState<RoutedPath | null>(null);
  const [elevation, setElevation] = useState<ElevationSummary | null>(null);
  const [routingBusy, setRoutingBusy] = useState(false);
  const [snapFailed, setSnapFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showSave, setShowSave] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeFolder, setRouteFolder] = useState<RunRoute['folder']>('custom');
  const [routeSurfaceType, setRouteSurfaceType] = useState<RunRoute['surfaceType']>('unknown');
  const [routeNotes, setRouteNotes] = useState('');
  const [autoRouteOpen, setAutoRouteOpen] = useState(false);
  const [autoDistanceInput, setAutoDistanceInput] = useState('5');
  const [autoSurface, setAutoSurface] = useState<Exclude<RouteSurface, 'unknown'>>('mixed');
  const [autoHills, setAutoHills] = useState<GeneratedRouteHillIntent>('rolling');
  const [autoElevation, setAutoElevation] = useState<GeneratedRouteElevationIntent>('moderate');
  const [autoShape, setAutoShape] = useState<GeneratedRouteShape>('loop');
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);
  const [autoAnchorMode, setAutoAnchorMode] = useState<AutoAnchorMode>('current');
  const requestIdRef = useRef(0);
  const mapRef = useRef<MapViewRef>(null);
  const routeNameInputRef = useRef<TextInput>(null);
  const routeNotesInputRef = useRef<TextInput>(null);

  const snapUnresolved = snapEnabled && snapFailed && waypoints.length >= 2 && !routingBusy;
  const geometry = routed?.geometry ?? waypoints;
  const distanceMeters = routed?.distanceMeters ?? routeDistanceMiles(waypoints) * 1609.344;
  const distanceMiles = distanceMeters / 1609.344;
  const distDisplay = imp ? distanceMiles : distanceMiles * 1.609344;
  const distUnit = imp ? 'mi' : 'km';
  const easyPaceSecPerMi = estimateEasyPaceSecPerMi(weeklyMileage || 15);
  const estimatedMin = distanceMiles > 0 ? Math.round((distanceMiles * easyPaceSecPerMi) / 60) : 0;
  const gainDisplay = elevation ? Math.round(imp ? elevation.gainMeters * 3.28084 : elevation.gainMeters) : null;
  const lossDisplay = elevation ? Math.round(imp ? elevation.lossMeters * 3.28084 : elevation.lossMeters) : null;
  const elevUnit = imp ? 'ft' : 'm';
  const canSave = waypoints.length >= 2 && !routingBusy && (routed !== null) && !(snapEnabled && snapFailed);

  // Re-route + re-fetch elevation whenever the control points change.
  // Debounced, and guarded with a request id so a stale response can never
  // overwrite a newer route. Snap failure is a first-class state — the
  // athlete sees an error and can retry or explicitly switch to Direct;
  // there is no silent straight-line substitution.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (waypoints.length < 2) {
      setRouted(null);
      setElevation(null);
      setRoutingBusy(false);
      setSnapFailed(false);
      return;
    }

    setRoutingBusy(true);
    const timer = setTimeout(async () => {
      const path = snapEnabled ? await snapRouteToPaths(waypoints) : buildDirectPath(waypoints);
      if (requestId !== requestIdRef.current) return;
      setRouted(path);
      setSnapFailed(snapEnabled && path === null);
      setRoutingBusy(false);

      if (path) {
        const elev = await fetchRouteElevation(path.geometry);
        if (requestId !== requestIdRef.current) return;
        setElevation(elev);
      } else {
        setElevation(null);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [waypoints, snapEnabled, retryNonce]);

  function addWaypoint(point: RoutePoint) {
    setWaypoints(prev => [...prev, point]);
  }

  function moveWaypoint(index: number, point: RoutePoint) {
    setWaypoints(prev => prev.map((p, i) => (i === index ? point : p)));
  }

  function removeWaypoint(index: number) {
    const label = index === 0 ? 'the start point' : `point ${index + 1}`;
    Alert.alert('Remove point', `Delete ${label} from this route?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setWaypoints(prev => prev.filter((_, i) => i !== index)),
      },
    ]);
  }

  function undo() {
    setWaypoints(prev => prev.slice(0, -1));
  }

  function fitToRoute() {
    if (geometry.length < 2) return;
    mapRef.current?.animateToRegion(regionForPoints(geometry), 350);
  }

  // Runner shortcuts: mirror the waypoints back to the start (out & back), or
  // route back to the start point (close loop).
  function makeOutAndBack() {
    setWaypoints(prev => {
      if (prev.length < 2) return prev;
      const mirrored = [...prev.slice(0, -1)].reverse();
      return [...prev, ...mirrored];
    });
  }

  function closeLoop() {
    setWaypoints(prev => (prev.length < 2 ? prev : [...prev, prev[0]]));
  }

  function clearAll() {
    if (waypoints.length === 0) return;
    Alert.alert('Clear route', 'Remove all waypoints and start over?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setWaypoints([]) },
    ]);
  }

  async function addCurrentLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Allow location to add your current position as a route point.');
      return;
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const point = { latitude: location.coords.latitude, longitude: location.coords.longitude };
    addWaypoint(point);
    mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }

  async function currentRoutePoint(): Promise<RoutePoint | null> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Allow location to use your current position for route creation.');
      return null;
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: location.coords.latitude, longitude: location.coords.longitude };
  }

  function placeResultLabel(query: string, index: number, address?: Location.LocationGeocodedAddress | null): Pick<PlaceSearchResult, 'label' | 'subtitle'> {
    const compactQuery = query.trim();
    const labelParts = [
      address?.name,
      address?.street,
      address?.city,
    ].filter(Boolean);
    const label = labelParts.length > 0 ? labelParts.join(', ') : compactQuery || `Search result ${index + 1}`;
    const subtitleParts = [
      address?.city,
      address?.region,
      address?.country,
    ].filter(Boolean);
    return {
      label,
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(', ') : 'Tap to use this location',
    };
  }

  async function searchPlaces() {
    const query = placeQuery.trim();
    if (query.length < 2) {
      Alert.alert('Search a place', 'Enter a park, trailhead, address, or landmark.');
      return;
    }

    setPlaceSearching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Allow location to search for places and route from them.');
        return;
      }
      const geocoded = await Location.geocodeAsync(query);
      if (geocoded.length === 0) {
        setPlaceResults([]);
        Alert.alert('No place found', 'Try a more specific place name or address.');
        return;
      }

      const results = await Promise.all(geocoded.slice(0, 4).map(async (result, index) => {
        const point = { latitude: result.latitude, longitude: result.longitude };
        let address: Location.LocationGeocodedAddress | null = null;
        try {
          const reverse = await Location.reverseGeocodeAsync(point);
          address = reverse[0] ?? null;
        } catch {
          address = null;
        }
        const label = placeResultLabel(query, index, address);
        return {
          id: `${result.latitude.toFixed(5)}:${result.longitude.toFixed(5)}:${index}`,
          ...label,
          point,
        };
      }));

      setPlaceResults(results);
      setSelectedPlace(results[0] ?? null);
      mapRef.current?.animateToRegion({ ...results[0].point, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 400);
    } catch (error) {
      Alert.alert('Search failed', error instanceof Error ? error.message : 'Could not search for that location.');
    } finally {
      setPlaceSearching(false);
    }
  }

  function saveRoute() {
    if (!canSave) return;
    const name = routeName.trim() || 'Custom Route';
    const gainFt = elevation ? Math.round(elevation.gainMeters * 3.28084) : Math.round(distanceMiles * 48);
    const id = addRoute({
      name,
      folder: routeFolder,
      difficulty: 'Custom',
      distanceMiles,
      elevationGainFt: gainFt,
      elevationProfileFt: elevation ? elevation.profileM.map(m => Math.round(m * 3.28084)) : undefined,
      estimatedMinutes: Math.max(1, estimatedMin),
      segments: [],
      points: geometry,
      waypoints,
      distanceMeters: Math.round(distanceMeters),
      elevationGainMeters: elevation?.gainMeters,
      elevationLossMeters: elevation?.lossMeters,
      estimatedDurationMin: Math.max(1, estimatedMin),
      surfaceType: routeSurfaceType,
      routingProvider: routed?.provider ?? 'direct',
      notes: routeNotes.trim() || undefined,
    });
    setShowSave(false);
    router.replace({ pathname: '/(tabs)/training/route-detail', params: { routeId: id } } as never);
  }

  const mapStyle = mode === 'light' ? MAP_STYLE_LIGHT : MAP_STYLE_DARK;
  const lineColor = C.positive;
  const panelBg = mode === 'light' ? C.card : C.cardElevated;

  const providerLabel = waypoints.length < 2
    ? 'Tap the map to set your start point'
    : routingBusy
      ? 'Routing…'
      : routed?.provider === 'osrm_foot'
        ? 'Snapped to roads & paths · OpenStreetMap'
        : routed?.provider === 'osrm_road'
          ? 'Snapped to roads · trail data unavailable'
          : snapEnabled
            ? 'Snap failed — retry or switch to Direct'
            : 'Direct lines (manual mode)';

  const statCells = useMemo(() => ([
    { label: 'ELEV GAIN', value: gainDisplay !== null ? `+${gainDisplay}` : '—', unit: gainDisplay !== null ? elevUnit : '' },
    { label: 'ELEV LOSS', value: lossDisplay !== null ? `−${lossDisplay}` : '—', unit: lossDisplay !== null ? elevUnit : '' },
    { label: 'EST TIME', value: estimatedMin > 0 ? fmtDuration(estimatedMin) : '—', unit: '' },
    { label: 'POINTS', value: String(waypoints.length), unit: '' },
  ]), [gainDisplay, lossDisplay, elevUnit, estimatedMin, waypoints.length]);

  async function generateAutoRoute() {
    const targetMiles = Number(autoDistanceInput.replace(',', '.'));
    if (!Number.isFinite(targetMiles) || targetMiles <= 0) {
      Alert.alert('Route distance needed', 'Enter a target distance like 3, 5, or 7 miles.');
      return;
    }

    setAutoGenerating(true);
    try {
      const placeRequired = autoAnchorMode !== 'current';
      if (placeRequired && !selectedPlace) {
        Alert.alert('Choose a place', 'Search for a location first, then choose whether to run to it, from it, or around it.');
        return;
      }

      if (autoAnchorMode === 'to_place' && selectedPlace) {
        const current = await currentRoutePoint();
        if (!current) return;
        const waypointsForPlace = [current, selectedPlace.point];
        setSnapEnabled(true);
        setWaypoints(waypointsForPlace);
        setRouteName(`Run to ${selectedPlace.label}`);
        setRouteNotes(`Auto-created destination route to ${selectedPlace.label}. Snapping and elevation are resolved after generation.`);
        setRouteSurfaceType(autoSurface);
        setRouteFolder(targetMiles >= 8 ? 'long' : autoHills === 'hilly' ? 'tempo' : 'easy');
        setAutoRouteOpen(false);
        mapRef.current?.animateToRegion(regionForPoints(waypointsForPlace), 400);
        return;
      }

      const start = selectedPlace && autoAnchorMode !== 'current'
        ? selectedPlace.point
        : await currentRoutePoint();
      if (!start) return;

      const generated = buildGeneratedRouteWaypoints({
        start,
        distanceMiles: targetMiles,
        surface: autoSurface,
        hills: autoHills,
        elevation: autoElevation,
        shape: autoShape,
        seed: Math.round(Date.now() / 1000),
      });
      setSnapEnabled(true);
      setWaypoints(generated.waypoints);
      const placePrefix = selectedPlace && autoAnchorMode !== 'current'
        ? `${autoAnchorMode === 'around_place' ? 'Around' : 'From'} ${selectedPlace.label}`
        : generated.name;
      setRouteName(placePrefix);
      setRouteNotes(selectedPlace && autoAnchorMode !== 'current'
        ? `${generated.notes} Anchor location: ${selectedPlace.label}.`
        : generated.notes);
      setRouteSurfaceType(autoSurface);
      setRouteFolder(targetMiles >= 8 ? 'long' : autoHills === 'hilly' ? 'tempo' : 'easy');
      setAutoRouteOpen(false);
      mapRef.current?.animateToRegion(regionForPoints(generated.waypoints), 400);
    } catch (error) {
      Alert.alert('Could not create route', error instanceof Error ? error.message : 'Route generation failed. Try again near your start point.');
    } finally {
      setAutoGenerating(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Map */}
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={DEFAULT_MAP_REGION}
          customMapStyle={mapStyle}
          showsUserLocation
          onPress={event => addWaypoint(event.nativeEvent.coordinate)}
        >
          {geometry.length > 1 ? (
            <Polyline
              coordinates={geometry}
              strokeColor={snapUnresolved ? C.textMuted : lineColor}
              strokeWidth={snapUnresolved ? 3 : 4}
              lineDashPattern={snapUnresolved || (!snapEnabled && routed?.provider === 'direct') ? [10, 8] : undefined}
            />
          ) : null}
          {waypoints.map((point, index) => {
            const isStart = index === 0;
            const isEnd = index === waypoints.length - 1 && waypoints.length > 1;
            return (
              <Marker
                key={`wp-${index}`}
                coordinate={point}
                draggable
                onDragEnd={event => moveWaypoint(index, event.nativeEvent.coordinate)}
                onCalloutPress={() => removeWaypoint(index)}
                title={isStart ? 'Start' : isEnd ? 'Finish' : `Point ${index + 1}`}
                description="Drag to move · tap this bubble to delete"
                pinColor={isStart ? C.positive : isEnd ? C.critical : undefined}
                anchor={{ x: 0.5, y: 1 }}
              />
            );
          })}
        </MapView>

        {/* Header overlay */}
        <View style={[s.headerOverlay, { top: insets.top + 6 }]}>
          <TouchableOpacity
            style={[s.roundBtn, { backgroundColor: panelBg, borderColor: C.border }]}
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={19} color={C.text} />
          </TouchableOpacity>
          <View style={[s.headerPill, { backgroundColor: panelBg, borderColor: C.border }]}>
            <Text style={[s.headerPillText, { color: C.text }]}>Route Builder</Text>
          </View>
          <TouchableOpacity
            style={[s.roundBtn, { backgroundColor: panelBg, borderColor: C.border }]}
            onPress={() => setShowInfo(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="About route distance"
          >
            <Ionicons name="information-circle-outline" size={20} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Snap toggle */}
        <View style={[s.snapToggle, { top: insets.top + 58, backgroundColor: panelBg, borderColor: C.border }]}>
          {([true, false] as const).map(value => (
            <TouchableOpacity
              key={String(value)}
              style={[s.snapOption, snapEnabled === value && { backgroundColor: C.primaryDim }]}
              onPress={() => setSnapEnabled(value)}
              activeOpacity={0.8}
            >
              <Text style={[s.snapOptionText, { color: snapEnabled === value ? C.primary : C.textMuted }]}>
                {value ? 'Snap to paths' : 'Direct'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Route helpers */}
        {waypoints.length >= 2 ? (
          <View style={[s.helperStack, { bottom: snapUnresolved ? 64 : 12 }]}>
            <TouchableOpacity
              style={[s.helperChip, { backgroundColor: panelBg, borderColor: C.border }]}
              onPress={makeOutAndBack}
              activeOpacity={0.85}
            >
              <Ionicons name="swap-horizontal-outline" size={13} color={C.text} />
              <Text style={[s.helperChipText, { color: C.text }]}>Out & Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.helperChip, { backgroundColor: panelBg, borderColor: C.border }]}
              onPress={closeLoop}
              activeOpacity={0.85}
            >
              <Ionicons name="sync-outline" size={13} color={C.text} />
              <Text style={[s.helperChipText, { color: C.text }]}>Close Loop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.helperChip, { backgroundColor: panelBg, borderColor: C.border }]}
              onPress={fitToRoute}
              activeOpacity={0.85}
              accessibilityLabel="Fit map to route"
            >
              <Ionicons name="scan-outline" size={13} color={C.text} />
              <Text style={[s.helperChipText, { color: C.text }]}>Fit</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {snapUnresolved ? (
          <View style={[s.fallbackBanner, { backgroundColor: C.criticalDim ?? C.cardAlt, borderColor: C.critical }]}>
            <Ionicons name="cloud-offline-outline" size={14} color={C.critical} />
            <Text style={[s.fallbackText, { color: C.critical }]}>
              Couldn't snap to roads or paths. This is not a valid route yet.
            </Text>
            <TouchableOpacity
              style={[s.retryBtn, { backgroundColor: C.critical }]}
              onPress={() => setRetryNonce(n => n + 1)}
              activeOpacity={0.85}
            >
              <Text style={[s.retryBtnText, { color: '#FFFFFF' }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Stats + controls sheet */}
      <View style={[s.sheet, { backgroundColor: panelBg, borderTopColor: C.border, paddingBottom: insets.bottom + 12 }]}>
        <View style={s.sheetHeadRow}>
          <View>
            <Text style={[s.distanceValue, { color: C.text }]}>
              {distDisplay.toFixed(2)}
              <Text style={[s.distanceUnit, { color: C.textMuted }]}> {distUnit}</Text>
            </Text>
            <View style={s.providerRow}>
              {routingBusy ? <ActivityIndicator size="small" color={C.primary} /> : null}
              <Text style={[s.providerText, { color: C.textDim }]}>{providerLabel}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.locateBtn, { backgroundColor: C.cardAlt, borderColor: C.border }]}
            onPress={addCurrentLocation}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add my location as a point"
          >
            <Ionicons name="locate-outline" size={16} color={C.text} />
            <Text style={[s.locateText, { color: C.text }]}>Add Point</Text>
          </TouchableOpacity>
        </View>

        <View style={s.statRow}>
          {statCells.map(cell => (
            <View key={cell.label} style={[s.statCell, { backgroundColor: C.cardAlt }]}>
              <Text style={[s.statLabel, { color: C.textDim }]}>{cell.label}</Text>
              <Text style={[s.statValue, { color: C.text }]}>
                {cell.value}
                {cell.unit ? <Text style={[s.statUnit, { color: C.textMuted }]}> {cell.unit}</Text> : null}
              </Text>
            </View>
          ))}
        </View>

        <View style={[s.autoCard, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
          <TouchableOpacity
            style={s.autoHeader}
            onPress={() => setAutoRouteOpen(open => !open)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Auto create route from filters"
          >
            <View style={s.autoTitleRow}>
              <Ionicons name="sparkles-outline" size={16} color={C.positive} />
              <Text style={[s.autoTitle, { color: C.text }]}>Auto Create Route</Text>
            </View>
            <Ionicons name={autoRouteOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.textMuted} />
          </TouchableOpacity>
          {autoRouteOpen ? (
            <View style={s.autoBody}>
              <View style={s.autoDistanceRow}>
                <Text style={[s.autoLabel, { color: C.textDim }]}>MILEAGE</Text>
                <TextInput
                  value={autoDistanceInput}
                  onChangeText={setAutoDistanceInput}
                  keyboardType="decimal-pad"
                  placeholder="5"
                  placeholderTextColor={C.textDim}
                  selectionColor={C.primary}
                  style={[s.autoInput, { color: C.text, borderColor: C.border, backgroundColor: C.card }]}
                />
              </View>
              <FilterRow
                label="START"
                items={[
                  { value: 'current' as const, label: 'Current' },
                  { value: 'to_place' as const, label: 'Run to place' },
                  { value: 'from_place' as const, label: 'From place' },
                  { value: 'around_place' as const, label: 'Around place' },
                ]}
                value={autoAnchorMode}
                onChange={setAutoAnchorMode}
              />
              <View style={s.placeSearchBlock}>
                <Text style={[s.autoLabel, { color: C.textDim }]}>LOCATION SEARCH</Text>
                <View style={s.placeSearchRow}>
                  <TextInput
                    value={placeQuery}
                    onChangeText={setPlaceQuery}
                    onSubmitEditing={searchPlaces}
                    returnKeyType="search"
                    placeholder="Park, trailhead, address..."
                    placeholderTextColor={C.textDim}
                    selectionColor={C.primary}
                    style={[s.placeSearchInput, { color: C.text, borderColor: C.border, backgroundColor: C.card }]}
                  />
                  <TouchableOpacity
                    style={[s.placeSearchBtn, { backgroundColor: C.primary, opacity: placeSearching ? 0.7 : 1 }]}
                    onPress={searchPlaces}
                    disabled={placeSearching}
                    activeOpacity={0.86}
                    accessibilityRole="button"
                    accessibilityLabel="Search route locations"
                  >
                    {placeSearching ? <ActivityIndicator size="small" color={C.onPrimary} /> : <Ionicons name="search-outline" size={16} color={C.onPrimary} />}
                  </TouchableOpacity>
                </View>
                {selectedPlace ? (
                  <Text style={[s.selectedPlaceText, { color: C.positive }]}>Selected: {selectedPlace.label}</Text>
                ) : (
                  <Text style={[s.autoHint, { color: C.textDim }]}>
                    Search to generate a route to, from, or around a selected location.
                  </Text>
                )}
                {placeResults.length > 0 ? (
                  <View style={s.placeResults}>
                    {placeResults.map(result => {
                      const selected = selectedPlace?.id === result.id;
                      return (
                        <TouchableOpacity
                          key={result.id}
                          style={[
                            s.placeResult,
                            {
                              backgroundColor: selected ? C.primaryDim : C.card,
                              borderColor: selected ? C.primary : C.border,
                            },
                          ]}
                          onPress={() => {
                            setSelectedPlace(result);
                            mapRef.current?.animateToRegion({ ...result.point, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 350);
                          }}
                          activeOpacity={0.84}
                        >
                          <Ionicons name={selected ? 'radio-button-on' : 'location-outline'} size={16} color={selected ? C.primary : C.textMuted} />
                          <View style={s.placeResultTextWrap}>
                            <Text style={[s.placeResultTitle, { color: selected ? C.primary : C.text }]} numberOfLines={1}>{result.label}</Text>
                            <Text style={[s.placeResultSubtitle, { color: C.textDim }]} numberOfLines={1}>{result.subtitle}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
              <FilterRow
                label="SURFACE"
                items={[
                  { value: 'mixed' as const, label: 'Mixed' },
                  { value: 'road' as const, label: 'Road' },
                  { value: 'trail' as const, label: 'Trail' },
                ]}
                value={autoSurface}
                onChange={setAutoSurface}
              />
              <FilterRow
                label="HILLS"
                items={[
                  { value: 'flat' as const, label: 'Flat' },
                  { value: 'rolling' as const, label: 'Rolling' },
                  { value: 'hilly' as const, label: 'Hilly' },
                ]}
                value={autoHills}
                onChange={setAutoHills}
              />
              <FilterRow
                label="ELEVATION"
                items={[
                  { value: 'low' as const, label: 'Low' },
                  { value: 'moderate' as const, label: 'Moderate' },
                  { value: 'high' as const, label: 'High' },
                ]}
                value={autoElevation}
                onChange={setAutoElevation}
              />
              <FilterRow
                label="SHAPE"
                items={[
                  { value: 'loop' as const, label: 'Loop' },
                  { value: 'out_and_back' as const, label: 'Out & Back' },
                ]}
                value={autoShape}
                onChange={setAutoShape}
              />
              <TouchableOpacity
                style={[s.generateBtn, { backgroundColor: C.positive, opacity: autoGenerating ? 0.7 : 1 }]}
                onPress={generateAutoRoute}
                disabled={autoGenerating}
                activeOpacity={0.86}
              >
                {autoGenerating ? <ActivityIndicator size="small" color="#0E0E0F" /> : <Ionicons name="shuffle-outline" size={16} color="#0E0E0F" />}
                <Text style={[s.generateBtnText, { color: '#0E0E0F' }]}>
                  {autoGenerating ? 'Creating Route' : 'Generate From Filters'}
                </Text>
              </TouchableOpacity>
              <Text style={[s.autoHint, { color: C.textDim }]}>
                Generated waypoints are snapped to paths next; review the final distance and elevation before saving.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.secondaryBtn, { backgroundColor: C.cardAlt, borderColor: C.border, opacity: waypoints.length ? 1 : 0.45 }]}
            onPress={undo}
            disabled={!waypoints.length}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-undo-outline" size={15} color={C.text} />
            <Text style={[s.secondaryBtnText, { color: C.text }]}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.secondaryBtn, { backgroundColor: C.cardAlt, borderColor: C.border, opacity: waypoints.length ? 1 : 0.45 }]}
            onPress={clearAll}
            disabled={!waypoints.length}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={15} color={C.text} />
            <Text style={[s.secondaryBtnText, { color: C.text }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: C.primary, opacity: canSave ? 1 : 0.45 }]}
            onPress={() => setShowSave(true)}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Ionicons name="bookmark-outline" size={16} color={C.onPrimary} />
            <Text style={[s.primaryBtnText, { color: C.onPrimary }]}>Save Route</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Save modal */}
      <Modal
        visible={showSave}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSave(false)}
        onShow={() => requestAnimationFrame(() => routeNameInputRef.current?.focus())}
      >
        <KeyboardAvoidingView style={s.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 12 }]}>
            <Text style={[s.modalTitle, { color: C.text }]}>Save Route</Text>
            <Text style={[s.modalMeta, { color: C.textMuted }]}>
              {distDisplay.toFixed(2)} {distUnit}
              {gainDisplay !== null ? ` · +${gainDisplay} ${elevUnit}` : ''} · ~{fmtDuration(Math.max(1, estimatedMin))} easy
            </Text>
            <ScrollView
              style={s.modalBody}
              contentContainerStyle={s.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <TextInput
              ref={routeNameInputRef}
              value={routeName}
              onChangeText={setRouteName}
              placeholder="Route name (defaults to Custom Route)"
              placeholderTextColor={C.textDim}
              selectionColor={C.primary}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => routeNotesInputRef.current?.focus()}
              style={[s.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <View style={s.folderRow}>
              {FOLDERS.map(folder => (
                <TouchableOpacity
                  key={folder.key}
                  style={[
                    s.folderChip,
                    {
                      backgroundColor: routeFolder === folder.key ? C.primaryDim : C.cardAlt,
                      borderColor: routeFolder === folder.key ? C.primary : 'transparent',
                    },
                  ]}
                  onPress={() => setRouteFolder(folder.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.folderChipText, { color: routeFolder === folder.key ? C.primary : C.textMuted }]}>
                    {folder.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              ref={routeNotesInputRef}
              value={routeNotes}
              onChangeText={setRouteNotes}
              placeholder="Notes (parking, water stops, surface...)"
              placeholderTextColor={C.textDim}
              selectionColor={C.primary}
              multiline
              style={[s.input, s.notesInput, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            </ScrollView>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.secondaryBtn, { flex: 1, backgroundColor: C.cardAlt, borderColor: C.border }]}
                onPress={() => setShowSave(false)}
                activeOpacity={0.8}
              >
                <Text style={[s.secondaryBtnText, { color: C.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, { flex: 1.4, backgroundColor: C.primary }]}
                onPress={saveRoute}
                activeOpacity={0.85}
              >
                <Text style={[s.primaryBtnText, { color: C.onPrimary }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Education modal */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowInfo(false)}>
          <View
            style={[s.infoCard, { backgroundColor: C.card, borderColor: C.border }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[s.infoEyebrow, { color: C.primary }]}>PLANNED VS WATCH DISTANCE</Text>
            <Text style={[s.infoBody, { color: C.textMuted }]}>{TANGENTS_EDUCATION_COPY}</Text>
            <Text style={[s.infoBody, { color: C.textMuted, marginTop: 8 }]}>
              Racing tip: certified courses are measured along the tangents — the straightest legal line
              through every curve. Running wide on turns is free extra distance; hugging the tangents is not
              cheating, it is how the course was measured.
            </Text>
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: C.primary, marginTop: 14 }]}
              onPress={() => setShowInfo(false)}
              activeOpacity={0.85}
            >
              <Text style={[s.primaryBtnText, { color: C.onPrimary }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  headerOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerPillText: { fontSize: 13, fontWeight: '800' },
  snapToggle: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  snapOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  snapOptionText: { fontSize: 11, fontWeight: '800' },
  helperStack: {
    position: 'absolute',
    right: 14,
    gap: 6,
    alignItems: 'flex-end',
  },
  helperChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  helperChipText: { fontSize: 11, fontWeight: '800' },
  fallbackBanner: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fallbackText: { fontSize: 11, fontWeight: '700', flex: 1 },
  retryBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  retryBtnText: { fontSize: 11, fontWeight: '800' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    marginTop: -18,
    paddingTop: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  sheetHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  distanceValue: { fontSize: 40, fontWeight: '900', lineHeight: 44, fontVariant: ['tabular-nums'] },
  distanceUnit: { fontSize: 16, fontWeight: '700' },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  providerText: { fontSize: 11, fontWeight: '600' },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  locateText: { fontSize: 12, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 8 },
  statCell: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 10, fontWeight: '600' },
  autoCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  autoHeader: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoTitle: { fontSize: 13, fontWeight: '900' },
  autoBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  autoDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  autoLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  autoInput: {
    width: 88,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  placeSearchBlock: { gap: 8 },
  placeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeSearchInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  placeSearchBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPlaceText: { fontSize: 11, fontWeight: '800' },
  placeResults: { gap: 7 },
  placeResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  placeResultTextWrap: { flex: 1, minWidth: 0 },
  placeResultTitle: { fontSize: 12, fontWeight: '900' },
  placeResultSubtitle: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  filterBlock: { gap: 7 },
  filterRow: { gap: 7, paddingRight: 4 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filterChipText: { fontSize: 11, fontWeight: '800' },
  generateBtn: {
    minHeight: 43,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 2,
  },
  generateBtnText: { fontSize: 13, fontWeight: '900' },
  autoHint: { fontSize: 10, fontWeight: '700', lineHeight: 14 },
  actionRow: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '800' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryBtnText: { fontSize: 13, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: { flex: 1 },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
    maxHeight: '92%',
  },
  modalBody: { flexShrink: 1 },
  modalBodyContent: { gap: 12, paddingBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalMeta: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: { minHeight: 70, textAlignVertical: 'top' },
  folderRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  folderChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  folderChipText: { fontSize: 11, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  infoCard: {
    marginHorizontal: 24,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  infoEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  infoBody: { fontSize: 13, lineHeight: 20 },
});

function FilterRow<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const C = useColors();
  return (
    <View style={s.filterBlock}>
      <Text style={[s.autoLabel, { color: C.textDim }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {items.map(item => {
          const selected = item.value === value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[
                s.filterChip,
                {
                  backgroundColor: selected ? C.primaryDim : C.card,
                  borderColor: selected ? C.primary : C.border,
                },
              ]}
              onPress={() => onChange(item.value)}
              activeOpacity={0.82}
            >
              <Text style={[s.filterChipText, { color: selected ? C.primary : C.textMuted }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
