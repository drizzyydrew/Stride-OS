import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LANDMARK_CONFIDENCE_FLOOR, SKELETON_CONNECTIONS } from '../../utils/poseAngles';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { PoseLandmarkRecord } from '../../types/movement';
import { displayLabel } from '../../utils/displayLabels';
import {
  clampMarkerCoordinate,
  normalizedMarkerFromDrag,
} from '../../utils/markerEditing';

type Props = {
  imageUri: string;
  aspectRatio: number;
  autoLandmarks: PoseLandmarkRecord[];
  landmarks: PoseLandmarkRecord[];
  allowedLandmarkNames?: string[];
  visibleConnections?: [string, string][];
  onCancel: () => void;
  onSave: (landmarks: PoseLandmarkRecord[], corrected: boolean) => void;
};

const EDITABLE_SUFFIXES = ['shoulder', 'hip', 'knee', 'ankle'];
const DEFAULT_EDITABLE_NAMES = new Set(
  ['left', 'right'].flatMap(side => EDITABLE_SUFFIXES.map(suffix => `${side}_${suffix}`)),
);
const HANDLE_SIZE = 44;

function sameLandmarks(a: PoseLandmarkRecord[], b: PoseLandmarkRecord[]): boolean {
  if (a.length !== b.length) return false;
  const byName = new Map(b.map(item => [item.name, item]));
  return a.every(item => {
    const other = byName.get(item.name);
    return other
      && Math.abs(item.x - other.x) < 0.001
      && Math.abs(item.y - other.y) < 0.001
      && Math.abs(item.confidence - other.confidence) < 0.001;
  });
}

type HandleProps = {
  joint: PoseLandmarkRecord;
  selected: boolean;
  width: number;
  height: number;
  onSelect: (name: string) => void;
  onMove: (name: string, x: number, y: number) => void;
};

function MarkerHandle({ joint, selected, width, height, onSelect, onMove }: HandleProps) {
  // Latest joint position, read once at gesture grant. The drag math is
  // grant-position + cumulative dx/dy — start must NOT resync on every move
  // or the marker double-counts and accelerates away from the finger.
  const jointPos = useRef({ x: joint.x, y: joint.y });
  useEffect(() => {
    jointPos.current = { x: joint.x, y: joint.y };
  });
  const start = useRef({ x: joint.x, y: joint.y });

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = { x: jointPos.current.x, y: jointPos.current.y };
        onSelect(joint.name);
      },
      onPanResponderMove: (_, gesture) => {
        const next = normalizedMarkerFromDrag(start.current, { dx: gesture.dx, dy: gesture.dy }, { width, height });
        onMove(
          joint.name,
          next.x,
          next.y,
        );
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }),
    [height, joint.name, onMove, onSelect, width],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${displayLabel(joint.name)} marker`}
      accessibilityHint="Drag, or use the accessibility actions, to adjust this landmark position."
      accessibilityActions={[
        { name: 'moveUp', label: 'Move up' },
        { name: 'moveDown', label: 'Move down' },
        { name: 'moveLeft', label: 'Move left' },
        { name: 'moveRight', label: 'Move right' },
      ]}
      onAccessibilityAction={event => {
        const step = 0.01;
        const { x, y } = jointPos.current;
        if (event.nativeEvent.actionName === 'moveUp') onMove(joint.name, x, clampMarkerCoordinate(y - step));
        if (event.nativeEvent.actionName === 'moveDown') onMove(joint.name, x, clampMarkerCoordinate(y + step));
        if (event.nativeEvent.actionName === 'moveLeft') onMove(joint.name, clampMarkerCoordinate(x - step), y);
        if (event.nativeEvent.actionName === 'moveRight') onMove(joint.name, clampMarkerCoordinate(x + step), y);
        onSelect(joint.name);
      }}
      style={[
        styles.handle,
        {
          left: joint.x * width - HANDLE_SIZE / 2,
          top: joint.y * height - HANDLE_SIZE / 2,
        },
        selected && styles.handleSelected,
      ]}
    >
      <View style={styles.handleDot} />
    </View>
  );
}

export default function LandmarkEditor({
  imageUri,
  aspectRatio,
  autoLandmarks,
  landmarks,
  allowedLandmarkNames,
  visibleConnections,
  onCancel,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const allowedNames = useMemo(
    () => new Set(allowedLandmarkNames ?? [...DEFAULT_EDITABLE_NAMES]),
    [allowedLandmarkNames],
  );
  const initialNames = useMemo(() => new Set(landmarks.map(item => item.name)), [landmarks]);
  const [draft, setDraft] = useState<PoseLandmarkRecord[]>(landmarks);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(
    landmarks.find(joint => allowedNames.has(joint.name))?.name ?? null,
  );

  const draftByName = useMemo(() => new Map(draft.map(joint => [joint.name, joint])), [draft]);
  const autoByName = useMemo(() => new Map(autoLandmarks.map(joint => [joint.name, joint])), [autoLandmarks]);
  const editable = draft.filter(joint => allowedNames.has(joint.name));
  const availableStageWidth = Math.max(120, window.width - spacing.lg * 2);
  const availableStageHeight = Math.max(
    160,
    window.height - insets.top - insets.bottom - 210,
  );
  const stageWidth = Math.max(
    120,
    Math.min(availableStageWidth, availableStageHeight * aspectRatio),
  );
  const stageHeight = stageWidth / Math.max(0.1, aspectRatio);

  function updateJoint(name: string, x: number, y: number) {
    setDraft(prev => prev.map(joint =>
      joint.name === name ? { ...joint, x, y, confidence: Math.max(joint.confidence, 0.9) } : joint,
    ));
  }

  function resetMarker() {
    if (!selected) return;
    const auto = autoByName.get(selected);
    if (!auto) return;
    setDraft(prev => prev.map(joint => joint.name === selected ? { ...auto } : joint));
  }

  function resetAll() {
    setDraft(autoLandmarks.filter(joint => initialNames.has(joint.name)).map(joint => ({ ...joint })));
  }

  function save() {
    onSave(draft, !sameLandmarks(draft, autoLandmarks));
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={[styles.modalRoot, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalEyebrow}>LOCKED EDIT MODE</Text>
            <Text style={styles.modalTitle}>Adjust Markers</Text>
          </View>
          <Text style={styles.modalHint}>Video and navigation are paused</Text>
        </View>
      <View
        style={[styles.stage, { width: stageWidth, height: stageHeight }]}
        onLayout={event => setSize({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })}
      >
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        {size ? (
          <>
            <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
              {(visibleConnections ?? SKELETON_CONNECTIONS).map(([a, b]) => {
                const ja = draftByName.get(a);
                const jb = draftByName.get(b);
                if (!ja || !jb || ja.confidence < LANDMARK_CONFIDENCE_FLOOR || jb.confidence < LANDMARK_CONFIDENCE_FLOOR) return null;
                return (
                  <Line
                    key={`${a}-${b}`}
                    x1={ja.x * size.w}
                    y1={ja.y * size.h}
                    x2={jb.x * size.w}
                    y2={jb.y * size.h}
                    stroke={colors.primary}
                    strokeWidth={2}
                    strokeOpacity={0.8}
                  />
                );
              })}
              {draft.map(joint => (
                <Circle
                  key={joint.name}
                  cx={joint.x * size.w}
                  cy={joint.y * size.h}
                  r={4}
                  fill={allowedNames.has(joint.name) ? colors.primary : 'none'}
                  stroke={colors.primary}
                  strokeWidth={1.5}
                  opacity={allowedNames.has(joint.name) ? 0.85 : 0.35}
                />
              ))}
            </Svg>
            {editable.map(joint => (
              <MarkerHandle
                key={joint.name}
                joint={joint}
                selected={selected === joint.name}
                width={size.w}
                height={size.h}
                onSelect={setSelected}
                onMove={updateJoint}
              />
            ))}
          </>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Text style={styles.selected}>{selected ? displayLabel(selected) : 'Select marker'}</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={styles.cancelBtn}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel marker adjustments"
          >
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={resetAll}
            accessibilityRole="button"
            accessibilityLabel="Reset all markers to automatic positions"
          >
            <Text style={styles.secondaryTxt}>Reset</Text>
          </Pressable>
          <Pressable
            style={styles.saveBtn}
            onPress={save}
            accessibilityRole="button"
            accessibilityLabel="Save marker adjustments"
          >
            <Text style={styles.saveTxt}>Save</Text>
          </Pressable>
        </View>
        {selected ? (
          <Pressable
            style={styles.resetMarkerBtn}
            onPress={resetMarker}
            accessibilityRole="button"
            accessibilityLabel={`Reset ${displayLabel(selected)} marker`}
          >
            <Text style={styles.secondaryTxt}>Reset active marker</Text>
          </Pressable>
        ) : null}
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, gap: spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  modalEyebrow: { color: colors.primary, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.8 },
  modalTitle: { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black },
  modalHint: { color: colors.textMuted, fontSize: FontSize.xs, textAlign: 'right', flexShrink: 1 },
  stage: {
    alignSelf:       'center',
    borderRadius:    Radius.md,
    overflow:        'hidden',
    backgroundColor: '#000',
  },
  image: {
    width:  '100%',
    height: '100%',
  },
  handle: {
    position:       'absolute',
    width:          HANDLE_SIZE,
    height:         HANDLE_SIZE,
    borderRadius:   HANDLE_SIZE / 2,
    alignItems:     'center',
    justifyContent: 'center',
  },
  handleSelected: {
    backgroundColor: colors.primaryDim,
  },
  handleDot: {
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: colors.primary,
    borderWidth:     2,
    borderColor:     '#FFFFFF',
  },
  controls: { gap: spacing.sm },
  selected: {
    color:         colors.text,
    fontSize:      FontSize.sm,
    fontWeight:    FontWeight.bold,
    textTransform: 'capitalize',
  },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  secondaryBtn: {
    flexGrow:          1,
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    minHeight:         44,
    paddingVertical:   spacing.sm,
    alignItems:        'center',
    justifyContent:    'center',
  },
  secondaryTxt: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  cancelBtn: {
    flexGrow:          1,
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    minHeight:         44,
    alignItems:        'center',
  },
  cancelTxt: { color: colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  saveBtn: {
    flexGrow:          1,
    backgroundColor:   colors.primary,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    minHeight:         44,
    alignItems:        'center',
  },
  saveTxt: { color: colors.onPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  resetMarkerBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
