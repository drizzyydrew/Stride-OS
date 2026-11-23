import { Fragment, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useProAccess } from '../../hooks/useProAccess';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { captureOwnerLease } from '../../lib/localDataOwner';
import { useColors } from '../../theme/useColors';
import ScreenHeader from '../layout/ScreenHeader';
import ProAccessNotice from '../subscription/ProAccessNotice';
import PageSafeAreaView from '../layout/PageSafeAreaView';
import Button from '../ui/Button';

/** Every Movement Lab feature route, including saved media and results.
 * A same-owner refresh keeps its child mounted; action guards still wait for
 * verification. Denial, logout or an owner switch immediately removes it. */
export default function MovementLabCreateGate({ children }: { children: ReactNode }) {
  const C = useColors();
  const access = useProAccess('movement-lab');
  const owner = useAuthStore(state => state.user?.id ?? state.offlineOwnerId);
  const knownPro = useSubscriptionStore(state => state.owner === owner && state.isPro
    && (!state.proExpiresAt || state.proExpiresAt > Date.now()));
  const refreshingKnownOwner = access.status === 'checking' && knownPro && !!captureOwnerLease(true);
  if (access.allowed || refreshingKnownOwner) return <Fragment key={owner ?? 'no-owner'}>{children}</Fragment>;
  return <PageSafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <ScreenHeader eyebrow="MOVEMENT LAB" title="Movement Lab Pro" onBack={() => router.back()} backLabel="Back to Movement Lab" />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <ProAccessNotice access={access} title="Movement Lab" />
      <Button label="Manage saved Movement Lab data" variant="secondary" onPress={() => router.push('/(tabs)/movement/data-controls' as never)} />
    </ScrollView>
  </PageSafeAreaView>;
}
