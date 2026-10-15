import { Stack } from 'expo-router';

export default function LegacyActivityLogLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[entryId]" />
    </Stack>
  );
}
