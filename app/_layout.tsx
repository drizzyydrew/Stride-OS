import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useOnboardingStore } from '../src/store/onboardingStore';
import { useAuthStore }       from '../src/store/authStore';

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
  });

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      initialize();
    }
  }, [loaded]);

  if (!loaded) return null;

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
