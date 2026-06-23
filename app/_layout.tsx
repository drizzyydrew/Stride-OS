import { useFonts } from 'expo-font';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useOnboardingStore } from '../src/store/onboardingStore';
import { useAuthStore }       from '../src/store/authStore';
import { supabase }           from '../src/lib/supabase';

// Register GPS background task at module level (required by expo-task-manager)
import '../src/lib/gpsTracking';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useAuthStore(s => s.initialize);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    CormorantGaramond_700Bold,
    DMSans_400Regular,
  });

  useEffect(() => { if (error) console.warn('[fonts]', error); }, [error]);
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      initialize();
    }
  }, [loaded]);

  // Handle password-reset deep links (strideos://auth/new-password#access_token=...&type=recovery)
  useEffect(() => {
    async function handleUrl(url: string) {
      if (!url.includes('type=recovery')) return;
      const fragment = url.split('#')[1] ?? url.split('?')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        router.push('/auth/new-password' as never);
      }
    }

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);


  if (!loaded && !error) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"     options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth"       options={{ headerShown: false }} />
        <Stack.Screen name="modal"      options={{ presentation: 'modal' }} />
      </Stack>
      <NavigationGate />
    </ThemeProvider>
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
