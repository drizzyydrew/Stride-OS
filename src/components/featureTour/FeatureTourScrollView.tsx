import React, { createContext, forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useRef } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { scrollOffsetForTourTarget, type FeatureTourRect } from '../../utils/featureTours';

type ScrollContext = { reveal: (target: View | null, current: () => boolean) => Promise<void> };
const FeatureTourScrollContext = createContext<ScrollContext | null>(null);
export const useFeatureTourScroll = () => useContext(FeatureTourScrollContext);

function measure(node: View | ScrollView | null): Promise<FeatureTourRect | null> {
  return new Promise(resolve => {
    const nativeNode = node && 'getNativeScrollRef' in node ? node.getNativeScrollRef() : node;
    if (!nativeNode?.measureInWindow) { resolve(null); return; }
    nativeNode.measureInWindow((x, y, width, height) => resolve(
      [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}

/** Same native ScrollView; adds a nearest-scroll-container reveal contract for
 * walkthrough targets. Existing refs, scroll handlers and keyboard props pass on.
 */
const FeatureTourScrollView = forwardRef<ScrollView, ScrollViewProps>(function FeatureTourScrollView(
  { children, onScroll, scrollEventThrottle, ...props }, forwardedRef,
) {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  useImperativeHandle(forwardedRef, () => ref.current!, []);
  const reveal = useCallback(async (target: View | null, current: () => boolean) => {
    const [rect, viewport] = await Promise.all([measure(target), measure(ref.current)]);
    if (!rect || !viewport || !current()) return;
    const y = scrollOffsetForTourTarget(rect, viewport, offset.current);
    if (y !== offset.current) {
      offset.current = y;
      ref.current?.scrollTo({ y, animated: false });
    }
  }, []);
  const value = useMemo(() => ({ reveal }), [reveal]);
  const content = <ScrollView {...props} ref={ref} removeClippedSubviews={props.removeClippedSubviews ?? false} scrollEventThrottle={scrollEventThrottle ?? 16}
      onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}>
      {children}
    </ScrollView>;
  // A horizontal rail does not replace its vertical parent's reveal contract.
  return props.horizontal ? content : <FeatureTourScrollContext.Provider value={value}>{content}</FeatureTourScrollContext.Provider>;
});
export default FeatureTourScrollView;
