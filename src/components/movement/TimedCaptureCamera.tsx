// ─── Timed Capture Camera ────────────────────────────────────────────────────
//
// Full-screen modal capture flow used by every Movement Lab / Readiness video
// step: Dion instruction screen → 5-second on-screen countdown → auto-start
// recording → auto-stop at the movement-specific duration → returns { uri }
// for the caller to run through the existing analysis pipeline immediately.
//
// Expo SDK 56 `expo-camera` CameraView, mode="video". API verified against
// https://docs.expo.dev/versions/v56.0.0/sdk/camera/ — recordAsync({
// maxDuration }) resolves with { uri } when stopRecording() is called or
// maxDuration (seconds) is reached; stopRecording() has no return value.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';
import type { Palette } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import { COUNTDOWN_SECONDS } from '../../constants/captureConfig';
import type { DionAssessmentImages } from '../../constants/dionImages';
import DionInstructionCard from './DionInstructionCard';

type Stage = 'instructions' | 'requesting_permission' | 'permission_denied' | 'countdown' | 'recording' | 'error';

type Props = {
  visible:      boolean;
  onClose:      () => void;
  onCaptured:   (result: { uri: string }) => void;
  dion:         DionAssessmentImages;
  /** e.g. "Bodyweight Squat" or "Single-Leg Squat — Left side" */
  title:        string;
  durationSec:  number;
  countdownSec?: number;
};

export default function TimedCaptureCamera({
  visible,
  onClose,
  onCaptured,
  dion,
  title,
  durationSec,
  countdownSec = COUNTDOWN_SECONDS,
}: Props) {
  const C = useColors();
  const s = makeStyles(C);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [stage, setStage] = useState<Stage>('instructions');
  const [countdown, setCountdown] = useState(countdownSec);
  const [remaining, setRemaining] = useState(durationSec);
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const discardRef = useRef(false);
  const recordingRef = useRef(false);
  const mountedRef = useRef(true);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (remainingIntervalRef.current) clearInterval(remainingIntervalRef.current);
    stopTimeoutRef.current = null;
    countdownIntervalRef.current = null;
    remainingIntervalRef.current = null;
  }, []);

  const stopAndDiscard = useCallback(() => {
    discardRef.current = true;
    clearTimers();
    if (recordingRef.current) cameraRef.current?.stopRecording();
    recordingRef.current = false;
  }, [clearTimers]);

  // Reset to a clean instructions screen every time the modal opens.
  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      setStage('instructions');
      setCountdown(countdownSec);
      setRemaining(durationSec);
      discardRef.current = false;
      recordingRef.current = false;
      setCameraReady(false);
      setErrorMessage(null);
    } else {
      stopAndDiscard();
    }
  }, [visible, countdownSec, durationSec, stopAndDiscard]);

  useEffect(() => () => {
    mountedRef.current = false;
    stopAndDiscard();
  }, [stopAndDiscard]);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') return;
      if (stage === 'countdown' || stage === 'recording') {
        stopAndDiscard();
        if (mountedRef.current) {
          setErrorMessage('Recording stopped because StrideOS moved to the background. Return to the setup and try again.');
          setStage('error');
        }
      }
    });
    return () => subscription.remove();
  }, [stage, stopAndDiscard, visible]);

  async function handleStart() {
    setStage('requesting_permission');
    const cam = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const mic = micPermission?.granted ? micPermission : await requestMicPermission();
    if (!cam.granted || !mic.granted) {
      setStage('permission_denied');
      return;
    }
    beginCountdown();
  }

  function beginCountdown() {
    setCountdown(countdownSec);
    setStage('countdown');
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function cancelCountdown() {
    clearTimers();
    setStage('instructions');
  }

  function startRecording() {
    if (recordingRef.current) return;
    if (!cameraReady || !cameraRef.current) {
      setErrorMessage('The camera is still starting. Return to setup and try again.');
      setStage('error');
      return;
    }
    discardRef.current = false;
    recordingRef.current = true;
    setStage('recording');
    setRemaining(durationSec);

    remainingIntervalRef.current = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    // Safety net — recordAsync's own maxDuration should stop it first, but a
    // JS-side stop guarantees the UI never outlives the configured duration.
    stopTimeoutRef.current = setTimeout(() => {
      cameraRef.current?.stopRecording();
    }, durationSec * 1000 + 300);

    cameraRef.current
      ?.recordAsync({ maxDuration: durationSec })
      .then(video => {
        clearTimers();
        recordingRef.current = false;
        if (!mountedRef.current) return;
        if (discardRef.current || !video?.uri) {
          setStage('instructions');
          return;
        }
        onCaptured({ uri: video.uri });
      })
      .catch(() => {
        clearTimers();
        recordingRef.current = false;
        if (!mountedRef.current || discardRef.current) return;
        setErrorMessage('The camera could not finish this recording. Return to setup and try again.');
        setStage('error');
      });
  }

  function cancelRecording() {
    discardRef.current = true;
    clearTimers();
    cameraRef.current?.stopRecording();
    recordingRef.current = false;
    setStage('instructions');
  }

  function closeSafely() {
    stopAndDiscard();
    onClose();
  }

  const progress = stage === 'recording' ? 1 - remaining / durationSec : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeSafely}>
      <View style={s.root}>
        {stage === 'instructions' && (
          <View style={s.instructionsWrap}>
            <View style={s.header}>
              <Pressable onPress={closeSafely} hitSlop={12} style={s.closeBtn}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
              <Text style={s.title} numberOfLines={2}>{title}</Text>
              <View style={{ width: 22 }} />
            </View>
            <DionInstructionCard dion={dion} variant="full" showPhaseStrip />
            <Text style={s.durationNote}>
              Records automatically for {durationSec} seconds after a {countdownSec}-second countdown.
            </Text>
            <Pressable style={s.primaryBtn} onPress={handleStart}>
              <Text style={s.primaryBtnTxt}>Start</Text>
            </Pressable>
          </View>
        )}

        {stage === 'requesting_permission' && (
          <View style={s.centerWrap}>
            <Text style={s.permissionTxt}>Requesting camera access…</Text>
          </View>
        )}

        {stage === 'permission_denied' && (
          <View style={s.centerWrap}>
            <Ionicons name="videocam-off-outline" size={36} color={C.textMuted} />
            <Text style={s.permissionTitle}>Camera & microphone access needed</Text>
            <Text style={s.permissionTxt}>
              StrideOS needs camera and microphone access to record this test. Enable both in Settings to continue.
            </Text>
            <Pressable style={s.primaryBtn} onPress={() => Linking.openSettings()}>
              <Text style={s.primaryBtnTxt}>Open Settings</Text>
            </Pressable>
            <Pressable style={s.secondaryBtn} onPress={closeSafely}>
              <Text style={s.secondaryBtnTxt}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {stage === 'error' && (
          <View style={s.centerWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={C.warning} />
            <Text style={s.permissionTitle}>Recording stopped</Text>
            <Text style={s.permissionTxt}>{errorMessage}</Text>
            <Pressable style={s.primaryBtn} onPress={() => { setErrorMessage(null); setStage('instructions'); }}>
              <Text style={s.primaryBtnTxt}>Return to Setup</Text>
            </Pressable>
            <Pressable style={s.secondaryBtn} onPress={closeSafely}>
              <Text style={s.secondaryBtnTxt}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {(stage === 'countdown' || stage === 'recording') && (
          <View style={s.cameraWrap}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              mode="video"
              facing="back"
              onCameraReady={() => setCameraReady(true)}
              onMountError={event => {
                stopAndDiscard();
                setErrorMessage(event.message || 'The camera preview could not start.');
                setStage('error');
              }}
            />

            <View style={s.overlayTop}>
              <Pressable
                onPress={stage === 'countdown' ? cancelCountdown : cancelRecording}
                hitSlop={12}
                style={s.overlayCloseBtn}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              <Text style={s.overlayTitle} numberOfLines={1}>{title}</Text>
              <View style={{ width: 22 }} />
            </View>

            {stage === 'countdown' && (
              <View style={s.countdownWrap} pointerEvents="none">
                <Text style={s.countdownDigit}>{countdown}</Text>
                <Text style={s.countdownHint}>Get in frame…</Text>
              </View>
            )}

            {stage === 'recording' && (
              <View style={s.recordingWrap}>
                <View style={s.recDot} />
                <Text style={s.remainingTxt}>{remaining}s remaining</Text>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    instructionsWrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.md, justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    closeBtn: { padding: 4 },
    title: { flex: 1, textAlign: 'center', color: C.text, fontSize: FontSize.lg, fontWeight: FontWeight.black },
    durationNote: { color: C.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    primaryBtn: {
      backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: spacing.md, alignItems: 'center',
    },
    primaryBtnTxt: { color: C.onPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    secondaryBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
    secondaryBtnTxt: { color: C.textMuted, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
    permissionTitle: { color: C.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
    permissionTxt: { color: C.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },

    cameraWrap: { flex: 1, backgroundColor: '#000' },
    overlayTop: {
      position: 'absolute', top: 0, left: 0, right: 0,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.md,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    overlayCloseBtn: { padding: 4 },
    overlayTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },

    countdownWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    countdownDigit: { color: '#fff', fontSize: 96, fontWeight: FontWeight.black },
    countdownHint: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.base, fontWeight: FontWeight.bold },

    recordingWrap: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E0453D', alignSelf: 'center' },
    remainingTxt: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.black, textAlign: 'center' },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: '#fff' },
  });
}
