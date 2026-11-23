import { LegacyBackControl } from '../../../src/components/layout/NavigationEscape';
// ─── Route Detail ─────────────────────────────────────────────────────────────
//
// Saved-route view: map preview, distance / elevation / estimated time,
// elevation profile when real data exists, editable name + notes, Use Route
// (selects it for the next tracked run), delete, and the planned-vs-watch
// distance education card.

import { useMemo, useRef, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { usePageSafeAreaInsets as useSafeAreaInsets } from '../../../src/components/layout/PageSafeAreaView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from '../../../src/components/maps/MapComponents';

import { useColors } from '../../../src/theme/useColors';
import { useThemeMode } from '../../../src/store/themeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../../src/lib/localDataOwner';
import { legacyRouteSections, routeGeometryMeters, routeSectionLine, routeSectionSummary, routeSectionTarget } from '../../../src/utils/routeSections';
import { effectiveAttachedRoute, useRouteStore } from '../../../src/store/routeStore';
import { TANGENTS_EDUCATION_COPY } from '../../../src/lib/routing';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT, regionForPoints } from '../../../src/constants/mapStyles';
import { LAYOUT } from '../../../src/constants/layout';

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function RouteDetailScreen() {
  const C = useColors();
  const mode = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ownerLease=useRef(captureOwnerLease());
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';

  const route = useRouteStore(s => s.routes.find(r => r.id === routeId) ?? null);
  const updateRoute = useRouteStore(s => s.updateRoute);
  const removeRoute = useRouteStore(s => s.removeRoute);
  const attachment = useRouteStore(s => s.routeAttachment);
  const attachRoute = useRouteStore(s => s.attachRoute);
  const detachRouteFromToday = useRouteStore(s => s.detachRouteFromToday);
  const reverseAttachedRoute = useRouteStore(s => s.reverseAttachedRoute);
  const isAttached = attachment.status === 'attached' && attachment.routeId === routeId;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const region = useMemo(() => regionForPoints(route?.points ?? []), [route?.points]);

  if (!route) {
    return (
      <View style={[st.missingWrap, { backgroundColor: C.bg, paddingTop: insets.top + 20 }]}>
        <Text style={{ color: C.textMuted, fontSize: 14 }}>This route no longer exists.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: C.primary, fontWeight: '800' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const distDisplay = imp ? route.distanceMiles : route.distanceMiles * 1.609344;
  const distUnit = imp ? 'mi' : 'km';
  const gainFt = route.elevationGainFt;
  const gainDisplay = Math.round(imp ? gainFt : gainFt * 0.3048);
  const lossDisplay = route.elevationLossMeters !== undefined
    ? Math.round(imp ? route.elevationLossMeters * 3.28084 : route.elevationLossMeters)
    : null;
  const elevUnit = imp ? 'ft' : 'm';
  const estMin = route.estimatedDurationMin ?? route.estimatedMinutes;
  const profile = route.elevationProfileFt;
  const mapStyle = mode === 'light' ? MAP_STYLE_LIGHT : MAP_STYLE_DARK;
  const providerLabel = route.routingProvider === 'osrm_foot'
    ? 'Snapped to roads & paths · OpenStreetMap'
    : route.routingProvider === 'osrm_road'
      ? 'Snapped to roads · trail data unavailable'
      : route.routingProvider === 'direct'
        ? 'Direct-line route (not snapped to paths)'
        : 'Route line as drawn';

  function commitName() {
    const next = nameDraft.trim();
    if (!ownerLeaseIsCurrent(ownerLease.current)) return;
    if (next && next !== route!.name) updateRoute(route!.id, { name: next });
    setEditingName(false);
  }

  function commitNotes() {
    if (notesDraft === null || !ownerLeaseIsCurrent(ownerLease.current)) return;
    updateRoute(route!.id, { notes: notesDraft.trim() || undefined });
    setNotesDraft(null);
  }

  function useRoute() {
    if(!ownerLeaseIsCurrent(ownerLease.current)) return;
    attachRoute(route!.id);
    Alert.alert(
      'Route selected',
      `"${route!.name}" is set for your next tracked run. Open Training Run → start any run mode and the route line will guide you on the map.`,
      [{ text: 'OK', onPress: () => router.navigate('/(tabs)/training' as never) }],
    );
  }

  function detachRoute() {
    if(!ownerLeaseIsCurrent(ownerLease.current)) return;
    detachRouteFromToday();
    Alert.alert(
      'Route removed from today',
      `"${route!.name}" is still saved. Today’s run is now in free-run mode, and you can reattach the route at any time.`,
    );
  }

  function deleteRoute() {
    Alert.alert('Delete route', `Remove "${route!.name}" permanently?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if(!ownerLeaseIsCurrent(ownerLease.current)) return;
          removeRoute(route!.id);
          router.back();
        },
      },
    ]);
  }

  const displayRoute=isAttached?effectiveAttachedRoute(route,attachment)??route:route;
  const sections=displayRoute.sections??legacyRouteSections(displayRoute.segments,routeGeometryMeters(displayRoute.points));
  function reverseWithReview() {
    const next=effectiveAttachedRoute(route!,{...attachment,direction:attachment.direction==='reverse'?'forward':'reverse'});
    Alert.alert('Review reversed route',next?.sections?.length?routeSectionSummary(next.sections,imp):'The route direction will change for your next run.',[
      {text:'Cancel',style:'cancel'},{text:'Use this direction',onPress:()=>{if(ownerLeaseIsCurrent(ownerLease.current)) reverseAttachedRoute();}},
    ]);
  }
  const profileMin = profile && profile.length >= 2 ? Math.min(...profile) : 0;
  const profileMax = profile && profile.length >= 2 ? Math.max(...profile) : 0;
  const profileRange = Math.max(profileMax - profileMin, 10);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Map preview */}
      <View style={st.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          customMapStyle={mapStyle}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {route.points.length > 1 ? (
            <Polyline coordinates={displayRoute.points} strokeColor={C.positive} strokeWidth={5} />
          ) : null}
          {sections.map((section,index)=><Polyline key={section.id} coordinates={routeSectionLine(displayRoute.points,section.startMeters,section.endMeters)} strokeColor={index%2?C.primary:C.warning} strokeWidth={7}/>)}
          {displayRoute.points[0] ? <Marker coordinate={displayRoute.points[0]} title="Start" pinColor={C.positive} /> : null}
        </MapView>
        <LegacyBackControl onBack={() => router.back()} />
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -20 }}>
        {/* Title card */}
        <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {editingName ? (
            <View style={st.nameEditRow}>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                style={[st.nameInput, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
                onSubmitEditing={commitName}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={commitName} hitSlop={8}>
                <Ionicons name="checkmark" size={22} color={C.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={st.nameRow}>
              <Text style={[st.routeName, { color: C.text }]}>{route.name}</Text>
              <TouchableOpacity
                onPress={() => { setNameDraft(route.name); setEditingName(true); }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Rename route"
              >
                <Ionicons name="pencil-outline" size={17} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          <Text style={[st.providerText, { color: C.textDim }]}>{providerLabel}</Text>

          <View style={st.statGrid}>
            <View style={[st.statCell, { backgroundColor: C.cardAlt }]}>
              <Text style={[st.statLabel, { color: C.textDim }]}>DISTANCE</Text>
              <Text style={[st.statValue, { color: C.text }]}>{distDisplay.toFixed(2)} <Text style={[st.statUnit, { color: C.textMuted }]}>{distUnit}</Text></Text>
            </View>
            <View style={[st.statCell, { backgroundColor: C.cardAlt }]}>
              <Text style={[st.statLabel, { color: C.textDim }]}>ELEVATION</Text>
              <Text style={[st.statValue, { color: C.text }]}>
                +{gainDisplay}{lossDisplay !== null ? ` / −${lossDisplay}` : ''} <Text style={[st.statUnit, { color: C.textMuted }]}>{elevUnit}</Text>
              </Text>
            </View>
            <View style={[st.statCell, { backgroundColor: C.cardAlt }]}>
              <Text style={[st.statLabel, { color: C.textDim }]}>EST TIME</Text>
              <Text style={[st.statValue, { color: C.text }]}>{fmtDuration(estMin)}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={()=>router.push({pathname:'/(tabs)/training/route-builder',params:{routeId:route.id}} as never)} style={[st.reverseBtn,{borderColor:C.primary,backgroundColor:C.cardAlt}]} accessibilityRole="button" accessibilityLabel="Edit saved route">
            <Ionicons name="create-outline" size={18} color={C.primary}/><Text style={[st.useBtnText,{color:C.primary}]}>Edit Route</Text>
          </TouchableOpacity>
          <Text style={{color:C.textMuted,fontSize:12,marginTop:8}}>Changes apply to future runs. A recording already in progress keeps its original route.</Text>
          <TouchableOpacity
            style={[st.useBtn, { backgroundColor: C.primary }]}
            onPress={isAttached ? detachRoute : useRoute}
            activeOpacity={0.85}
          >
            <Ionicons name={isAttached ? 'remove-circle-outline' : 'play-outline'} size={16} color={C.onPrimary} />
            <Text style={[st.useBtnText, { color: C.onPrimary }]}>{isAttached ? 'Remove From Today’s Run' : 'Use Route for Next Run'}</Text>
          </TouchableOpacity>
          {isAttached ? (
            <TouchableOpacity
              style={[st.reverseBtn, { borderColor: C.border, backgroundColor: C.cardAlt }]}
              onPress={reverseWithReview}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color={C.text} />
              <Text style={[st.useBtnText, { color: C.text }]}>
                {attachment.direction === 'reverse' ? 'Use Forward Direction' : 'Reverse Route'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {sections.length>0?<View style={[st.card,{backgroundColor:C.card,borderColor:C.border}]}>
          <Text style={[st.cardLabel,{color:C.textDim}]}>ROUTE SEGMENTS{isAttached&&attachment.direction==='reverse'?' · REVERSED':''}</Text>
          {sections.map(section=><View key={section.id} style={{gap:4,marginTop:12}}>
            <Text style={{color:C.text,fontWeight:'700'}}>{section.name}</Text>
            <Text style={{color:C.textMuted}}>{(section.startMeters/(imp?1609.344:1000)).toFixed(2)}–{(section.endMeters/(imp?1609.344:1000)).toFixed(2)} {distUnit} · {((section.endMeters-section.startMeters)/(imp?1609.344:1000)).toFixed(2)} {distUnit} long</Text>
            {!!routeSectionTarget(section,imp)&&<Text style={{color:C.primary}}>{routeSectionTarget(section,imp)}</Text>}
          </View>)}
        </View>:null}
        {/* Elevation profile */}
        <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[st.cardLabel, { color: C.textDim }]}>ELEVATION PROFILE</Text>
          {profile && profile.length >= 2 ? (
            <View style={st.profileWrap}>
              {profile.map((point, index) => (
                <View
                  key={`${point}-${index}`}
                  style={[
                    st.profileBar,
                    {
                      height: `${24 + ((point - profileMin) / profileRange) * 76}%`,
                      backgroundColor: C.primary,
                      opacity: 0.4 + ((point - profileMin) / profileRange) * 0.5,
                    },
                  ]}
                />
              ))}
            </View>
          ) : (
            <Text style={[st.emptyText, { color: C.textMuted }]}>
              No elevation data was available when this route was saved. Rebuild it in the Route Builder to fetch a profile.
            </Text>
          )}
        </View>

        {/* Notes */}
        <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={st.notesHead}>
            <Text style={[st.cardLabel, { color: C.textDim }]}>NOTES</Text>
            {notesDraft !== null ? (
              <TouchableOpacity onPress={commitNotes} hitSlop={8}>
                <Text style={{ color: C.primary, fontSize: 12, fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setNotesDraft(route.notes ?? '')} hitSlop={8}>
                <Text style={{ color: C.primary, fontSize: 12, fontWeight: '800' }}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {notesDraft !== null ? (
            <TextInput
              value={notesDraft}
              onChangeText={setNotesDraft}
              multiline
              autoFocus
              placeholder="Parking, water stops, surface, safety..."
              placeholderTextColor={C.textDim}
              style={[st.notesInput, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
          ) : (
            <Text style={[st.notesText, { color: route.notes ? C.textMuted : C.textDim }]}>
              {route.notes ?? 'No notes yet.'}
            </Text>
          )}
        </View>

        {/* Education */}
        <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[st.cardLabel, { color: C.primary }]}>PLANNED VS WATCH DISTANCE</Text>
          <Text style={[st.eduText, { color: C.textMuted }]}>{TANGENTS_EDUCATION_COPY}</Text>
        </View>

        {/* Delete */}
        <TouchableOpacity
          style={[st.deleteBtn, { borderColor: C.critical }]}
          onPress={deleteRoute}
          activeOpacity={0.8}
        >
          <Text style={[st.deleteText, { color: C.critical }]}>Delete Route</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  missingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { height: 260 },
  backBtn: {
    position: 'absolute',
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '800',
  },
  routeName: { fontSize: 20, fontWeight: '800', flex: 1 },
  providerText: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  statGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statCell: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 3 },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'center' },
  statUnit: { fontSize: 10, fontWeight: '600' },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 12,
  },
  reverseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderRadius: 12, paddingVertical: 12, marginTop: 8,
  },
  useBtnText: { fontSize: 14, fontWeight: '800' },
  profileWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 72,
    gap: 2,
  },
  profileBar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  emptyText: { fontSize: 12, lineHeight: 18 },
  notesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notesText: { fontSize: 13, lineHeight: 20 },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  eduText: { fontSize: 12, lineHeight: 19 },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteText: { fontSize: 13, fontWeight: '800' },
});
