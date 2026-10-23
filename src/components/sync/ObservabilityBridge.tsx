import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { observabilityConsent } from '../../store/observabilityConsentStore';
import { observability } from '../../lib/observability';
import { subscribeFeatureTourEvents } from '../../utils/featureTourEvents';

export default function ObservabilityBridge() {
  useEffect(() => {
    const sync = () => {
      const auth = useAuthStore.getState();
      const consent = observabilityConsent.getState();
      const authorized = !auth.loading && auth.canAccessLocalData && auth.user?.id === consent.owner;
      observability.sync({ ...consent, ready: consent.ready && authorized });
    };
    const unsubscribe = observabilityConsent.subscribe(sync);
    sync();
    let previousOwner: string | null | undefined;
    const reconcile = () => {
      const auth = useAuthStore.getState();
      if (auth.loading) {
        sync();
        return;
      }
      const owner = auth.canAccessLocalData ? auth.user?.id ?? null : null;
      if (owner === previousOwner) { sync(); return; }
      previousOwner = owner;
      // Auth changes revoke immediately, without waiting for another React render.
      void observabilityConsent.setOwner(owner);
    };
    reconcile();
    const unsubscribeAuth = useAuthStore.subscribe(reconcile);
    return () => {
      unsubscribeAuth(); unsubscribe();
      observability.sync({ ...observabilityConsent.getState(), ready: false });
    };
  }, []);
  useEffect(() => {
    const unsubscribeTours = subscribeFeatureTourEvents(event => { observability.track(event.name, event); });
    const unsubscribeOnboarding = useOnboardingStore.subscribe((next, previous) => {
      if (next.onboardingComplete && !previous.onboardingComplete) observability.track('onboarding_completed');
    });
    return () => { unsubscribeTours(); unsubscribeOnboarding(); };
  }, []);
  return null;
}
