// Single-device stores belong to the verified local data owner. Never use clear()
// or delete another owner's explicitly scoped records.
export const ACCOUNT_DATA_KEYS = [
  'achievement-store', 'action-plan-store', 'active-activity-store', 'active-indoor-ride-store-v1',
  'active-run-store-v1', 'active-strength-session-v1', 'activity-store', 'adaptation-store',
  'assessment-store', 'athlete-store', 'beginner-plan-store', 'checkin-store', 'custom-workout-store',
  'exercise-store', 'feature-tour-store', 'gear-store', 'hydration-planner-inputs', 'integrations-store',
  'mobility-store', 'movement-store', 'onboarding-store', 'periodization-store', 'profile-store',
  'readiness-store', 'recalculation-store', 'route-store', 'scheduled-session-selection-store',
  'strength-store', 'training-plan-store', 'training-preferences-store', 'voice-log-store',
  'settings-store', 'strideos-weather-cache-v1',
  'workout-store', 'workout-week-store', 'subscription-store', 'strideos-ai-sharing-v1',
  'strideos-observability-consent-v1', 'strideos-run-completion-journal-v1',
  'strideos-outdoor-end-journal-v1', 'strideos-watch-run-end-retry-v1',
  'strava_access_token', 'strava_refresh_token', 'strava_token_expiry',
] as const;

export const ACCOUNT_DOCUMENT_DIRS = ['movement-videos', 'movement-analyses', 'movement-pose'] as const;
export const ACCOUNT_CACHE_DIRS = ['movement-imports'] as const;
export const ACCOUNT_SECURE_KEYS = ['strava_access_token', 'strava_refresh_token', 'strava_token_expiry'] as const;

export function isAccountDataKey(key: string): boolean {
  return (ACCOUNT_DATA_KEYS as readonly string[]).includes(key) || key.startsWith('goal-archives:') || key.startsWith('goal-transition:');
}

export function accountCleanupKeys(keys: readonly string[], owner: string): string[] {
  if (!owner || owner.includes(':')) throw new Error('A verified cleanup owner is required');
  for (const key of keys) {
    if ((key.startsWith('goal-archives:') && key !== `goal-archives:${owner}`)
      || (key.startsWith('goal-transition:') && key !== `goal-transition:${owner}`)) {
      throw new Error('Another owner has retained records. Cleanup stopped without reassigning them.');
    }
    if (!isAccountDataKey(key) && key !== 'theme-store' && (key.includes('-store') || key.startsWith('active-'))) {
      throw new Error('An unclassified persisted record remains. Cleanup stopped without deleting it.');
    }
  }
  return keys.filter(isAccountDataKey);
}

export function accountSessionKeys(sessionKey: string | null): string[] {
  return [...ACCOUNT_SECURE_KEYS, ...(sessionKey ? [sessionKey, `${sessionKey}-user`, `${sessionKey}-code-verifier`] : [])];
}
