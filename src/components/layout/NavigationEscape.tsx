import { createContext, useCallback, useContext, useMemo, useRef, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type ScrollView } from 'react-native';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../theme/useColors';
import BrandChevrons from '../ui/BrandChevrons';
import { Ionicons } from '@expo/vector-icons';
import { createBackActionRegistry, isSectionRoot } from '../../utils/navigationEscape';

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
      <Pressable onPress={back} disabled={disabled} style={[styles.back, disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel={sectionRoot ? "Today, scroll to top" : "Back"} accessibilityState={{ disabled }}>
        {sectionRoot ? <Ionicons name="home-outline" size={23} color={C.text} /> : <BrandChevrons />}
      </Pressable>
      <Text style={[styles.brand, { color: C.textMuted }]}>STRIDEOS</Text>
      <View style={styles.back} />
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
  brand: { fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  disabled: { opacity: 0.3 },
});
