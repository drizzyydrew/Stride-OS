import React, { useCallback, useEffect, useRef, type PropsWithChildren } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';

import { useFeatureTourRegistry } from './FeatureTourProvider';
import type { FeatureTourRect } from '../../utils/featureTours';

type Props = PropsWithChildren<{
  targetId: string;
  style?: ViewStyle | ViewStyle[];
}>;

export default function FeatureTourTarget({ targetId, style, children }: Props) {
  const ref = useRef<View>(null);
  const { registerTarget } = useFeatureTourRegistry();

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

  useEffect(() => registerTarget(targetId, { measure }), [measure, registerTarget, targetId]);

  function onLayout(_event: LayoutChangeEvent) {
    // Registration uses measureInWindow so tours can target the rendered screen
    // position after safe areas, tabs, and scroll offsets are applied.
  }

  return (
    <View ref={ref} collapsable={false} onLayout={onLayout} style={style}>
      {children}
    </View>
  );
}
