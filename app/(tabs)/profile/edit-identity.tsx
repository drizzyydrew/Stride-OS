import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LegacyBackControl } from '../../../src/components/layout/NavigationEscape';
import { usePageSafeAreaInsets as useSafeAreaInsets } from '../../../src/components/layout/PageSafeAreaView';
import ProfileIdentityEditor from '../../../src/components/profile/ProfileIdentityEditor';
import { useActiveProfile } from '../../../src/store/profileStore';
import { useColors } from '../../../src/theme/useColors';
import { LAYOUT } from '../../../src/constants/layout';

export default function EditIdentityScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const profile = useActiveProfile();
  return <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
    contentContainerStyle={{ padding: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
    keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <LegacyBackControl onBack={() => router.back()} />
      <Text style={{ flex: 1, color: C.text, fontSize: 26, fontWeight: '700', fontFamily: 'CormorantGaramond_700Bold' }}>Edit profile</Text>
    </View>
    <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
      {profile ? <ProfileIdentityEditor key={`${profile.athleteId}:${profile.createdAt}`} profile={profile} />
        : <Text style={{ color: C.textMuted }}>Reopen your profile to edit your details.</Text>}
    </View>
  </ScrollView>;
}
