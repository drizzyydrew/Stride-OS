import React, { useCallback, useEffect, useRef, type PropsWithChildren } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useFeatureTourRegistry } from './FeatureTourProvider';
import type { FeatureTourRect } from '../../utils/featureTours';
import { useFeatureTourScroll } from './FeatureTourScrollView';

type Props = PropsWithChildren<{
  targetId: string;
  style?: ViewStyle | ViewStyle[];
  onActivate?: () => void;
}>;

export default function FeatureTourTarget({ targetId, style, onActivate, children }: Props) {
  const ref = useRef<View>(null);
  const { registerTarget } = useFeatureTourRegistry();
  const scroll = useFeatureTourScroll();
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;

  const measure = useCallback(() => new Promise<FeatureTourRect | null>((resolve) => {
    const node = ref.current;
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  }), []);

  useEffect(() => registerTarget(targetId, { measure,
    reveal: scroll ? current => scroll.reveal(ref.current, current) : undefined,
    activate: onActivate ? () => activateRef.current?.() : undefined,
  }), [measure, registerTarget, targetId, scroll, !!onActivate]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
