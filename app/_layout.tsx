import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useOnboardingStore } from '../src/store/onboardingStore';
import { ThemeProvider, useThemeColors, useThemeMode } from '../src/theme/ThemeContext';

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
    <ThemeProvider>
      <NavigationChrome />
      <OnboardingGate />
    </ThemeProvider>
  );
}

// Wires the app's semantic colors into React Navigation's chrome (header,
// screen background) so native transitions never flash the wrong theme.
function NavigationChrome() {
  const mode   = useThemeMode();
  const colors = useThemeColors();
  const base   = mode === 'light' ? DefaultTheme : DarkTheme;

  const navigationTheme = {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary:    colors.primary,
      background: colors.bg,
      card:       colors.card,
      text:       colors.text,
      border:     colors.border,
      notification: colors.critical,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"  options={{ headerShown: false }} />
        <Stack.Screen name="modal"       options={{ presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
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
