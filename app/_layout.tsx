import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useOnboardingStore } from '../src/store/onboardingStore';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"  options={{ headerShown: false }} />
        <Stack.Screen name="modal"       options={{ presentation: 'modal' }} />
      </Stack>
      <OnboardingGate />
    </ThemeProvider>
  );
}

// Redirect to onboarding when not yet complete, or to tabs when complete.
// Must be a child of the Stack so router and segments are available.
function OnboardingGate() {
  const onboardingComplete = useOnboardingStore(s => s.onboardingComplete);
  const segments           = useSegments();

  useEffect(() => {
    const path        = segments.join('/');
    const inOnboarding = path.includes('onboarding');

    if (!onboardingComplete && !inOnboarding) {
      router.replace('/onboarding' as never);
    } else if (onboardingComplete && inOnboarding) {
      router.replace('/(tabs)/dashboard');
    }
  }, [onboardingComplete, segments]);

  return null;
}
