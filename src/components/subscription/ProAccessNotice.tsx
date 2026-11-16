import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '../../theme/useColors';
import Button from '../ui/Button';
import type { ProAccess } from '../../utils/pro-access';

export default function ProAccessNotice({ access }: { access: ProAccess & { retry: () => void } }) {
  const C = useColors();
  if (access.allowed) return null;
  return <View style={{ padding: 16, gap: 12, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card }}>
    <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>Your personalized training</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: C.textMuted, fontSize: 14, lineHeight: 21 }}>{access.message}</Text>
    {access.status === 'inactive'
      ? <Button label="Explore StrideOS Pro" onPress={() => router.push('/(tabs)/settings/membership' as never)} />
      : access.status !== 'checking' ? <Button label="Retry membership check" variant="secondary" onPress={access.retry} /> : null}
  </View>;
}
