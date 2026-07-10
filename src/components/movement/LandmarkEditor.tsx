import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { LANDMARK_CONFIDENCE_FLOOR, SKELETON_CONNECTIONS } from '../../utils/poseAngles';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { PoseLandmarkRecord } from '../../types/movement';

type Props = {
  imageUri: string;
  aspectRatio: number;
  autoLandmarks: PoseLandmarkRecord[];
  landmarks: PoseLandmarkRecord[];
  onCancel: () => void;
  onSave: (landmarks: PoseLandmarkRecord[], corrected: boolean) => void;
};

const EDITABLE_SUFFIXES = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'];
const EDITABLE_NAMES = new Set(
  ['left', 'right'].flatMap(side => EDITABLE_SUFFIXES.map(suffix => `${side}_${suffix}`)),
);
const HANDLE_SIZE = 30;

function displayName(name: string): string {
  return name.replace(/_/g, ' ');
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sameLandmarks(a: PoseLandmarkRecord[], b: PoseLandmarkRecord[]): boolean {
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
        onMove(
          joint.name,
          clamp01(start.current.x + gesture.dx / Math.max(1, width)),
          clamp01(start.current.y + gesture.dy / Math.max(1, height)),
        );
      },
    }),
    [height, joint.name, onMove, onSelect, width],
  );

  return (
    <View
      {...panResponder.panHandlers}
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
  onCancel,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<PoseLandmarkRecord[]>(landmarks);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(
    landmarks.find(joint => EDITABLE_NAMES.has(joint.name))?.name ?? null,
  );

  const draftByName = useMemo(() => new Map(draft.map(joint => [joint.name, joint])), [draft]);
  const autoByName = useMemo(() => new Map(autoLandmarks.map(joint => [joint.name, joint])), [autoLandmarks]);
  const editable = draft.filter(joint => EDITABLE_NAMES.has(joint.name));

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
    setDraft(autoLandmarks.map(joint => ({ ...joint })));
  }

  function save() {
    onSave(draft, !sameLandmarks(draft, autoLandmarks));
  }

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.stage, { aspectRatio }]}
        onLayout={event => setSize({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })}
      >
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        {size ? (
          <>
            <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
              {SKELETON_CONNECTIONS.map(([a, b]) => {
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
                  fill={EDITABLE_NAMES.has(joint.name) ? colors.primary : 'none'}
                  stroke={colors.primary}
                  strokeWidth={1.5}
                  opacity={EDITABLE_NAMES.has(joint.name) ? 0.85 : 0.35}
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
        <Text style={styles.selected}>{selected ? displayName(selected) : 'Select marker'}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryBtn} onPress={resetMarker} disabled={!selected}>
            <Text style={styles.secondaryTxt}>Reset Marker</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={resetAll}>
            <Text style={styles.secondaryTxt}>Reset All</Text>
          </Pressable>
        </View>
        <View style={styles.buttonRow}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveTxt}>Save Corrections</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  stage: {
    width:           '100%',
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
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  secondaryTxt: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  cancelBtn: {
    flexGrow:          1,
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    alignItems:        'center',
  },
  cancelTxt: { color: colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  saveBtn: {
    flexGrow:          1,
    backgroundColor:   colors.primary,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    alignItems:        'center',
  },
  saveTxt: { color: colors.onPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});

