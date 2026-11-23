import { Link } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { useColors } from '../../theme/useColors';

export default function StrengthCalculatorLink() {
  const C = useColors();
  return <Link href="/(tabs)/strength/calculators" push asChild>
    <TouchableOpacity accessibilityRole="link" accessibilityLabel="Open strength calculators"
      style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Strength calculators</Text>
    </TouchableOpacity>
  </Link>;
}
