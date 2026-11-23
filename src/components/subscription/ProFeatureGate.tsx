import { Fragment, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useProAccess } from '../../hooks/useProAccess';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { captureOwnerLease } from '../../lib/localDataOwner';
import { useColors } from '../../theme/useColors';
import type { ProFeature } from '../../utils/pro-access';
import ScreenHeader from '../layout/ScreenHeader';
import ProAccessNotice from './ProAccessNotice';

/** A route/deep-link boundary. Individual saves must also recheck access. */
export default function ProFeatureGate({ feature, title, children }: { feature: ProFeature; title: string; children: ReactNode }) {
  const C = useColors();
  const access = useProAccess(feature);
  const owner = useAuthStore(state => state.user?.id ?? state.offlineOwnerId);
  const knownPro = useSubscriptionStore(state => state.owner === owner && state.isPro
    && (!state.proExpiresAt || state.proExpiresAt > Date.now()));
  const sameOwnerRefresh = access.status === 'checking' && knownPro && !!captureOwnerLease(true);
  if (access.allowed || sameOwnerRefresh) return <Fragment key={owner ?? 'no-owner'}>{children}</Fragment>;
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScreenHeader eyebrow="STRIDEOS PRO" title={title} onBack={() => router.back()} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <ProAccessNotice access={access} title={title} />
    </ScrollView>
  </View>;
}
