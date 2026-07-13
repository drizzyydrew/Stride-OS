// ─── Timed Capture Camera ────────────────────────────────────────────────────
//
// Expo SDK 56 CameraView workflow:
// live setup preview → explicit start → countdown → capture → review.
// Camera facing can change only during setup. CameraView mirror=false keeps the
// saved media orientation known so anatomical left/right is never silently
// reversed.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';
import type { Palette } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import { COUNTDOWN_SECONDS } from '../../constants/captureConfig';
import type { DionAssessmentImages } from '../../constants/dionImages';
import {
  canFlipCamera,
  canStartCapture,
  captureMetadataForFacing,
  DEFAULT_CAMERA_FACING,
  type CaptureStage,
} from '../../utils/captureWorkflow';

export type TimedCaptureResult = {
  uri: string;
  type: 'video' | 'photo';
  width?: number;
  height?: number;
  captureMetadata: ReturnType<typeof captureMetadataForFacing>;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onCaptured: (result: TimedCaptureResult) => void;
  dion: DionAssessmentImages;
  title: string;
  durationSec: number;
  countdownSec?: number;
  captureMode?: 'video' | 'photo';
};

function CaptureReview({ result }: { result: TimedCaptureResult }) {
  const player = useVideoPlayer(result.type === 'video' ? result.uri : null, instance => {
    instance.loop = true;
    if (result.type === 'video') instance.play();
  });

  if (result.type === 'photo') {
    return <Image source={{ uri: result.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />;
  }
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

export default function TimedCaptureCamera({
  visible,
  onClose,
  onCaptured,
  dion,
  title,
  durationSec,
  countdownSec = COUNTDOWN_SECONDS,
  captureMode = 'video',
}: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [stage, setStage] = useState<CaptureStage>('requesting_permission');
  const [facing, setFacing] = useState<CameraType>(DEFAULT_CAMERA_FACING);
  const [countdown, setCountdown] = useState(countdownSec);
  const [remaining, setRemaining] = useState(durationSec);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<TimedCaptureResult | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const mountedRef = useRef(true);
  const discardRef = useRef(false);
  const capturePromiseRef = useRef(false);
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
    if (capturePromiseRef.current && captureMode === 'video') cameraRef.current?.stopRecording();
  }, [captureMode, clearTimers]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAndDiscard();
    };
  }, [stopAndDiscard]);

  useEffect(() => {
    if (!visible) {
      stopAndDiscard();
      return;
    }

    let cancelled = false;
    discardRef.current = false;
    capturePromiseRef.current = false;
    setFacing(DEFAULT_CAMERA_FACING);
    setCountdown(countdownSec);
    setRemaining(durationSec);
    setCameraReady(false);
    setCameraActive(true);
    setReviewResult(null);
    setErrorMessage(null);
    setStage('requesting_permission');

    void (async () => {
      const cam = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      const mic = captureMode === 'photo'
        ? { granted: true }
        : micPermission?.granted ? micPermission : await requestMicPermission();
      if (cancelled) return;
      setStage(cam.granted && mic.granted ? 'setup' : 'permission_denied');
    })();

    return () => { cancelled = true; };
    // Permission objects change after their request promises resolve; reopening
    // the modal is the only event that should restart this preparation flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', nextState => {
      const active = nextState === 'active';
      setCameraActive(active);
      if (active) return;
      if (stage === 'countdown' || stage === 'recording' || stage === 'capturing_photo') {
        stopAndDiscard();
        if (mountedRef.current) {
          setErrorMessage('Capture stopped because StrideOS moved to the background. Return to setup and try again.');
          setStage('error');
        }
      }
    });
    return () => subscription.remove();
  }, [stage, stopAndDiscard, visible]);

  function flipCamera() {
    if (!canFlipCamera(stage)) return;
    setCameraReady(false);
    setFacing(current => current === 'front' ? 'back' : 'front');
  }

  function beginCountdown() {
    if (!canStartCapture(stage, cameraReady, capturePromiseRef.current)) return;
    clearTimers();
    setCountdown(countdownSec);
    setStage('countdown');
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(previous => {
        if (previous <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          void performCapture();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  }

  async function performCapture() {
    if (!cameraReady || !cameraRef.current || capturePromiseRef.current) {
      setErrorMessage('The camera is still starting. Return to setup and try again.');
      setStage('error');
      return;
    }
    capturePromiseRef.current = true;
    discardRef.current = false;

    if (captureMode === 'photo') {
      setStage('capturing_photo');
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, exif: false });
        capturePromiseRef.current = false;
        if (!mountedRef.current || discardRef.current || !photo?.uri) return;
        setReviewResult({
          uri: photo.uri,
          type: 'photo',
          width: photo.width,
          height: photo.height,
          captureMetadata: captureMetadataForFacing(facing),
        });
        setStage('review');
      } catch {
        capturePromiseRef.current = false;
        if (!mountedRef.current || discardRef.current) return;
        setErrorMessage('The camera could not capture this photo. Return to setup and try again.');
        setStage('error');
      }
      return;
    }

    setStage('recording');
    setRemaining(durationSec);
    remainingIntervalRef.current = setInterval(() => {
      setRemaining(previous => Math.max(0, previous - 1));
    }, 1000);
    stopTimeoutRef.current = setTimeout(() => cameraRef.current?.stopRecording(), durationSec * 1000 + 300);

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: durationSec });
      clearTimers();
      capturePromiseRef.current = false;
      if (!mountedRef.current || discardRef.current || !video?.uri) {
        if (mountedRef.current && visible) setStage('setup');
        return;
      }
      setReviewResult({
        uri: video.uri,
        type: 'video',
        captureMetadata: captureMetadataForFacing(facing),
      });
      setStage('review');
    } catch {
      clearTimers();
      capturePromiseRef.current = false;
      if (!mountedRef.current || discardRef.current) return;
      setErrorMessage('The camera could not finish this recording. Return to setup and try again.');
      setStage('error');
    }
  }

  function cancelActiveCapture() {
    stopAndDiscard();
    capturePromiseRef.current = false;
    discardRef.current = false;
    setCountdown(countdownSec);
    setRemaining(durationSec);
    setStage('setup');
  }

  function retake() {
    setReviewResult(null);
    discardRef.current = false;
    capturePromiseRef.current = false;
    setCountdown(countdownSec);
    setRemaining(durationSec);
    setStage('setup');
  }

  function useCapture() {
    if (!reviewResult) return;
    onCaptured(reviewResult);
  }

  function closeSafely() {
    stopAndDiscard();
    onClose();
  }

  const cameraVisible = ['setup', 'countdown', 'recording', 'capturing_photo'].includes(stage);
  const progress = stage === 'recording' ? 1 - remaining / Math.max(1, durationSec) : 0;
  const viewLabel = dion.viewLabel.replace('lateral', 'side').replace('frontal', 'front').replace('posterior', 'back');
  const requiredJoints = dion.mustBeVisible.slice(0, 5).join(', ');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeSafely}>
      <View style={s.root}>
        {stage === 'requesting_permission' ? (
          <View style={s.centerWrap}><Text style={s.permissionTxt}>Preparing camera preview…</Text></View>
        ) : null}

        {stage === 'permission_denied' ? (
          <View style={s.centerWrap}>
            <Ionicons name="videocam-off-outline" size={36} color={C.textMuted} />
            <Text style={s.permissionTitle}>{captureMode === 'video' ? 'Camera & microphone access needed' : 'Camera access needed'}</Text>
            <Text style={s.permissionTxt}>Enable access in Settings to continue with Movement Lab capture.</Text>
            <Pressable style={s.primaryBtn} onPress={() => Linking.openSettings()}><Text style={s.primaryBtnTxt}>Open Settings</Text></Pressable>
            <Pressable style={s.secondaryBtn} onPress={closeSafely}><Text style={s.secondaryBtnTxt}>Cancel</Text></Pressable>
          </View>
        ) : null}

        {stage === 'error' ? (
          <View style={s.centerWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={C.warning} />
            <Text style={s.permissionTitle}>Capture stopped</Text>
            <Text style={s.permissionTxt}>{errorMessage}</Text>
            <Pressable style={s.primaryBtn} onPress={() => { setErrorMessage(null); retake(); }}><Text style={s.primaryBtnTxt}>Return to Setup</Text></Pressable>
            <Pressable style={s.secondaryBtn} onPress={closeSafely}><Text style={s.secondaryBtnTxt}>Cancel</Text></Pressable>
          </View>
        ) : null}

        {cameraVisible ? (
          <View style={s.cameraWrap}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              active={cameraActive}
              mode={captureMode === 'photo' ? 'picture' : 'video'}
              facing={facing}
              mirror={false}
              onCameraReady={() => setCameraReady(true)}
              onMountError={event => {
                stopAndDiscard();
                setErrorMessage(event.message || 'The camera preview could not start.');
                setStage('error');
              }}
            />

            <View style={s.overlayTop}>
              <Pressable onPress={stage === 'setup' ? closeSafely : cancelActiveCapture} hitSlop={12} style={s.circleBtn}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              <View style={s.overlayTitleWrap}>
                <Text style={s.overlayTitle} numberOfLines={1}>{title}</Text>
                <Text style={s.overlaySub}>{viewLabel}</Text>
              </View>
              {stage === 'setup' ? (
                <Pressable onPress={flipCamera} hitSlop={12} style={s.circleBtn} accessibilityLabel="Flip camera">
                  <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
                </Pressable>
              ) : <View style={s.circleBtn} />}
            </View>

            {stage === 'setup' ? (
              <View style={s.setupPanel}>
                <Text style={s.setupHeading}>Position the phone before you start</Text>
                <Text style={s.setupText}>Keep your full body visible, including your head and both feet. Keep the phone stable and use the required direct view.</Text>
                {requiredJoints ? <Text style={s.setupMeta}>Visible joints: {requiredJoints}</Text> : null}
                <Text style={s.setupMeta}>Dion reference: match the {viewLabel.toLowerCase()} framing without covering the live preview.</Text>
                <Text style={s.setupMeta}>{captureMode === 'video' ? `${durationSec}-second recording` : 'Automatic photo'} · {facing === 'front' ? 'Front camera' : 'Rear camera'} · saved unmirrored</Text>
                <Pressable style={[s.captureBtn, !cameraReady && s.disabled]} onPress={beginCountdown} disabled={!cameraReady}>
                  <Ionicons name={captureMode === 'video' ? 'videocam' : 'camera'} size={20} color={C.onPrimary} />
                  <Text style={s.primaryBtnTxt}>{captureMode === 'video' ? 'Start Recording' : 'Take Photo'}</Text>
                </Pressable>
              </View>
            ) : null}

            {stage === 'countdown' ? (
              <View style={s.countdownWrap} pointerEvents="none">
                <Text style={s.countdownDigit}>{countdown}</Text>
                <Text style={s.countdownHint}>Get into position…</Text>
              </View>
            ) : null}

            {stage === 'capturing_photo' ? (
              <View style={s.countdownWrap} pointerEvents="none"><Text style={s.countdownHint}>Capturing…</Text></View>
            ) : null}

            {stage === 'recording' ? (
              <View style={s.recordingWrap}>
                <View style={s.recDot} />
                <Text style={s.remainingTxt}>{remaining}s remaining</Text>
                <View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} /></View>
              </View>
            ) : null}
          </View>
        ) : null}

        {stage === 'review' && reviewResult ? (
          <View style={s.reviewWrap}>
            <CaptureReview result={reviewResult} />
            <View style={s.reviewTop}>
              <Text style={s.overlayTitle}>Review {captureMode === 'video' ? 'Video' : 'Photo'}</Text>
              <Text style={s.overlaySub}>{reviewResult.captureMetadata.cameraFacing} camera · saved unmirrored</Text>
            </View>
            <View style={s.reviewActions}>
              <Pressable style={s.reviewSecondary} onPress={retake}><Text style={s.reviewSecondaryTxt}>Retake</Text></Pressable>
              <Pressable style={s.reviewPrimary} onPress={useCapture}><Text style={s.primaryBtnTxt}>Use {captureMode === 'video' ? 'Video' : 'Photo'}</Text></Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    centerWrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
    permissionTitle: { color: C.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
    permissionTxt: { color: C.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    primaryBtn: { width: '100%', backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
    primaryBtnTxt: { color: C.onPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    secondaryBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
    secondaryBtnTxt: { color: C.textMuted, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    cameraWrap: { flex: 1, backgroundColor: '#000' },
    overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.md, backgroundColor: 'rgba(0,0,0,0.38)' },
    circleBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.32)' },
    overlayTitleWrap: { flex: 1, alignItems: 'center' },
    overlayTitle: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold, textAlign: 'center' },
    overlaySub: { color: 'rgba(255,255,255,0.78)', fontSize: FontSize.xs, textTransform: 'capitalize' },
    setupPanel: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.xxl, borderRadius: Radius.md, backgroundColor: 'rgba(0,0,0,0.7)', padding: spacing.md, gap: spacing.xs },
    setupHeading: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
    setupText: { color: 'rgba(255,255,255,0.88)', fontSize: FontSize.sm, lineHeight: 19 },
    setupMeta: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.xs, lineHeight: 16 },
    captureBtn: { marginTop: spacing.sm, backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
    disabled: { opacity: 0.45 },
    countdownWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.15)' },
    countdownDigit: { color: '#fff', fontSize: 96, fontWeight: FontWeight.black },
    countdownHint: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
    recordingWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.38)' },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E0453D', alignSelf: 'center' },
    remainingTxt: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.black, textAlign: 'center' },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: '#fff' },
    reviewWrap: { flex: 1, backgroundColor: '#000' },
    reviewTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: spacing.xxl, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: 'rgba(0,0,0,0.45)' },
    reviewActions: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.xxl, flexDirection: 'row', gap: spacing.sm },
    reviewPrimary: { flex: 1, backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
    reviewSecondary: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: Radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
    reviewSecondaryTxt: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
  });
}
