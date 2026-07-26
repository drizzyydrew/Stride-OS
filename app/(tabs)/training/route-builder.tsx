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
import { useRouteStore, routeDistanceMiles, type RoutePoint, type RunRoute } from '../../../src/store/routeStore';
import {
  buildDirectPath, fetchRouteElevation, snapRouteToPaths, TANGENTS_EDUCATION_COPY,
  type ElevationSummary, type RoutedPath,
} from '../../../src/lib/routing';
import { estimateEasyPaceSecPerMi } from '../../../src/utils/hydrationEngine';
import { DEFAULT_MAP_REGION, MAP_STYLE_DARK, MAP_STYLE_LIGHT, regionForPoints } from '../../../src/constants/mapStyles';

const FOLDERS: { key: RunRoute['folder']; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'tempo', label: 'Tempo' },
  { key: 'long', label: 'Long Run' },
  { key: 'custom', label: 'Custom' },
];

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
  const [routeNotes, setRouteNotes] = useState('');
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
      surfaceType: 'unknown',
      routingProvider: routed?.provider ?? 'direct',
      notes: routeNotes.trim() || undefined,
    });
    setShowSave(false);
    router.replace({ pathname: '/(tabs)/training/route-detail', params: { routeId: id } } as never);
  }

  const mapStyle = mode === 'light' ? MAP_STYLE_LIGHT : MAP_STYLE_DARK;
  const lineColor = C.chartSeriesPrimary;
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
