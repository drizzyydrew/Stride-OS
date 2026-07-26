import { Stack } from 'expo-router';

export default function ActivityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[activityId]" />
      <Stack.Screen name="manual" />
      <Stack.Screen name="compare" />
      <Stack.Screen name="plans" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="start" />
      <Stack.Screen name="indoor-ride" />
    </Stack>
  );
}
