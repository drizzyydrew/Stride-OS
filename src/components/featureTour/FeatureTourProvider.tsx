import { Ionicons } from '@expo/vector-icons';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';

import { useFeatureTourStore } from '../../store/featureTourStore';
import { useColors } from '../../theme/useColors';
import {
  FEATURE_TOUR_BY_ID,
  cardPlacementForTarget,
  featureTourAccessibilityLabel,
  getFeatureTour,
  highlightRectForTarget,
  nextStepIndex,
  previousStepIndex,
  shouldAutoStartTour,
  type FeatureTourId,
  type FeatureTourRect,
} from '../../utils/featureTours';
import { recordFeatureTourEvent } from '../../utils/featureTourEvents';
import { locateFeatureTourTarget, type FeatureTourTargetHandle } from '../../utils/feature-tour-runtime';

type TargetMeasurement = FeatureTourTargetHandle;

type FeatureTourContextValue = {
  registerTarget: (targetId: string, target: TargetMeasurement) => () => void;
  registerScreen: (tourId: FeatureTourId, prepare: (targetId: string) => void) => () => void;
  activeTourId: FeatureTourId | null;
  activeTargetId: string | null;
  startTour: (tourId: FeatureTourId, entrySource?: 'first_use' | 'replay' | 'manual') => void;
};

const FeatureTourContext = createContext<FeatureTourContextValue | null>(null);

export function FeatureTourProvider({ children }: PropsWithChildren) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const targetsRef = useRef(new Map<string, TargetMeasurement>());
  const screensRef = useRef(new Map<FeatureTourId, (targetId: string) => void>());
  const [targetRevision, setTargetRevision] = useState(0);
  const [targetStatus, setTargetStatus] = useState<'locating' | 'ready' | 'unavailable'>('locating');
  const explanationRef = useRef<View>(null);
  const measurementGeneration = useRef(0);
  const pathname = usePathname();
  const openedPath = useRef(pathname);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activeTourId, setActiveTourId] = useState<FeatureTourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<FeatureTourRect | null>(null);
  const [measuredCardHeight, setMeasuredCardHeight] = useState(260);
  const markCompleted = useFeatureTourStore(s => s.markCompleted);
  const markSkipped = useFeatureTourStore(s => s.markSkipped);

  const activeTour = activeTourId ? FEATURE_TOUR_BY_ID[activeTourId] : null;
  const activeStep = activeTour?.steps[stepIndex] ?? null;
  const totalSteps = activeTour?.steps.length ?? 0;

  const measureStep = useCallback(async () => {
    const generation = ++measurementGeneration.current;
    setTargetRect(null);
    setTargetStatus('locating');
    if (!activeStep || !activeTourId) return;
    const rect = await locateFeatureTourTarget({
      prepare: () => screensRef.current.get(activeTourId)?.(activeStep.targetId),
      find: () => {
        const target = targetsRef.current.get(activeStep.targetId);
        return activeStep.targetAction && !target?.activate ? undefined : target;
      },
      current: () => generation === measurementGeneration.current,
      visible: value => highlightRectForTarget(value, dimensions.width, dimensions.height) !== null,
    });
    if (generation !== measurementGeneration.current) return;
    setTargetRect(rect);
    setTargetStatus(rect ? 'ready' : 'unavailable');
    measurementGeneration.current += 1;
  }, [activeStep, activeTourId, dimensions.width, dimensions.height]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!activeStep || !activeTour) return;
    void measureStep();
    recordFeatureTourEvent({
      name: 'feature_tour_step_viewed',
      tourId: activeTour.id,
      tourVersion: activeTour.version,
      stepId: activeStep.id,
      stepNumber: stepIndex + 1,
    });
    return () => { measurementGeneration.current += 1; };
  }, [activeStep, activeTour, measureStep, stepIndex, dimensions.width, dimensions.height, targetRevision]);

  useEffect(() => {
    if (!activeStep || !explanationRef.current) return;
    if (Platform.OS === 'web') {
      (explanationRef.current as unknown as { focus?: () => void }).focus?.();
      return;
    }
    const handle = findNodeHandle(explanationRef.current);
    if (handle) {
      const timer = setTimeout(() => AccessibilityInfo.setAccessibilityFocus(handle), reduceMotion ? 0 : 160);
      return () => clearTimeout(timer);
    }
  }, [activeStep, reduceMotion]);

  const registerTarget = useCallback((targetId: string, target: TargetMeasurement) => {
    targetsRef.current.set(targetId, target);
    setTargetRevision(value => value + 1);
    return () => {
      if (targetsRef.current.get(targetId) === target) {
        targetsRef.current.delete(targetId);
        setTargetRevision(value => value + 1);
        measurementGeneration.current += 1;
        setTargetRect(null);
      }
    };
  }, []);

  const startTour = useCallback((tourId: FeatureTourId, entrySource: 'first_use' | 'replay' | 'manual' = 'manual') => {
    const tour = getFeatureTour(tourId);
    if (tour.steps.length === 0) return;
    setActiveTourId(tourId);
    openedPath.current = pathname;
    setStepIndex(0);
    recordFeatureTourEvent({
      name: 'feature_tour_started',
      tourId,
      tourVersion: tour.version,
      stepId: tour.steps[0]?.id,
      stepNumber: 1,
      entrySource,
    });
  }, [pathname]);

  useEffect(() => {
    if (openedPath.current === pathname) return;
    measurementGeneration.current += 1;
    setActiveTourId(null);
    setTargetRect(null);
    setStepIndex(0);
  }, [pathname]);

  const registerScreen = useCallback((tourId: FeatureTourId, prepare: (targetId: string) => void) => {
    screensRef.current.set(tourId, prepare);
    return () => { if (screensRef.current.get(tourId) === prepare) screensRef.current.delete(tourId); };
  }, []);
  const value = useMemo(() => ({ registerTarget, registerScreen, startTour, activeTourId,
    activeTargetId: activeStep?.targetId ?? null }), [registerTarget, registerScreen, startTour, activeTourId, activeStep]);

  function closeAsSkipped() {
    measurementGeneration.current += 1;
    if (activeTour) markSkipped(activeTour.id);
    setActiveTourId(null);
    setStepIndex(0);
    setTargetRect(null);
  }

  function completeTour() {
    measurementGeneration.current += 1;
    if (activeTour) markCompleted(activeTour.id);
    setActiveTourId(null);
    setStepIndex(0);
    setTargetRect(null);
  }

  function goNext() {
    if (!activeTour) return;
    if (activeStep?.targetAction && targetStatus !== 'unavailable') {
      const activate = targetsRef.current.get(activeStep.targetId)?.activate;
      if (!activate || targetStatus !== 'ready') return;
      activate();
    }
    if (stepIndex >= activeTour.steps.length - 1) {
      completeTour();
      return;
    }
    setStepIndex(index => nextStepIndex(index, activeTour.steps.length));
  }

  function goBack() {
    setStepIndex(previousStepIndex(stepIndex));
  }

  const highlightRect = highlightRectForTarget(targetRect, dimensions.width, dimensions.height);
  const dimColor = 'rgba(0,0,0,0.40)';
  const card = activeStep
    ? cardPlacementForTarget({
      target: highlightRect,
      viewportWidth: dimensions.width,
      viewportHeight: dimensions.height,
      insets: { ...insets, top: insets.top + 48 },
      preferredPlacement: activeStep.preferredPlacement,
      cardHeight: measuredCardHeight,
    })
    : null;

  return (
    <FeatureTourContext.Provider value={value}>
      {children}
      <Modal
        visible={!!activeTour && !!activeStep}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={closeAsSkipped}
        statusBarTranslucent
      >
        <Pressable
          style={styles.overlayRoot}
          onPress={closeAsSkipped}
          onAccessibilityEscape={closeAsSkipped}
          pointerEvents="auto"
          accessibilityViewIsModal
          accessibilityLabel={activeStep && activeTour ? featureTourAccessibilityLabel(activeStep, stepIndex, totalSteps) : undefined}
         accessible={false}>
          {highlightRect ? (
            <>
              <View style={[styles.dimBlock, { left: 0, top: 0, right: 0, height: highlightRect.y, backgroundColor: dimColor }]} />
              <View style={[styles.dimBlock, { left: 0, top: highlightRect.y, width: highlightRect.x, height: highlightRect.height, backgroundColor: dimColor }]} />
              <View style={[styles.dimBlock, { left: highlightRect.x + highlightRect.width, top: highlightRect.y, right: 0, height: highlightRect.height, backgroundColor: dimColor }]} />
              <View style={[styles.dimBlock, { left: 0, top: highlightRect.y + highlightRect.height, right: 0, bottom: 0, backgroundColor: dimColor }]} />
            </>
          ) : (
            <View style={[styles.dim, { backgroundColor: C.overlay }]} />
          )}
          {highlightRect ? (
            <Pressable
              pointerEvents={activeStep?.targetAction && targetStatus === 'ready' ? 'auto' : 'none'}
              onPress={event => { event.stopPropagation(); goNext(); }}
              accessibilityRole={activeStep?.targetAction ? 'button' : undefined}
              accessibilityLabel={activeStep?.targetAction ? activeStep.actionLabel ?? `Open ${activeStep.title}` : undefined}
              testID="feature-tour-highlight"
              style={[
                styles.highlight,
                {
                  left: highlightRect.x,
                  top: highlightRect.y,
                  width: highlightRect.width,
                  height: highlightRect.height,
                  borderColor: '#FFD84D',
                  backgroundColor: 'transparent',
                },
              ]}
            />
          ) : null}
          {activeStep && activeTour && card ? (
            <View
              ref={explanationRef}
              focusable
              testID="feature-tour-bubble"
              onLayout={event => setMeasuredCardHeight(Math.ceil(event.nativeEvent.layout.height))}
              style={[
                styles.card,
                {
                  top: card.top,
                  left: card.left,
                  width: card.width,
                  backgroundColor: C.cardElevated,
                  borderColor: C.border,
                },
              ]}
            >
            {highlightRect && card.placement !== 'center' ? <View pointerEvents="none" style={[
              styles.pointer,
              { left: Math.max(22, Math.min(card.width - 38, highlightRect.x + highlightRect.width / 2 - card.left - 8)) },
              card.placement === 'bottom'
                ? { top: -8, borderBottomWidth: 8, borderBottomColor: C.cardElevated }
                : { bottom: -8, borderTopWidth: 8, borderTopColor: C.cardElevated },
            ]} /> : null}
            <Pressable onPress={event => event.stopPropagation()} accessible={false}>
            <ScrollView style={{ maxHeight: Math.max(80, dimensions.height - insets.bottom - (card?.top ?? insets.top + 60) - 44) }} keyboardShouldPersistTaps="handled">
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eyebrow, { color: C.textDim }]}>{activeStep.eyebrow ?? activeTour.entryLabel.toUpperCase()}</Text>
                  <Text style={[styles.title, { color: C.text }]}>{activeStep.title}</Text>
                </View>
                <TouchableOpacity onPress={closeAsSkipped} style={styles.close} accessibilityRole="button" accessibilityLabel="Close walkthrough">
                  <Ionicons name="close" size={22} color={C.text} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.description, { color: C.textMuted }]}>{activeStep.description}</Text>
              {targetStatus === 'locating' ? <Text style={[styles.description, { color: C.textDim }]}>Finding this feature…</Text> : null}
              {targetStatus === 'unavailable' ? <Text style={[styles.description, { color: C.textDim }]}>{activeStep.unavailableDescription ?? 'This feature is unavailable in the current view. Your data is unchanged; continue or close the tour.'}</Text> : null}
              {activeStep.targetAction && targetStatus === 'ready' ? <Text style={[styles.description, { color: C.textMuted }]}>Tap the yellow outline, or use the button below.</Text> : null}
              <View style={styles.footer}>
                <Text style={[styles.progress, { color: C.textDim }]}>{stepIndex + 1} of {totalSteps}</Text>
                <View style={styles.actions}>
                  {stepIndex > 0 ? (
                    <TouchableOpacity style={[styles.secondary, { borderColor: C.border }]} onPress={goBack} accessibilityRole="button" accessibilityLabel="Previous walkthrough step">
                      <Text style={[styles.secondaryText, { color: C.text }]}>Back</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={[styles.secondary, { borderColor: C.border }]} onPress={closeAsSkipped} accessibilityRole="button" accessibilityLabel="Skip walkthrough">
                    <Text style={[styles.secondaryText, { color: C.textMuted }]}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={targetStatus === 'locating' && !!activeStep.targetAction} style={[styles.primary, { backgroundColor: C.primary, opacity: targetStatus === 'locating' && activeStep.targetAction ? 0.5 : 1 }]} onPress={goNext} accessibilityRole="button" accessibilityLabel={activeStep.targetAction && targetStatus === 'ready' ? activeStep.actionLabel ?? `Open ${activeStep.title}` : stepIndex === totalSteps - 1 ? 'Finish walkthrough' : 'Next walkthrough step'}>
                    <Text style={[styles.primaryText, { color: C.onPrimary }]}>{activeStep.targetAction && targetStatus === 'ready' ? activeStep.actionLabel ?? 'Open' : stepIndex === totalSteps - 1 ? 'Done' : 'Next'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </FeatureTourContext.Provider>
  );
}

export function useFeatureTour(tourId: FeatureTourId, prepareTarget?: (targetId: string) => void) {
  const focused = useIsFocused();
  const context = useContext(FeatureTourContext);
  const prepareRef = useRef(prepareTarget);
  prepareRef.current = prepareTarget;
  const registerScreen = context?.registerScreen;
  useEffect(() => registerScreen?.(tourId, targetId => prepareRef.current?.(targetId)), [registerScreen, tourId]);
  const status = useFeatureTourStore(s => s.tourStatus[tourId]);
  const replayRequest = useFeatureTourStore(s => s.replayRequests[tourId]);
  const consumeReplay = useFeatureTourStore(s => s.consumeReplay);
  const hasStartedRef = useRef(false);
  const [hydrated, setHydrated] = useState(() => useFeatureTourStore.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = useFeatureTourStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useFeatureTourStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!context || !focused || !hydrated || replayRequest) return;
    const definition = getFeatureTour(tourId);
    if (!hasStartedRef.current && shouldAutoStartTour(definition, status)) {
      const timer = setTimeout(() => {
        hasStartedRef.current = true;
        context.startTour(tourId, 'first_use');
      }, 450);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [context, status, tourId, focused, hydrated, replayRequest]);

  useEffect(() => {
    if (!context || !replayRequest || !focused || !hydrated) return;
    // Consuming first triggered a render that cancelled this timer before it ran.
    const timer = setTimeout(() => {
      hasStartedRef.current = true;
      context.startTour(tourId, 'replay');
      consumeReplay(tourId);
    }, 300);
    return () => clearTimeout(timer);
  }, [consumeReplay, context, replayRequest, tourId, focused, hydrated]);

  return {
    activeTargetId: context?.activeTourId === tourId ? context.activeTargetId : null,
    replay: () => context?.startTour(tourId, 'manual'),
  };
}

export function useFeatureTourRegistry() {
  const context = useContext(FeatureTourContext);
  if (!context) {
    throw new Error('useFeatureTourRegistry must be used inside FeatureTourProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  pointer: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  overlayRoot: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFill,
  },
  dimBlock: {
    position: 'absolute',
  },
  highlight: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  card: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 178,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  footer: {
    marginTop: 16,
    gap: 12,
  },
  progress: {
    fontSize: 12,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  primary: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '900',
  },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
