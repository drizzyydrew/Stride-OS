import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type ScrollView } from 'react-native';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../theme/useColors';
import BrandChevrons from '../ui/BrandChevrons';
import { Ionicons } from '@expo/vector-icons';
import { createBackActionRegistry, isSectionRoot } from '../../utils/navigationEscape';
import { liveWorkoutDestination, liveWorkoutNavigationMethod } from '../../utils/liveWorkoutNavigation';
import { useActiveRunStore } from '../../store/activeRunStore';
import { useActiveActivityStore } from '../../store/activeActivityStore';
import { useActiveIndoorRideStore } from '../../store/activeIndoorRideStore';
import { useActiveStrengthSessionStore } from '../../store/activeStrengthSessionStore';
import { useAuthStore } from '../../store/authStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';

const sessionStores = [useActiveRunStore, useActiveActivityStore, useActiveIndoorRideStore, useActiveStrengthSessionStore];
const sessionsHydrated = () => sessionStores.every(store => store.persist.hasHydrated());
function activeSessionSnapshot() {
  const strength = useActiveStrengthSessionStore.getState().session;
  return {
    runningActive: useActiveRunStore.getState().isActive,
    outdoorActive: useActiveActivityStore.getState().isActive,
    outdoorName: useActiveActivityStore.getState().name,
    indoorRideActive: useActiveIndoorRideStore.getState().isActive,
    strengthName: strength?.workoutName ?? null,
    strengthSource: strength?.source ?? null,
  };
}

type BackAction = { path: string; invoke: () => void };
type EscapeRegistry = {
  register: (key: symbol, action: BackAction) => () => void;
  handle: (path: string) => boolean;
  requestTodayTop: () => void;
  registerTodayScroll: (scroll: () => void) => () => void;
};
const EscapeContext = createContext<EscapeRegistry | null>(null);

export function useHasFixedNavigationBanner() { return useContext(EscapeContext) !== null; }

export function NavigationEscapeProvider({ children }: PropsWithChildren) {
  const value = useMemo<EscapeRegistry>(createBackActionRegistry, []);
  return <EscapeContext.Provider value={value}>{children}</EscapeContext.Provider>;
}

// Carry a leaf's existing confirmation/draft handler into the fixed banner.
export function useFixedBackAction(onBack?: () => void): boolean {
  const context = useContext(EscapeContext);
  const path = usePathname();
  const latest = useRef(onBack);
  latest.current = onBack;
  const key = useRef(Symbol('screen-back'));
  const enabled = Boolean(onBack);
  useFocusEffect(useCallback(() => {
    if (!context || !enabled) return;
    return context.register(key.current, { path, invoke: () => latest.current?.() });
  }, [context, enabled, path]));
  return Boolean(context);
}

// Register only while Today is focused. A Home tap from another tab queues the
// reset until focus, including the first mount after a cold detail link.
export function useTodayScrollToTop(ref: React.RefObject<ScrollView | null>) {
  const context = useContext(EscapeContext);
  useFocusEffect(useCallback(() => context?.registerTodayScroll(() => {
    requestAnimationFrame(() => ref.current?.scrollTo({ y: 0, animated: false }));
  }), [context, ref]));
}

export function FixedNavigationBanner() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const context = useContext(EscapeContext);
  const canAccessLocalData = useAuthStore(state => state.canAccessLocalData);
  const authLoading = useAuthStore(state => state.loading);
  // Primitive selectors keep changing GPS/timer metrics out of the app header.
  const runningActive = useActiveRunStore(state => state.isActive);
  const outdoorActive = useActiveActivityStore(state => state.isActive);
  const outdoorName = useActiveActivityStore(state => state.name);
  const indoorRideActive = useActiveIndoorRideStore(state => state.isActive);
  const strengthName = useActiveStrengthSessionStore(state => state.session?.workoutName ?? null);
  const strengthSource = useActiveStrengthSessionStore(state => state.session?.source ?? null);
  const [hydrated, setHydrated] = useState(sessionsHydrated);
  useEffect(() => {
    const subscriptions = sessionStores.flatMap(store => [
      store.persist.onHydrate(() => setHydrated(false)),
      store.persist.onFinishHydration(() => setHydrated(sessionsHydrated())),
    ]);
    setHydrated(sessionsHydrated());
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, []);
  const live = liveWorkoutDestination({ runningActive, outdoorActive, outdoorName, indoorRideActive, strengthName, strengthSource },
    path, { hydrated, canAccessLocalData: canAccessLocalData && !authLoading });
  function returnToLive() {
    const lease = captureOwnerLease();
    if (!lease || !ownerLeaseIsCurrent(lease)) return;
    const target = liveWorkoutDestination(activeSessionSnapshot(), path, {
      hydrated: sessionsHydrated(),
      canAccessLocalData: useAuthStore.getState().canAccessLocalData && !useAuthStore.getState().loading,
    });
    if (!target) return;
    const method = liveWorkoutNavigationMethod(path, target);
    if (target.domain === 'running') {
      const route = { pathname: '/(tabs)/training' as const, params: { tab: 'active' } };
      if (method === 'push') router.push(route); else router.navigate(route);
    } else if (method === 'push') router.push(target.route as never);
    else router.navigate(target.route as never);
  }
  const authRoot = path === '/auth/sign-in' || path === '/onboarding' || path === '/onboarding/index';
  const home = path === '/' || path === '/dashboard';
  const sectionRoot = isSectionRoot(path);
  const canGoBack = router.canGoBack();
  const disabled = !canGoBack && authRoot;
  function back() {
    if (sectionRoot) {
      context?.requestTodayTop();
      router.navigate('/(tabs)/dashboard');
      return;
    }
    if (context?.handle(path)) return;
    if (router.canGoBack()) router.back();
    else if (path.startsWith('/auth')) router.replace('/auth/sign-in');
    else if (!authRoot && !home) router.replace('/(tabs)/dashboard');
  }
  return <View style={[styles.banner, { backgroundColor: C.bg, borderBottomColor: C.border, paddingTop: insets.top }]}>
    <View style={styles.row}>
      <View style={styles.headerSlot}>
      <Pressable onPress={back} disabled={disabled} style={[styles.back, disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel={sectionRoot ? "Today, scroll to top" : "Back"} accessibilityState={{ disabled }}>
        {sectionRoot ? <Ionicons name="home-outline" size={23} color={C.text} /> : <BrandChevrons />}
      </Pressable>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.brand, { color: C.textMuted }]}>STRIDEOS</Text>
      <View style={[styles.headerSlot, { alignItems: 'flex-end' }]}>
        {live ? <Pressable onPress={returnToLive} style={[styles.live, { backgroundColor: C.primaryDim }]}
          accessibilityRole="button" accessibilityLabel={`Return to live workout: ${live.name}`}
          accessibilityHint="Opens the current workout controls without starting or resuming a workout.">
          <Ionicons name="return-up-back-outline" size={17} color={C.primary} />
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.liveLabel, { color: C.primary }]}>Live</Text>
        </Pressable> : null}
      </View>
    </View>
  </View>;
}

export function LegacyBackControl({ onBack }: { onBack: () => void }) {
  const fixed = useFixedBackAction(onBack);
  if (fixed) return null;
  return <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back"><BrandChevrons /></Pressable>;
}

const styles = StyleSheet.create({
  banner: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSlot: { width: 76, minHeight: 44, justifyContent: 'center', flexShrink: 0 },
  brand: { flex: 1, minWidth: 0, textAlign: 'center', fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  live: { minHeight: 44, width: 76, paddingHorizontal: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  liveLabel: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  disabled: { opacity: 0.3 },
});
