import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

export async function requestLocationRecovery(): Promise<{ foreground: Location.PermissionStatus | 'unknown'; background: Location.PermissionStatus | 'unknown' }> {
  const explainSettings = (message: string) => Alert.alert('Location settings', message, [
    { text: 'Not Now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => { void Linking.openSettings().catch(() => undefined); } },
  ]);
  if (!await Location.hasServicesEnabledAsync()) {
    explainSettings('Turn on Location Services in Settings > Privacy & Security > Location Services, then allow StrideOS to use your precise location. GPS recording does not need cellular service.');
    return { foreground: Location.PermissionStatus.DENIED, background: Location.PermissionStatus.DENIED };
  }
  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted' && foreground.canAskAgain) foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    explainSettings('In Settings > StrideOS > Location, allow location access and turn on Precise Location. Choose Always so recording can continue with the screen locked.');
    return { foreground: foreground.status, background: 'unknown' };
  }
  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted' && background.canAskAgain) background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    explainSettings('In Settings > StrideOS > Location, choose Always and enable Precise Location. Return to StrideOS afterward; your permission status will refresh.');
  }
  return { foreground: foreground.status, background: background.status };
}
