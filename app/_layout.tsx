import { useFonts } from 'expo-font';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import { router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import 'react-native-reanimated';

import { useOnboardingStore } from '../src/store/onboardingStore';
import { useAuthStore }       from '../src/store/authStore';
import { useThemeStore }      from '../src/store/themeStore';
import { completeSupabaseAuthFromUrl } from '../src/lib/authRedirect';
import { ToastProvider } from '../src/components/ui/Toast';
import { ThemeProvider as StrideThemeProvider } from '../src/theme/ThemeProvider';
import { getNavigationTheme } from '../src/theme/theme';

// Register GPS background task at module level (required by expo-task-manager)
import '../src/lib/gpsTracking';
import '../src/lib/notifications';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 500, fade: true });

// Must stay in lockstep with app.json → plugins → expo-splash-screen
// (backgroundColor #2E2620, imageWidth 220) so both startup frames are the
// same visual treatment. scripts/tests/startupBranding.test.ts enforces this.
const SPLASH_BACKGROUND  = '#2E2620';
const SPLASH_IMAGE_WIDTH = 220;

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize);
  const mode = useThemeStore(s => s.mode);
  const [showBrandSplash, setShowBrandSplash] = useState(true);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    CormorantGaramond_700Bold,
    DMSans_400Regular,
  });

  useEffect(() => { if (error) console.warn('[fonts]', error); }, [error]);
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
      initialize();
      const timer = setTimeout(() => setShowBrandSplash(false), 850);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loaded, error, initialize]);

  // Handle Supabase auth deep links for OAuth, email confirmation, and password reset.
  useEffect(() => {
    async function handleUrl(url: string) {
      const result = await completeSupabaseAuthFromUrl(url);
      if (result.recovery && !result.error) {
        router.push('/auth/new-password' as never);
      }
    }

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    }

    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response?.notification) redirect(response.notification);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      redirect(response.notification);
    });
    return () => sub.remove();
  }, []);

  if (!loaded && !error) return null;
  if (showBrandSplash) {
    // Canonical startup treatment — identical composition, scale, and
    // background to the native Expo splash (see app.json "expo-splash-screen":
    // splash-icon.png at 220pt on #2E2620), so the native → React handoff has
    // no visible logo swap in either device appearance.
    return (
      <View style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={{ width: SPLASH_IMAGE_WIDTH, height: SPLASH_IMAGE_WIDTH }}
          resizeMode="contain"
          accessibilityLabel="StrideOS"
        />
      </View>
    );
  }

  return (
    <StrideThemeProvider>
      <NavigationThemeProvider value={getNavigationTheme(mode)}>
        <ToastProvider>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Stack>
        <Stack.Screen name="(tabs)"     options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth"       options={{ headerShown: false }} />
        <Stack.Screen name="modal"      options={{ presentation: 'modal' }} />
      </Stack>
      <NavigationGate />
        </ToastProvider>
      </NavigationThemeProvider>
    </StrideThemeProvider>
  );
}

// Handles auth → onboarding → tabs routing in one place.
// Must be a child of the Stack so router and segments are available.
function NavigationGate() {
  const session           = useAuthStore(s => s.session);
  const loading           = useAuthStore(s => s.loading);
  const onboardingComplete = useOnboardingStore(s => s.onboardingComplete);
  const segments           = useSegments();

  useEffect(() => {
    if (loading) return;

    const path         = segments.join('/');
    const inAuth       = path.includes('auth');
    const inOnboarding = path.includes('onboarding');

    if (!session) {
      if (!inAuth) router.replace('/auth/sign-in' as never);
    } else if (!onboardingComplete) {
      if (!inOnboarding) router.replace('/onboarding' as never);
    } else if (inAuth || inOnboarding) {
      router.replace('/(tabs)/dashboard');
    }
  }, [session, loading, onboardingComplete, segments]);

  return null;
}
