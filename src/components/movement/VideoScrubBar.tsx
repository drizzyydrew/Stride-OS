// ─── Video Scrub Bar ────────────────────────────────────────────────────────────
//
// Minimal PanResponder-based scrub bar — the repo has no slider dependency and
// this task may not add new npm packages. Reports a 0…1 fraction while
// dragging (onScrub) and on release (onScrubEnd) so the caller can seek the
// video player live and commit the final position.

import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { colors } from '../../theme/colors';

type Props = {
  progress:    number;              // 0…1, ignored while the user is dragging
  onScrub:     (fraction: number) => void;
  onScrubEnd?: (fraction: number) => void;
  markers?:    number[];            // 0…1 positions — e.g. key frames
};

const TRACK_HEIGHT = 4;
const THUMB_SIZE    = 16;

export default function VideoScrubBar({ progress, onScrub, onScrubEnd, markers }: Props) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState(0);
  const widthRef = useRef(0);

  function handleLayout(e: LayoutChangeEvent) {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  }

  function fractionFromX(x: number): number {
    const w = widthRef.current;
    if (w <= 0) return 0;
    return Math.min(1, Math.max(0, x / w));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setDragging(true);
        const f = fractionFromX(evt.nativeEvent.locationX);
        setDragFraction(f);
        onScrub(f);
      },
      onPanResponderMove: (evt) => {
        const f = fractionFromX(evt.nativeEvent.locationX);
        setDragFraction(f);
        onScrub(f);
      },
      onPanResponderRelease: (evt) => {
        const f = fractionFromX(evt.nativeEvent.locationX);
        setDragging(false);
        onScrubEnd?.(f);
      },
      onPanResponderTerminate: () => setDragging(false),
    }),
  ).current;

  const shown = dragging ? dragFraction : Math.min(1, Math.max(0, progress));

  return (
    <View style={styles.wrap} {...panResponder.panHandlers} onLayout={handleLayout}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${shown * 100}%` }]} />
        {markers?.map((m, i) => (
          <View key={i} style={[styles.marker, { left: `${Math.min(100, Math.max(0, m * 100))}%` }]} />
        ))}
      </View>
      {width > 0 && (
        <View
          style={[
            styles.thumb,
            { left: Math.min(width - THUMB_SIZE, Math.max(0, shown * width - THUMB_SIZE / 2)) },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height:          28,
    justifyContent:  'center',
    paddingVertical: 8,
  },
  track: {
    height:          TRACK_HEIGHT,
    borderRadius:    TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
    overflow:        'visible',
  },
  fill: {
    height:          TRACK_HEIGHT,
    borderRadius:    TRACK_HEIGHT / 2,
    backgroundColor: colors.primary,
  },
  marker: {
    position:        'absolute',
    top:             -2,
    width:           2,
    height:          TRACK_HEIGHT + 4,
    backgroundColor: colors.textSubtle,
  },
  thumb: {
    position:        'absolute',
    top:             (28 - THUMB_SIZE) / 2,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    borderRadius:    THUMB_SIZE / 2,
    backgroundColor: colors.primary,
  },
});
