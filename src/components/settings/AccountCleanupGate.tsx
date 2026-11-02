import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as AppleAuthentication from 'expo-apple-authentication';
import { accountDeletionControl, initializeAccountDeletionControl } from '../../lib/accountDeletionControl';
import { pollAccountDeletion, refreshDeletionProviderCredentials, DeletionHttpError } from '../../lib/accountDeletion';
import { APPLE_MANUAL_REVOKE_URL } from '../../lib/accountDeletionProtocol';
import { LEGAL_URLS } from '../../utils/legal';

/** Outside navigation and recording/sync bridges. It never logs receipt state or
 * exposes the secret. Same-runtime reopening is intentionally unavailable. */
export default function AccountCleanupGate({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(accountDeletionControl.subscribe, accountDeletionControl.getSnapshot, accountDeletionControl.getSnapshot);
  const [checking, setChecking] = useState(false);
  const [repairing, setRepairing] = useState<'apple' | 'google' | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  useEffect(() => { void initializeAccountDeletionControl().catch(() => undefined); }, []);
  const pending = state.mode === 'pending' || state.mode === 'purging';
  useEffect(() => {
    if (state.mode !== 'open' && state.mode !== 'loading') void SplashScreen.hideAsync().catch(() => undefined);
  }, [state.mode]);
  useEffect(() => {
    if (!pending) return;
    try {
      const revoked = AppleAuthentication.addRevokeListener(() => { void pollAccountDeletion().catch(() => undefined); });
      return () => revoked.remove();
    } catch { return undefined; }
  }, [pending]);
  useEffect(() => {
    if (!pending) return;
    let stopped = false, active = false;
    const check = async () => {
      if (stopped || active || AppState.currentState !== 'active') return;
      active = true; setChecking(true);
      try { await pollAccountDeletion(); } catch { /* Public state carries a sanitized retry message. */ }
      finally { active = false; if (!stopped) setChecking(false); }
    };
    void check();
    const timer = setInterval(() => { void check(); }, 20_000);
    const foreground = AppState.addEventListener('change', mode => { if (mode === 'active') void check(); });
    return () => { stopped = true; clearInterval(timer); foreground.remove(); };
  }, [pending]);
  if (state.mode === 'open') return children;
  const request = state.request;
  const repair = async (provider: 'apple' | 'google') => {
    if (repairing) return;
    setRepairing(provider); setRepairError(null);
    try { await refreshDeletionProviderCredentials(provider); }
    catch (error) {
      setRepairError(error instanceof DeletionHttpError && error.status === 503
        ? 'The current worker attempt is still active. Retry status later before confirming identity again.'
        : 'Identity repair was not confirmed. Retry status first. No new receipt or deletion request has been created.');
    } finally { setRepairing(null); }
  };
  const retry = () => {
    if (checking) return;
    setChecking(true);
    const operation = state.mode === 'error' ? initializeAccountDeletionControl() : pollAccountDeletion();
    void operation.catch(() => undefined).finally(() => setChecking(false));
  };
  return <View style={{ flex: 1, backgroundColor: '#11100F', paddingTop: 64 }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
      <Text accessibilityRole="header" style={{ color: '#F4EDE5', fontSize: 26, fontWeight: '700' }}>Account deletion</Text>
      {state.mode === 'loading' ? <><ActivityIndicator color="#DCC0A7" /><Text style={{ color: '#F4EDE5' }}>Checking saved account status…</Text></> : <>
        <Text accessibilityLiveRegion="polite" style={{ color: '#F4EDE5', fontSize: 17, lineHeight: 25 }}>
          {state.mode === 'restart' ? 'Server deletion and local cleanup are verified. Close StrideOS completely and reopen it to continue. Training remains locked in this session.'
            : request?.status === 'completed' ? 'Server deletion is complete. Cleanup on this device is not yet verified. Keep this device unlocked and retry.'
              : request ? 'Your deletion request is recorded. Server deletion is not yet complete. This device retains its data until completion is verified.'
                : 'Your deletion confirmation is saved securely on this device. The server response is not yet confirmed. Retry to recover the request. This device’s data is retained until completion is verified.'}
        </Text>
        {request ? <Text selectable style={{ color: '#DCC0A7', lineHeight: 23 }}>Request reference: {request.id}</Text> : null}
        <Text style={{ color: '#B4AAA0', lineHeight: 23 }}>Apple Health and photo-library originals are not removed. Account deletion does not cancel Apple subscription renewal.</Text>
        {request?.provider_actions?.some(action => action.provider === 'apple' && action.status === 'manual_required') ? <>
          <Text style={{ color: '#F4EDE5', lineHeight: 23 }}>Your StrideOS data can be deleted even if Apple credentials were unavailable. Stop using Sign in with Apple for StrideOS in your Apple Account settings.</Text>
          <TouchableOpacity accessibilityRole="link" onPress={() => { void Linking.openURL(APPLE_MANUAL_REVOKE_URL).catch(() => undefined); }} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ color: '#DCC0A7', fontSize: 17 }}>Apple’s manual revocation instructions</Text>
          </TouchableOpacity>
        </> : null}
        {request?.provider_actions?.some(action => action.provider === 'google' && action.status === 'manual_required') ? <Text style={{ color: '#F4EDE5', lineHeight: 23 }}>Remove StrideOS access from your Google Account’s third-party connections if requested. This does not change the server data-deletion status.</Text> : null}
        {request?.provider_actions?.filter(action => action.status === 'pending').map(action => <View key={action.provider} style={{ gap: 10 }}>
          <Text style={{ color: '#F4EDE5', lineHeight: 23 }}>{action.provider === 'apple' ? 'Apple' : 'Google'} revocation is pending.
            {action.reason === 'configuration_unavailable' ? ' Server configuration needs attention; signing in again will not repair it.'
              : action.reason === 'credential_refresh_required' ? ' A fresh confirmation from this account is needed.'
                : action.reason === 'capture_in_flight' ? ' Apple sign-in is still being checked. Wait, then retry status.'
                  : action.reason === 'capture_outcome_unknown' ? ' An interrupted Apple sign-in needs support review. Deletion stays pending until its outcome is resolved; repeatedly signing in will not resolve it.'
                    : ' Retry status to resume the already-authorized processing attempt.'}
          </Text>
          {action.reason === 'capture_outcome_unknown' ? <TouchableOpacity accessibilityRole="link"
            onPress={() => { void Linking.openURL(LEGAL_URLS.support).catch(() => undefined); }} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ color: '#DCC0A7', fontSize: 17 }}>Get help with this deletion request</Text>
          </TouchableOpacity> : null}
          {action.reason === 'credential_refresh_required' ? <TouchableOpacity accessibilityRole="button" disabled={!!repairing || checking}
            onPress={() => { void repair(action.provider); }} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ color: '#DCC0A7', fontSize: 17 }}>{repairing === action.provider ? 'Confirming identity…' : `Confirm ${action.provider === 'apple' ? 'Apple' : 'Google'} identity`}</Text>
          </TouchableOpacity> : null}
        </View>)}
        {repairError ? <Text accessibilityRole="alert" style={{ color: '#F4EDE5', lineHeight: 23 }}>{repairError}</Text> : null}
        {state.error ? <Text accessibilityRole="alert" style={{ color: '#F4EDE5', lineHeight: 23 }}>{state.error}</Text> : null}
        {state.mode !== 'restart' ? <TouchableOpacity accessibilityRole="button" disabled={checking} onPress={retry} style={{ minHeight: 48, justifyContent: 'center', backgroundColor: '#3D3025', padding: 14, borderRadius: 12 }}>
          <Text style={{ color: '#F4EDE5', fontSize: 17 }}>{checking ? 'Checking…' : 'Retry status and cleanup'}</Text>
        </TouchableOpacity> : null}
      </>}
    </ScrollView>
  </View>;
}
