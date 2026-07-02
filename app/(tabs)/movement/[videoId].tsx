// ─── Movement Analysis Detail ─────────────────────────────────────────────────
//
// Shows analysis session for a video record. Tabs: Overview | Gait | Angles | Flags
// All analysis is entered manually. AI pose estimation is a future integration point.

import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { useMovementStore } from '../../../src/store/movementStore';
import { suggestGaitFindings } from '../../../src/utils/movementEngine';
import { useThemeColors, type ThemeColors } from '../../../src/theme/ThemeContext';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type {
  GaitFinding,
  MovementRiskFlag,
  FindingSeverity,
  GaitAnalysis,
  FootStrikePattern,
  OscillationLevel,
  TrunkPosition,
  SeverityOrNull,
  ArmSwingQuality,
  GaitSymmetry,
} from '../../../src/types/movement';

type Tab = 'overview' | 'gait' | 'angles' | 'flags';

function severityColor(sev: FindingSeverity, colors: ThemeColors): string {
  if (sev === 'low')      return colors.positive;
  if (sev === 'moderate') return colors.warning;
  return colors.critical;
}

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  low:      'Low',
  moderate: 'Moderate',
  high:     'High',
};

// ─── Gait defaults ───────────────────────────────────────────────────────────

const GAIT_DEFAULTS: Omit<GaitAnalysis, 'videoId'> = {
  footStrike:          'unknown',
  overstride:          null,
  crossoverGait:       null,
  verticalOscillation: 'unknown',
  trunkLean:           'unknown',
  hipDrop:             null,
  pelvicControl:       null,
  kneeValgus:          null,
  armSwing:            'unknown',
  symmetry:            'unknown',
};

// ─── Finding card ─────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: GaitFinding }) {
  const colors = useThemeColors();
  const fc     = useMemo(() => createFcStyles(colors), [colors]);

  return (
    <View style={fc.card}>
      <View style={fc.row}>
        <View style={[fc.badge, { backgroundColor: severityColor(finding.severity, colors) + '22' }]}>
          <Text style={[fc.badgeTxt, { color: severityColor(finding.severity, colors) }]}>
            {SEVERITY_LABEL[finding.severity]}
          </Text>
        </View>
        <Text style={fc.title} numberOfLines={2}>{finding.finding}</Text>
      </View>
      {Boolean(finding.implication) && <Text style={fc.desc}>{finding.implication}</Text>}
      {Boolean(finding.drill) && (
        <View style={fc.rec}>
          <Text style={fc.recLabel}>Drill</Text>
          <Text style={fc.recTxt}>{finding.drill}</Text>
        </View>
      )}
      {Boolean(finding.strengthFocus) && (
        <View style={fc.rec}>
          <Text style={fc.recLabel}>Strength focus</Text>
          <Text style={fc.recTxt}>{finding.strengthFocus}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Risk flag card ───────────────────────────────────────────────────────────

function RiskFlagCard({ flag, onDismiss }: { flag: MovementRiskFlag; onDismiss: () => void }) {
  const colors = useThemeColors();
  const rf     = useMemo(() => createRfStyles(colors), [colors]);

  return (
    <View style={rf.card}>
      <View style={rf.row}>
        <View style={[rf.badge, { backgroundColor: severityColor(flag.severity, colors) + '22' }]}>
          <Text style={[rf.badgeTxt, { color: severityColor(flag.severity, colors) }]}>
            {SEVERITY_LABEL[flag.severity].toUpperCase()}
          </Text>
        </View>
        {!flag.active && <Text style={rf.dismissed}>Dismissed</Text>}
      </View>
      <Text style={rf.title}>{flag.sourceFinding}</Text>
      <Text style={rf.body}>{flag.suggestion}</Text>
      {flag.active && (
        <Pressable style={rf.dismissBtn} onPress={onDismiss}>
          <Text style={rf.dismissTxt}>Dismiss</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Gait checklist modal ─────────────────────────────────────────────────────

type BoolField = 'overstride' | 'crossoverGait';

const GAIT_BOOL_FIELDS: { key: BoolField; label: string }[] = [
  { key: 'overstride',   label: 'Overstriding'   },
  { key: 'crossoverGait',label: 'Crossover gait' },
];

const FOOT_STRIKE_OPTIONS: FootStrikePattern[] = ['heel', 'midfoot', 'forefoot', 'unknown'];
const HIP_DROP_OPTIONS:    SeverityOrNull[]    = [null, 'none', 'mild', 'moderate', 'severe'];
const KNEE_VALGUS_OPTIONS: SeverityOrNull[]    = [null, 'none', 'mild', 'moderate', 'severe'];

function GaitChecklistModal({
  visible,
  existing,
  videoId,
  onSave,
  onClose,
}: {
  visible:  boolean;
  existing: Partial<Omit<GaitAnalysis, 'videoId'>>;
  videoId:  string;
  onSave:   (g: GaitAnalysis) => void;
  onClose:  () => void;
}) {
  const colors = useThemeColors();
  const gc     = useMemo(() => createGcStyles(colors), [colors]);

  const [cadence,    setCadence]    = useState(String(existing.cadence ?? ''));
  const [footStrike, setFootStrike] = useState<FootStrikePattern>(existing.footStrike ?? 'unknown');
  const [overstride,    setOverstride]   = useState<boolean | null>(existing.overstride ?? null);
  const [crossover,     setCrossover]    = useState<boolean | null>(existing.crossoverGait ?? null);
  const [hipDrop,       setHipDrop]      = useState<SeverityOrNull>(existing.hipDrop ?? null);
  const [kneeValgus,    setKneeValgus]   = useState<SeverityOrNull>(existing.kneeValgus ?? null);

  function handleSave() {
    const cad = parseInt(cadence, 10);
    const g: GaitAnalysis = {
      ...GAIT_DEFAULTS,
      videoId,
      footStrike,
      overstride,
      crossoverGait: crossover,
      hipDrop,
      kneeValgus,
      cadence: Number.isNaN(cad) ? undefined : cad,
    };
    onSave(g);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={gc.root}>
        <View style={gc.header}>
          <Pressable onPress={onClose}><Text style={gc.cancel}>Cancel</Text></Pressable>
          <Text style={gc.title}>Gait Checklist</Text>
          <Pressable onPress={handleSave}><Text style={gc.save}>Save</Text></Pressable>
        </View>
        <ScrollView>
          {/* Cadence */}
          <View style={gc.row}>
            <Text style={gc.label}>Cadence (spm)</Text>
            <TextInput
              style={gc.numInput}
              value={cadence}
              onChangeText={setCadence}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          {/* Foot strike */}
          <View style={gc.groupRow}>
            <Text style={gc.label}>Foot strike</Text>
            <View style={gc.pills}>
              {FOOT_STRIKE_OPTIONS.map(opt => (
                <Pressable
                  key={opt}
                  style={[gc.pill, footStrike === opt && gc.pillOn]}
                  onPress={() => setFootStrike(opt)}
                >
                  <Text style={[gc.pillTxt, footStrike === opt && gc.pillOnTxt]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Boolean flags */}
          {GAIT_BOOL_FIELDS.map(f => {
            const val = f.key === 'overstride' ? overstride : crossover;
            const set = f.key === 'overstride' ? setOverstride : setCrossover;
            return (
              <View key={f.key} style={gc.row}>
                <Text style={gc.label}>{f.label}</Text>
                <View style={gc.pills}>
                  {([null, false, true] as const).map(v => (
                    <Pressable
                      key={String(v)}
                      style={[gc.pill, val === v && gc.pillOn]}
                      onPress={() => set(v)}
                    >
                      <Text style={[gc.pillTxt, val === v && gc.pillOnTxt]}>
                        {v === null ? 'Unknown' : v ? 'Yes' : 'No'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Hip drop */}
          <View style={gc.groupRow}>
            <Text style={gc.label}>Hip drop</Text>
            <View style={gc.pills}>
              {HIP_DROP_OPTIONS.map(v => (
                <Pressable
                  key={String(v)}
                  style={[gc.pill, hipDrop === v && gc.pillOn]}
                  onPress={() => setHipDrop(v)}
                >
                  <Text style={[gc.pillTxt, hipDrop === v && gc.pillOnTxt]}>
                    {v === null ? 'Unknown' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Knee valgus */}
          <View style={gc.groupRow}>
            <Text style={gc.label}>Knee valgus</Text>
            <View style={gc.pills}>
              {KNEE_VALGUS_OPTIONS.map(v => (
                <Pressable
                  key={String(v)}
                  style={[gc.pill, kneeValgus === v && gc.pillOn]}
                  onPress={() => setKneeValgus(v)}
                >
                  <Text style={[gc.pillTxt, kneeValgus === v && gc.pillOnTxt]}>
                    {v === null ? 'Unknown' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

const HIT_SLOP = { top: 12, bottom: 12, left: 16, right: 16 } as const;

export default function VideoDetailScreen() {
  const colors    = useThemeColors();
  const s         = useMemo(() => createStyles(colors), [colors]);
  const insets    = useSafeAreaInsets();
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const {
    videos,
    getVideoSession,
    ensureSession,
    updateGaitAnalysis,
    addGaitFinding,
    dismissRiskFlag,
    deleteVideo,
  } = useMovementStore();

  const video   = videos.find(v => v.id === videoId);
  const session = getVideoSession(videoId ?? '');

  const [tab,           setTab]           = useState<Tab>('overview');
  const [showGaitModal, setShowGaitModal] = useState(false);

  if (!video) {
    return (
      <View style={s.notFound}>
        <Text style={s.notFoundTxt}>Analysis not found</Text>
        <Pressable onPress={() => router.back()}><Text style={s.back}>← Back</Text></Pressable>
      </View>
    );
  }

  const gait     = session?.gaitAnalysis;
  const findings = session?.gaitFindings ?? [];
  const flags    = session?.riskFlags    ?? [];

  function handleSaveGait(g: GaitAnalysis) {
    ensureSession(videoId!);
    updateGaitAnalysis(videoId!, g);

    const suggested = suggestGaitFindings(g);
    for (const f of suggested) {
      addGaitFinding(videoId!, f);
    }
  }

  function handleDelete() {
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this analysis record?')) {
        deleteVideo(videoId!);
        router.back();
      }
    } else {
      Alert.alert('Delete Analysis', 'Remove this analysis record?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => { deleteVideo(videoId!); router.back(); },
        },
      ]);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'gait',     label: 'Gait'     },
    { key: 'angles',   label: 'Angles'   },
    { key: 'flags',    label: 'Flags'    },
  ];

  const activeFlags = flags.filter(f => f.active);

  return (
    <View style={s.root}>
      {/* Nav bar — safe area top */}
      <View style={[s.nav, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={HIT_SLOP}>
          <Text style={s.navBack}>‹ Back</Text>
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={HIT_SLOP}>
          <Text style={s.navDelete}>Delete</Text>
        </Pressable>
      </View>

      {/* Title */}
      <View style={s.titleSection}>
        <Text style={s.videoTitle}>{video.title}</Text>
        <Text style={s.videoMeta}>{video.date} · {video.activity}</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            style={[s.tabItem, tab === t.key ? s.tabItemActive : undefined]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabTxt, tab === t.key ? s.tabTxtActive : undefined]}>{t.label}</Text>
            {t.key === 'flags' && activeFlags.length > 0 && (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeTxt}>{activeFlags.length}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
        {/* ── Overview ── */}
        {tab === 'overview' && (
          <View style={s.section}>
            <View style={s.overviewCard}>
              <Text style={s.cardLabel}>VIDEO DETAILS</Text>
              <View style={s.infoRow}><Text style={s.infoKey}>Type</Text><Text style={s.infoVal}>{video.analysisType.replace(/_/g, ' ')}</Text></View>
              <View style={s.infoRow}><Text style={s.infoKey}>Activity</Text><Text style={s.infoVal}>{video.activity}</Text></View>
              <View style={s.infoRow}><Text style={s.infoKey}>View angle</Text><Text style={s.infoVal}>{video.view}</Text></View>
              {video.shoes   ? <View style={s.infoRow}><Text style={s.infoKey}>Shoes</Text><Text style={s.infoVal}>{video.shoes}</Text></View> : null}
              {video.surface ? <View style={s.infoRow}><Text style={s.infoKey}>Surface</Text><Text style={s.infoVal}>{video.surface}</Text></View> : null}
              {video.notes   ? <View style={s.infoRow}><Text style={s.infoKey}>Notes</Text><Text style={s.infoVal}>{video.notes}</Text></View> : null}
            </View>

            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statNum}>{findings.length}</Text>
                <Text style={s.statLabel}>Findings</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statNum}>{activeFlags.length}</Text>
                <Text style={s.statLabel}>Active flags</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statNum}>{session?.jointAngles?.length ?? 0}</Text>
                <Text style={s.statLabel}>Angles</Text>
              </View>
            </View>

            <View style={s.disclaimer}>
              <Text style={s.disclaimerTxt}>
                Movement analysis is educational and for coaching reference only. Not a medical diagnosis.
                Consult a physiotherapist for injury assessment and treatment.
              </Text>
            </View>
          </View>
        )}

        {/* ── Gait ── */}
        {tab === 'gait' && (
          <View style={s.section}>
            <Pressable style={s.actionBtn} onPress={() => setShowGaitModal(true)}>
              <Text style={s.actionBtnTxt}>{gait ? 'Update Gait Checklist' : 'Run Gait Checklist'}</Text>
            </Pressable>

            {gait ? (
              <View style={s.gaitSummary}>
                <Text style={s.cardLabel}>GAIT DATA</Text>
                <View style={s.infoRow}><Text style={s.infoKey}>Foot strike</Text><Text style={s.infoVal}>{gait.footStrike}</Text></View>
                {gait.cadence != null    ? <View style={s.infoRow}><Text style={s.infoKey}>Cadence</Text><Text style={s.infoVal}>{gait.cadence} spm</Text></View> : null}
                {gait.overstride != null ? <View style={s.infoRow}><Text style={s.infoKey}>Overstride</Text><Text style={s.infoVal}>{gait.overstride ? 'Yes' : 'No'}</Text></View> : null}
                {gait.hipDrop != null    ? <View style={s.infoRow}><Text style={s.infoKey}>Hip drop</Text><Text style={s.infoVal}>{gait.hipDrop ?? 'Unknown'}</Text></View> : null}
                {gait.crossoverGait != null ? <View style={s.infoRow}><Text style={s.infoKey}>Crossover</Text><Text style={s.infoVal}>{gait.crossoverGait ? 'Yes' : 'No'}</Text></View> : null}
                {gait.kneeValgus != null ? <View style={s.infoRow}><Text style={s.infoKey}>Knee valgus</Text><Text style={s.infoVal}>{gait.kneeValgus ?? 'Unknown'}</Text></View> : null}
              </View>
            ) : null}

            {findings.length === 0 ? (
              <Text style={s.emptyNote}>No findings yet. Run the gait checklist to generate observations.</Text>
            ) : (
              <View style={s.findingsList}>
                <Text style={s.cardLabel}>FINDINGS ({findings.length})</Text>
                {findings.map(f => (
                  <FindingCard key={f.id} finding={f} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Angles ── */}
        {tab === 'angles' && (
          <View style={s.section}>
            <Text style={s.emptyNote}>
              Pause your video at a key frame, measure the angle manually, and log it here.
              Reference ranges are based on published biomechanics literature.
            </Text>
            <View style={s.comingSoonCard}>
              <Text style={s.comingSoonTitle}>AI Auto-Detection — Coming Soon</Text>
              <Text style={s.comingSoonDesc}>
                Future: MediaPipe Pose / MoveNet will estimate joint angles frame-by-frame
                on-device without sending video to the cloud.
              </Text>
            </View>
            {(session?.jointAngles ?? []).length === 0 ? (
              <Text style={s.emptyNote}>No angles logged yet.</Text>
            ) : null}
            {(session?.jointAngles ?? []).map(angle => (
              <View key={angle.id} style={s.angleCard}>
                <Text style={s.angleLabel}>{angle.angleName.replace(/_/g, ' ')}</Text>
                <Text style={s.angleVal}>{angle.angleDegrees}°</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Flags ── */}
        {tab === 'flags' && (
          <View style={s.section}>
            {flags.length === 0 ? (
              <Text style={s.emptyNote}>
                No risk flags. Flags are auto-generated from gait checklist findings.
                They influence performance score calculations and training recommendations.
              </Text>
            ) : (
              flags.map(flag => (
                <RiskFlagCard
                  key={flag.id}
                  flag={flag}
                  onDismiss={() => dismissRiskFlag(flag.id)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      <GaitChecklistModal
        visible={showGaitModal}
        existing={gait ?? {}}
        videoId={videoId!}
        onSave={handleSaveGait}
        onClose={() => setShowGaitModal(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.bg },
  notFound:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  notFoundTxt:    { color: colors.textMuted, fontSize: FontSize.base },
  back:           { color: colors.primary,   fontSize: FontSize.base },
  nav: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.sm,
  },
  navBack:        { color: colors.primary,  fontSize: FontSize.base },
  navDelete:      { color: colors.critical, fontSize: FontSize.base },
  titleSection:   { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  videoTitle:     { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  videoMeta:      { color: colors.textMuted, fontSize: FontSize.xs },
  tabBar: {
    flexDirection:  'row',
    paddingHorizontal: spacing.lg,
    gap:            spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom:  spacing.sm,
  },
  tabItem: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      20,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
  },
  tabItemActive: {
    backgroundColor: colors.primaryDim,
  },
  tabTxt:        { color: colors.textMuted, fontSize: FontSize.sm },
  tabTxtActive:  { color: colors.primary, fontWeight: FontWeight.bold },
  tabBadge: {
    backgroundColor: colors.critical,
    borderRadius:    8,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  tabBadgeTxt:   { color: colors.text, fontSize: 9, fontWeight: FontWeight.black },
  body:          { flex: 1 },
  bodyContent:   { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  section:       { gap: spacing.md },
  overviewCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  cardLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    marginBottom:  spacing.xs,
  },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  infoKey:   { color: colors.textSubtle, fontSize: FontSize.sm },
  infoVal:   { color: colors.text,       fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  statsRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  statBox: {
    flex:            1,
    backgroundColor: colors.card,
    borderRadius:    10,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    gap:             2,
  },
  statNum:   { color: colors.text,    fontSize: FontSize.xl, fontWeight: FontWeight.black },
  statLabel: { color: colors.textMuted, fontSize: FontSize.xs },
  disclaimer: {
    backgroundColor: colors.card,
    borderRadius:    10,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  disclaimerTxt: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  actionBtnTxt: { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  gaitSummary: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  emptyNote: { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18 },
  findingsList: { gap: spacing.sm },
  comingSoonCard: {
    backgroundColor: colors.primaryDim,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.primary + '44',
    gap:             spacing.xs,
  },
  comingSoonTitle: { color: colors.primary,   fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  comingSoonDesc:  { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  angleCard: {
    backgroundColor:colors.card,
    borderRadius:   10,
    padding:        spacing.md,
    borderWidth:    1,
    borderColor:    colors.border,
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  angleLabel: { color: colors.textMuted, fontSize: FontSize.sm, textTransform: 'capitalize' },
  angleVal:   { color: colors.text,      fontSize: FontSize.base, fontWeight: FontWeight.black },
});

const fc = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    10,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.xs,
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge:    { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { fontSize: 10, fontWeight: FontWeight.black },
  title:    { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold, flex: 1 },
  desc:     { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  rec: {
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    padding:         spacing.sm,
    gap:             2,
  },
  recLabel: { color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.black },
  recTxt:   { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 16 },
});

const rf = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    10,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge:     { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt:  { fontSize: 10, fontWeight: FontWeight.black },
  dismissed: { color: colors.textDim, fontSize: FontSize.xs },
  title:     { color: colors.text,    fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  body:      { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  dismissBtn:{
    alignSelf:       'flex-start',
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  dismissTxt:{ color: colors.textMuted, fontSize: FontSize.xs },
});

const gc = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:      spacing.xl,
    paddingBottom:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel:  { color: colors.textMuted, fontSize: FontSize.base },
  title:   { color: colors.text,      fontSize: FontSize.base, fontWeight: FontWeight.bold },
  save:    { color: colors.primary,   fontSize: FontSize.base, fontWeight: FontWeight.bold },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  label:   { color: colors.text, fontSize: FontSize.sm },
  pills:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:      20,
    backgroundColor:   colors.border,
  },
  pillOn: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  pillTxt:   { color: colors.textDim,  fontSize: FontSize.xs },
  pillOnTxt: { color: colors.primary, fontWeight: FontWeight.bold },
  numInput: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    minWidth:          64,
    textAlign:         'right',
  },
});
