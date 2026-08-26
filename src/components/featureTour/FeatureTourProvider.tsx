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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

type TargetMeasurement = {
  measure: () => Promise<FeatureTourRect | null>;
};

type FeatureTourContextValue = {
  registerTarget: (targetId: string, target: TargetMeasurement) => () => void;
  startTour: (tourId: FeatureTourId, entrySource?: 'first_use' | 'replay' | 'manual') => void;
};

const FeatureTourContext = createContext<FeatureTourContextValue | null>(null);

export function FeatureTourProvider({ children }: PropsWithChildren) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const targetsRef = useRef(new Map<string, TargetMeasurement>());
  const explanationRef = useRef<View>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activeTourId, setActiveTourId] = useState<FeatureTourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<FeatureTourRect | null>(null);
  const markCompleted = useFeatureTourStore(s => s.markCompleted);
  const markSkipped = useFeatureTourStore(s => s.markSkipped);

  const activeTour = activeTourId ? FEATURE_TOUR_BY_ID[activeTourId] : null;
  const activeStep = activeTour?.steps[stepIndex] ?? null;
  const totalSteps = activeTour?.steps.length ?? 0;

  const measureStep = useCallback(async () => {
    if (!activeStep) {
      setTargetRect(null);
      return;
    }
    const target = targetsRef.current.get(activeStep.targetId);
    if (!target) {
      setTargetRect(null);
      return;
    }
    const rect = await target.measure();
    setTargetRect(rect);
  }, [activeStep]);

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
  }, [activeStep, activeTour, measureStep, stepIndex, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!activeStep || !explanationRef.current) return;
    const handle = findNodeHandle(explanationRef.current);
    if (handle) {
      setTimeout(() => AccessibilityInfo.setAccessibilityFocus(handle), reduceMotion ? 0 : 160);
    }
  }, [activeStep, reduceMotion]);

  const registerTarget = useCallback((targetId: string, target: TargetMeasurement) => {
    targetsRef.current.set(targetId, target);
    return () => {
      if (targetsRef.current.get(targetId) === target) {
        targetsRef.current.delete(targetId);
      }
    };
  }, []);

  const startTour = useCallback((tourId: FeatureTourId, entrySource: 'first_use' | 'replay' | 'manual' = 'manual') => {
    const tour = getFeatureTour(tourId);
    if (tour.steps.length === 0) return;
    setActiveTourId(tourId);
    setStepIndex(0);
    recordFeatureTourEvent({
      name: 'feature_tour_started',
      tourId,
      tourVersion: tour.version,
      stepId: tour.steps[0]?.id,
      stepNumber: 1,
      entrySource,
    });
  }, []);

  const value = useMemo(() => ({ registerTarget, startTour }), [registerTarget, startTour]);

  function closeAsSkipped() {
    if (activeTour) markSkipped(activeTour.id);
    setActiveTourId(null);
    setStepIndex(0);
    setTargetRect(null);
  }

  function completeTour() {
    if (activeTour) markCompleted(activeTour.id);
    setActiveTourId(null);
    setStepIndex(0);
    setTargetRect(null);
  }

  function goNext() {
    if (!activeTour) return;
    if (stepIndex >= activeTour.steps.length - 1) {
      completeTour();
      return;
    }
    setStepIndex(index => nextStepIndex(index, activeTour.steps.length));
  }

  function goBack() {
    setStepIndex(previousStepIndex(stepIndex));
  }

  const highlightRect = highlightRectForTarget(targetRect, dimensions.width);
  const card = activeStep
    ? cardPlacementForTarget({
      target: targetRect,
      viewportWidth: dimensions.width,
      viewportHeight: dimensions.height,
      insets,
      preferredPlacement: activeStep.preferredPlacement,
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
        <View
          style={styles.overlayRoot}
          pointerEvents="auto"
          accessibilityViewIsModal
          accessibilityLabel={activeStep && activeTour ? featureTourAccessibilityLabel(activeStep, stepIndex, totalSteps) : undefined}
        >
          <View style={[styles.dim, { backgroundColor: C.overlay }]} />
          {highlightRect ? (
            <View
              pointerEvents="none"
              style={[
                styles.highlight,
                {
                  left: highlightRect.x,
                  top: highlightRect.y,
                  width: highlightRect.width,
                  height: highlightRect.height,
                  borderColor: C.primary,
                  backgroundColor: C.primaryDim,
                },
              ]}
            />
          ) : null}
          {activeStep && activeTour && card ? (
            <View
              ref={explanationRef}
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
              accessible
              accessibilityRole="summary"
              accessibilityLabel={featureTourAccessibilityLabel(activeStep, stepIndex, totalSteps)}
              accessibilityHint={activeStep.accessibilityHint}
            >
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eyebrow, { color: C.textDim }]}>{activeStep.eyebrow ?? activeTour.entryLabel.toUpperCase()}</Text>
                  <Text style={[styles.title, { color: C.text }]}>{activeStep.title}</Text>
                </View>
                <TouchableOpacity onPress={closeAsSkipped} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close walkthrough">
                  <Ionicons name="close" size={20} color={C.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.description, { color: C.textMuted }]}>{activeStep.description}</Text>
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
                  <TouchableOpacity style={[styles.primary, { backgroundColor: C.primary }]} onPress={goNext} accessibilityRole="button" accessibilityLabel={stepIndex === totalSteps - 1 ? 'Finish walkthrough' : 'Next walkthrough step'}>
                    <Text style={[styles.primaryText, { color: C.onPrimary }]}>{stepIndex === totalSteps - 1 ? 'Done' : activeStep.actionLabel ?? 'Next'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </FeatureTourContext.Provider>
  );
}

export function useFeatureTour(tourId: FeatureTourId) {
  const context = useContext(FeatureTourContext);
  const status = useFeatureTourStore(s => s.tourStatus[tourId]);
  const replayRequest = useFeatureTourStore(s => s.replayRequests[tourId]);
  const consumeReplay = useFeatureTourStore(s => s.consumeReplay);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!context) return;
    const hasHydrated = useFeatureTourStore.persist.hasHydrated();
    if (!hasHydrated) return;
    const definition = getFeatureTour(tourId);
    if (!hasStartedRef.current && shouldAutoStartTour(definition, status)) {
      hasStartedRef.current = true;
      const timer = setTimeout(() => context.startTour(tourId, 'first_use'), 450);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [context, status, tourId]);

  useEffect(() => {
    if (!context || !replayRequest) return;
    consumeReplay(tourId);
    const timer = setTimeout(() => context.startTour(tourId, 'replay'), 300);
    return () => clearTimeout(timer);
  }, [consumeReplay, context, replayRequest, tourId]);

  return {
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
  overlayRoot: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFill,
  },
  highlight: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 16,
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
