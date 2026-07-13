// ─── Movement Analysis Detail ─────────────────────────────────────────────────
//
// Shows analysis session for a video record. Tabs: Overview | Gait | Angles | Flags
// All analysis is entered manually. AI pose estimation is a future integration point.

import {
  ActivityIndicator,
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
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';

import { useMovementStore } from '../../../src/store/movementStore';
import { resolveDocumentUri } from '../../../src/lib/mediaPaths';
import { supabase }         from '../../../src/lib/supabase';
import { suggestGaitFindings, getMovementTrainingInfluences } from '../../../src/utils/movementEngine';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type {
  GaitFinding,
  MovementRiskFlag,
  FindingSeverity,
  GaitAnalysis,
  FootStrikePattern,
  SeverityOrNull,
} from '../../../src/types/movement';

type Tab = 'overview' | 'gait' | 'angles' | 'flags';

const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  low:      colors.positive,
  moderate: colors.warning,
  high:     colors.critical,
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  low:      'Low',
  moderate: 'Moderate',
  high:     'High',
};

const FOCUS_COLOR: Record<'caution' | 'modification' | 'focus', string> = {
  caution:      colors.critical,
  modification: colors.warning,
  focus:        colors.primary,
};

const FOCUS_LABEL: Record<'caution' | 'modification' | 'focus', string> = {
  caution:      'Caution',
  modification: 'Modify',
  focus:        'Focus',
};

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
  return (
    <View style={fc.card}>
      <View style={fc.row}>
        <View style={[fc.badge, { backgroundColor: SEVERITY_COLOR[finding.severity] + '22' }]}>
          <Text style={[fc.badgeTxt, { color: SEVERITY_COLOR[finding.severity] }]}>
            {SEVERITY_LABEL[finding.severity]}
          </Text>
        </View>
        <Text style={fc.title} numberOfLines={2}>{finding.finding}</Text>
      </View>
      {Boolean(finding.implication) && (
        <View style={fc.rec}>
          <Text style={fc.recLabel}>What it means</Text>
          <Text style={fc.desc}>{finding.implication}</Text>
        </View>
      )}
      {Boolean(finding.drill) && (
        <View style={fc.rec}>
          <Text style={fc.recLabel}>What to do</Text>
          <Text style={fc.recTxt}>{finding.drill}</Text>
        </View>
      )}
      {Boolean(finding.strengthFocus) && (
        <View style={fc.rec}>
          <Text style={fc.recLabel}>Strength focus</Text>
          <Text style={fc.recTxt}>{finding.strengthFocus}</Text>
        </View>
      )}
      {Boolean(finding.retestNote) && (
        <View style={fc.rec}>
          <Text style={fc.recLabel}>Retest</Text>
          <Text style={fc.recTxt}>{finding.retestNote}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Risk flag card ───────────────────────────────────────────────────────────

function RiskFlagCard({ flag, onDismiss }: { flag: MovementRiskFlag; onDismiss: () => void }) {
  return (
    <View style={rf.card}>
      <View style={rf.row}>
        <View style={[rf.badge, { backgroundColor: SEVERITY_COLOR[flag.severity] + '22' }]}>
          <Text style={[rf.badgeTxt, { color: SEVERITY_COLOR[flag.severity] }]}>
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

const SEV_OPTS: SeverityOrNull[] = [null, 'none', 'mild', 'moderate', 'severe'];
const FOOT_STRIKE_OPTIONS: FootStrikePattern[] = ['heel', 'midfoot', 'forefoot', 'unknown'];
const TRI_OPTS = [null, false, true] as const;
const CADENCE_NOT_MEASURED = 0;
const CADENCE_VALUES = [CADENCE_NOT_MEASURED, ...Array.from({ length: 71 }, (_, i) => 150 + i)]; // 0 = "Not measured", 150–220 spm

function sevLabel(v: SeverityOrNull) {
  return v === null ? '—' : v.charAt(0).toUpperCase() + v.slice(1);
}

function SevPicker({ value, onChange }: { value: SeverityOrNull; onChange: (v: SeverityOrNull) => void }) {
  return (
    <View style={gc.pills}>
      {SEV_OPTS.map(v => (
        <Pressable key={String(v)} style={[gc.pill, value === v && gc.pillOn]} onPress={() => onChange(v)}>
          <Text style={[gc.pillTxt, value === v && gc.pillOnTxt]}>{sevLabel(v)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TriPicker({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <View style={gc.pills}>
      {TRI_OPTS.map(v => (
        <Pressable key={String(v)} style={[gc.pill, value === v && gc.pillOn]} onPress={() => onChange(v)}>
          <Text style={[gc.pillTxt, value === v && gc.pillOnTxt]}>{v === null ? '—' : v ? 'Yes' : 'No'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

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
  const [cadence,    setCadence]   = useState(existing.cadence ?? CADENCE_NOT_MEASURED);
  const [footStrike, setFootStrike]= useState<FootStrikePattern>(existing.footStrike ?? 'unknown');
  const [overstride, setOverstride]= useState<boolean | null>(existing.overstride ?? null);
  const [crossover,  setCrossover] = useState<boolean | null>(existing.crossoverGait ?? null);
  const [hipDrop,    setHipDrop]   = useState<SeverityOrNull>(existing.hipDrop ?? null);
  const [kneeValgus, setKneeValgus]= useState<SeverityOrNull>(existing.kneeValgus ?? null);
  const [notes,      setNotes]     = useState(existing.additionalNotes ?? '');
  const [showCadencePicker, setShowCadencePicker] = useState(false);

  const answeredCount = [
    cadence !== CADENCE_NOT_MEASURED,
    footStrike !== 'unknown',
    overstride !== null,
    crossover !== null,
    hipDrop !== null,
    kneeValgus !== null,
  ].filter(Boolean).length;

  function handleSave() {
    const g: GaitAnalysis = {
      ...GAIT_DEFAULTS,
      videoId,
      footStrike,
      overstride,
      crossoverGait: crossover,
      hipDrop,
      kneeValgus,
      cadence: cadence === CADENCE_NOT_MEASURED ? undefined : cadence,
      additionalNotes: notes.trim() || undefined,
    };
    onSave(g);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={gc.root}>
        <View style={gc.header}>
          <Pressable onPress={onClose}><Text style={gc.cancel}>Cancel</Text></Pressable>
          <View style={gc.headerCenter}>
            <Text style={gc.title}>Gait Checklist</Text>
            <Text style={gc.progress}>{answeredCount} of 6 answered</Text>
          </View>
          <Pressable onPress={handleSave}><Text style={gc.save}>Save</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Cadence */}
          <Pressable style={gc.row} onPress={() => setShowCadencePicker(true)}>
            <Text style={gc.label}>Cadence (spm)</Text>
            <View style={gc.valueRow}>
              <Text style={gc.valueTxt}>
                {cadence === CADENCE_NOT_MEASURED ? 'Not measured' : `${cadence} spm`}
              </Text>
              <Text style={gc.chevron}>›</Text>
            </View>
          </Pressable>

          <View style={gc.groupRow}>
            <Text style={gc.label}>Foot strike</Text>
            <View style={gc.pills}>
              {FOOT_STRIKE_OPTIONS.map(opt => (
                <Pressable key={opt} style={[gc.pill, footStrike === opt && gc.pillOn]} onPress={() => setFootStrike(opt)}>
                  <Text style={[gc.pillTxt, footStrike === opt && gc.pillOnTxt]}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={gc.groupRow}>
            <Text style={gc.label}>Overstriding</Text>
            <TriPicker value={overstride} onChange={setOverstride} />
          </View>
          <View style={gc.groupRow}>
            <Text style={gc.label}>Crossover gait</Text>
            <TriPicker value={crossover} onChange={setCrossover} />
          </View>
          <View style={gc.groupRow}>
            <Text style={gc.label}>Hip drop severity</Text>
            <SevPicker value={hipDrop} onChange={setHipDrop} />
          </View>
          <View style={gc.groupRow}>
            <Text style={gc.label}>Knee valgus</Text>
            <SevPicker value={kneeValgus} onChange={setKneeValgus} />
          </View>

          {/* Notes */}
          <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
            <Text style={gc.label}>Notes</Text>
            <TextInput
              style={[gc.numInput, { height: 80, textAlignVertical: 'top', paddingTop: 8 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional observations…"
              placeholderTextColor={colors.textSubtle}
              multiline
            />
          </View>
        </ScrollView>
      </View>

      <PickerWheel
        visible={showCadencePicker}
        title="Cadence"
        values={CADENCE_VALUES}
        selectedValue={cadence}
        formatValue={v => v === CADENCE_NOT_MEASURED ? 'Not measured' : `${v} spm`}
        onConfirm={v => { setCadence(v); setShowCadencePicker(false); }}
        onClose={() => setShowCadencePicker(false)}
      />
    </Modal>
  );
}

// ─── Submit for Analysis card ─────────────────────────────────────────────────

function SubmitForAnalysisCard({
  videoId,
  submitted,
  status,
}: {
  videoId:   string;
  submitted: boolean;
  status:    string | null | undefined;
}) {
  if (submitted) {
    const statusLabel =
      status === 'in_review' ? 'In Review' :
      status === 'complete'  ? 'Complete'  :
      'Pending';

    const statusColor =
      status === 'complete'  ? colors.positive :
      status === 'in_review' ? colors.warning  :
      colors.textMuted;

    return (
      <View style={sub.card}>
        <Text style={sub.cardLabel}>ANALYSIS SUBMISSION</Text>
        <View style={sub.statusRow}>
          <View style={[sub.dot, { backgroundColor: statusColor }]} />
          <Text style={[sub.statusTxt, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={sub.desc}>
          Your video has been submitted. You'll receive coach feedback here once the analysis is complete.
        </Text>
      </View>
    );
  }

  return (
    <View style={sub.card}>
      <Text style={sub.cardLabel}>PROFESSIONAL ANALYSIS</Text>
      <Text style={sub.heading}>Coach Review — Coming Soon</Text>
      <Text style={sub.desc}>
        Submit your video to receive a detailed analysis from a running coach — personalized findings,
        corrective drills, and training recommendations.
      </Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

const HIT_SLOP = { top: 12, bottom: 12, left: 16, right: 16 } as const;

export default function VideoDetailScreen() {
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
    updateVideo,
  } = useMovementStore();

  const video   = videos.find(v => v.id === videoId);
  const session = getVideoSession(videoId ?? '');

  const [tab,              setTab]              = useState<Tab>('overview');
  const [showGaitModal,    setShowGaitModal]    = useState(false);
  const [videoSource,      setVideoSource]      = useState<string | null>(null);
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  const player = useVideoPlayer(videoSource);

  // Try local URI first (verify file exists); fall back to Supabase signed URL
  useEffect(() => {
    if (!video) return;
    const uri = resolveDocumentUri(video.uri) ?? video.uri;

    const fetchSignedUrl = () => {
      if (!video.storagePath) { setVideoUnavailable(true); return; }
      supabase.storage
        .from('movement-videos')
        .createSignedUrl(video.storagePath, 3600)
        .then(({ data, error }) => {
          if (!error && data?.signedUrl) setVideoSource(data.signedUrl);
          else setVideoUnavailable(true);
        });
    };

    if (uri && (uri.startsWith('file://') || uri.startsWith('content://'))) {
      FileSystem.getInfoAsync(uri)
        .then(info => {
          if (info.exists) setVideoSource(uri);
          else fetchSignedUrl();
        })
        .catch(() => fetchSignedUrl());
      return;
    }
    fetchSignedUrl();
  }, [video?.uri, video?.storagePath]);

  if (!video) {
    return (
      <View style={s.notFound}>
        <Text style={s.notFoundTxt}>Analysis not found</Text>
        <Pressable onPress={() => router.back()}><Text style={s.back}>← Back</Text></Pressable>
      </View>
    );
  }

  const currentVideo = video;
  const gait     = session?.gaitAnalysis;
  const findings = session?.gaitFindings ?? [];
  const flags    = session?.riskFlags    ?? [];

  function handleSaveGait(g: GaitAnalysis) {
    ensureSession(videoId!);
    updateGaitAnalysis(videoId!, g);
    const suggested = suggestGaitFindings(g);
    for (const f of suggested) addGaitFinding(videoId!, f);
  }

  function handleDelete() {
    const doDelete = () => {
      // Remove from Supabase Storage if we have a path
      if (currentVideo.storagePath) {
        supabase.storage.from('movement-videos').remove([currentVideo.storagePath]);
      }
      deleteVideo(videoId!);
      router.back();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Remove this analysis record?')) doDelete();
    } else {
      Alert.alert('Delete Analysis', 'Remove this analysis record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
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
  const trainingInfluences = getMovementTrainingInfluences(flags);

  return (
    <View style={s.root}>
      {/* Nav bar */}
      <View style={[s.nav, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={HIT_SLOP}>
          <Text style={s.navBack}>‹ Back</Text>
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={HIT_SLOP}>
          <Text style={s.navDelete}>Delete</Text>
        </Pressable>
      </View>

      {/* Video player */}
      {videoSource ? (
        <View style={s.videoContainer}>
          <VideoView
            player={player}
            style={s.video}
            contentFit="contain"
            nativeControls
          />
        </View>
      ) : videoUnavailable ? (
        <View style={s.videoPlaceholder}>
          <Text style={s.videoPlaceholderTxt}>Video unavailable</Text>
        </View>
      ) : (video?.storagePath || video?.uri) ? (
        <View style={s.videoPlaceholder}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.videoPlaceholderTxt}>Loading video…</Text>
        </View>
      ) : null}

      {/* Title */}
      <View style={s.titleSection}>
        <Text style={s.videoTitle}>{currentVideo.title}</Text>
        <Text style={s.videoMeta}>{currentVideo.date} · {currentVideo.activity}</Text>
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
              {video.shoes   ? <View style={s.infoRow}><Text style={s.infoKey}>Shoes</Text><Text style={s.infoVal}>{video.shoes}</Text></View>   : null}
              {video.surface ? <View style={s.infoRow}><Text style={s.infoKey}>Surface</Text><Text style={s.infoVal}>{video.surface}</Text></View> : null}
              {video.notes   ? <View style={s.infoRow}><Text style={s.infoKey}>Notes</Text><Text style={s.infoVal}>{video.notes}</Text></View>    : null}
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

            <View style={s.focusCard}>
              <Text style={s.cardLabel}>TRAINING FOCUS — WHAT THIS MEANS</Text>
              {trainingInfluences.length === 0 ? (
                <Text style={s.emptyNote}>
                  Run the gait checklist to get personalized coaching focus areas here.
                </Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {trainingInfluences.map((influence, i) => (
                    <View key={i} style={s.focusRow}>
                      <View style={[s.focusBadge, { backgroundColor: FOCUS_COLOR[influence.category] + '22' }]}>
                        <Text style={[s.focusBadgeTxt, { color: FOCUS_COLOR[influence.category] }]}>
                          {FOCUS_LABEL[influence.category]}
                        </Text>
                      </View>
                      <Text style={s.focusMsg}>{influence.message}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <SubmitForAnalysisCard
              videoId={videoId!}
              submitted={video.submittedForAnalysis ?? false}
              status={video.analysisStatus}
            />

            <Pressable
              style={s.actionBtn}
              onPress={() => router.push({
                pathname: '/(tabs)/coach',
                params: { ask: `Review my movement video: ${currentVideo.title}.` },
              } as never)}
            >
              <Text style={s.actionBtnTxt}>Discuss with AI Coach</Text>
            </Pressable>

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
            {!gait && (
              <View style={s.introCard}>
                <Text style={s.introTitle}>Gait Checklist</Text>
                <Text style={s.introMeta}>~1 minute · 6 quick taps</Text>
                <Text style={s.introDesc}>
                  Rate footstrike, cadence, and hip/knee control from this video — no measuring or
                  diagnosis required. These answers drive the coaching findings and training focus below.
                </Text>
              </View>
            )}

            <Pressable style={s.actionBtn} onPress={() => setShowGaitModal(true)}>
              <Text style={s.actionBtnTxt}>{gait ? 'Update Gait Checklist' : 'Run Gait Checklist'}</Text>
            </Pressable>

            {gait ? (
              <View style={s.gaitSummary}>
                <Text style={s.cardLabel}>GAIT DATA</Text>
                <View style={s.infoRow}><Text style={s.infoKey}>Foot strike</Text><Text style={s.infoVal}>{gait.footStrike}</Text></View>
                {gait.cadence    != null ? <View style={s.infoRow}><Text style={s.infoKey}>Cadence</Text><Text style={s.infoVal}>{gait.cadence} spm</Text></View> : null}
                {gait.overstride != null ? <View style={s.infoRow}><Text style={s.infoKey}>Overstride</Text><Text style={s.infoVal}>{gait.overstride ? 'Yes' : 'No'}</Text></View> : null}
                {gait.hipDrop    != null ? <View style={s.infoRow}><Text style={s.infoKey}>Hip drop</Text><Text style={s.infoVal}>{gait.hipDrop ?? 'Unknown'}</Text></View> : null}
                {gait.crossoverGait != null ? <View style={s.infoRow}><Text style={s.infoKey}>Crossover</Text><Text style={s.infoVal}>{gait.crossoverGait ? 'Yes' : 'No'}</Text></View> : null}
                {gait.kneeValgus != null ? <View style={s.infoRow}><Text style={s.infoKey}>Knee valgus</Text><Text style={s.infoVal}>{gait.kneeValgus ?? 'Unknown'}</Text></View> : null}
              </View>
            ) : null}

            {findings.length === 0 ? (
              <Text style={s.emptyNote}>No findings yet. Run the gait checklist to generate observations.</Text>
            ) : (
              <View style={s.findingsList}>
                <Text style={s.cardLabel}>FINDINGS ({findings.length})</Text>
                {findings.map(f => <FindingCard key={f.id} finding={f} />)}
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
  root:       { flex: 1, backgroundColor: colors.bg },
  notFound:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  notFoundTxt:{ color: colors.textMuted, fontSize: FontSize.base },
  back:       { color: colors.primary, fontSize: FontSize.base },
  nav: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.sm,
  },
  navBack:   { color: colors.primary,  fontSize: FontSize.base },
  navDelete: { color: colors.critical, fontSize: FontSize.base },
  videoContainer: {
    width:           '100%',
    height:          220,
    backgroundColor: '#000',
  },
  video: {
    width:  '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width:           '100%',
    height:          120,
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    flexDirection:   'row',
  },
  videoPlaceholderTxt: { color: colors.textMuted, fontSize: FontSize.sm },
  titleSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: 2 },
  videoTitle:   { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  videoMeta:    { color: colors.textMuted, fontSize: FontSize.xs },
  tabBar: {
    flexDirection:     'row',
    paddingHorizontal: spacing.lg,
    gap:               spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom:     spacing.sm,
  },
  tabItem: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      20,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
  },
  tabItemActive: { backgroundColor: colors.primaryDim },
  tabTxt:        { color: colors.textMuted, fontSize: FontSize.sm },
  tabTxtActive:  { color: colors.primary, fontWeight: FontWeight.bold },
  tabBadge: {
    backgroundColor:   colors.critical,
    borderRadius:      8,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  tabBadgeTxt:     { color: colors.text, fontSize: 9, fontWeight: FontWeight.black },
  body:            { flex: 1 },
  bodyContent:     { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  section:         { gap: spacing.md },
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
  infoRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  infoKey:  { color: colors.textSubtle, fontSize: FontSize.sm },
  infoVal:  { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
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
  statNum:   { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black },
  statLabel: { color: colors.textMuted, fontSize: FontSize.xs },
  disclaimer: {
    backgroundColor: colors.card,
    borderRadius:    10,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  disclaimerTxt:  { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  focusCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  focusRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  focusBadge:    { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  focusBadgeTxt: { fontSize: 10, fontWeight: FontWeight.black },
  focusMsg:      { flex: 1, color: colors.text, fontSize: FontSize.sm, lineHeight: 19 },
  introCard: {
    backgroundColor: colors.primaryDim,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.primary + '44',
    gap:             2,
  },
  introTitle: { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  introMeta:  { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: 4 },
  introDesc:  { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  actionBtnTxt:   { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  gaitSummary: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  emptyNote:    { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18 },
  findingsList: { gap: spacing.sm },
  comingSoonCard: {
    backgroundColor: colors.primaryDim,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.primary + '44',
    gap:             spacing.xs,
  },
  comingSoonTitle: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  comingSoonDesc:  { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  angleCard: {
    backgroundColor: colors.card,
    borderRadius:    10,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
  },
  angleLabel: { color: colors.textMuted, fontSize: FontSize.sm, textTransform: 'capitalize' },
  angleVal:   { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.black },
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
  recTxt:   { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
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
  title:     { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  body:      { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  dismissBtn: {
    alignSelf:         'flex-start',
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  dismissTxt: { color: colors.textMuted, fontSize: FontSize.xs },
});

const gc = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel:   { color: colors.textMuted, fontSize: FontSize.base },
  title:    { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  save:     { color: colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  headerCenter: { alignItems: 'center' },
  progress: { color: colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueTxt: { color: colors.textMuted, fontSize: FontSize.sm },
  chevron:  { color: colors.textSubtle, fontSize: FontSize.base },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
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
  pillTxt:   { color: colors.textDim, fontSize: FontSize.xs },
  pillOnTxt: { color: colors.primary, fontWeight: FontWeight.bold },
  numInput: {
    backgroundColor:   colors.card,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.border,
    color:             colors.text,
    fontSize:          FontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    minWidth:          64,
    textAlign:         'right',
  },
});

const sub = StyleSheet.create({
  card: {
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
  },
  heading: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  desc: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 18,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  statusTxt:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  comingSoon: {
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    padding:         spacing.md,
    alignItems:      'center',
  },
  comingSoonTxt: { color: colors.textMuted, fontSize: FontSize.xs },
});
