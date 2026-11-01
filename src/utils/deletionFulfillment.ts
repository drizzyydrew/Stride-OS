export type DeletionPlan = {
  request_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed';
  auth_user_exists: boolean;
  record_counts: Record<string, number>;
  storage_paths: string[];
  unsafe_storage_objects: number;
  shared_auth_tables: string[];
  identity_providers: string[];
  fulfillment_version?: 0 | 1;
  provider_actions?: { provider: string; status: 'pending' | 'revoked' | 'manual_required'; reason: string }[];
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DELETION_TABLES = ['profiles', 'activity_logs', 'workout_logs', 'strength_logs', 'custom_workout_logs', 'daily_check_ins', 'movement_videos', 'analysis_requests'] as const;

export function validateDeletionPlan(value: unknown, requestId: string): DeletionPlan {
  const p = value as DeletionPlan;
  if (!p || !UUID.test(requestId) || p.request_id !== requestId || !UUID.test(p.user_id)
    || !['pending', 'processing', 'completed'].includes(p.status) || typeof p.auth_user_exists !== 'boolean'
    || !Number.isSafeInteger(p.unsafe_storage_objects) || p.unsafe_storage_objects < 0
    || !p.record_counts || Object.keys(p.record_counts).length !== DELETION_TABLES.length
    || !DELETION_TABLES.every(table => Number.isSafeInteger(p.record_counts[table]) && p.record_counts[table] >= 0)
    || !Array.isArray(p.storage_paths) || !p.storage_paths.every(path => typeof path === 'string'
      && path.startsWith(`${p.user_id}/`) && !path.split('/').some(part => part === '..' || part === '.' || !part))
    || !Array.isArray(p.shared_auth_tables) || !p.shared_auth_tables.every(table => typeof table === 'string')
    || !Array.isArray(p.identity_providers) || !p.identity_providers.every(provider => typeof provider === 'string')
    || (p.fulfillment_version !== undefined && ![0, 1].includes(p.fulfillment_version))
    || (p.provider_actions !== undefined && (!Array.isArray(p.provider_actions)
      || p.provider_actions.length > 2 || new Set(p.provider_actions.map(a => a?.provider)).size !== p.provider_actions.length
      || !p.provider_actions.every(a => a && ['apple', 'google'].includes(a.provider)
        && ['pending', 'revoked', 'manual_required'].includes(a.status)
        && typeof a.reason === 'string' && a.reason.length <= 100)))) {
    throw new Error('Invalid deletion plan; no operation is authorized.');
  }
  return p;
}

function staticBlockers(plan: DeletionPlan): string[] {
  const blockers: string[] = [];
  if (plan.shared_auth_tables.length) blockers.push('Shared authentication must be isolated from other applications first.');
  if (plan.unsafe_storage_objects) blockers.push('Objects outside the StrideOS owner prefix need review.');
  if (plan.identity_providers.some(provider => !['email', 'apple', 'google'].includes(provider))) blockers.push('An unsupported identity provider needs review.');
  if (!plan.auth_user_exists && plan.status === 'pending') blockers.push('A pending request has no verifiable Auth account.');
  return blockers;
}

export function deletionBlockers(plan: DeletionPlan): string[] {
  const blockers = staticBlockers(plan);
  if (plan.identity_providers.some(provider => provider !== 'email' && !(plan.fulfillment_version === 1
    && plan.provider_actions?.some(action => action.provider === provider
      && ((action.status === 'revoked' && action.reason === 'provider_confirmed')
        || (action.status === 'manual_required' && action.reason === 'legacy_token_unavailable')))))) {
    blockers.push('Social-provider disconnection is not yet confirmed.');
  }
  return blockers;
}

export async function fulfillDeletion(requestId: string, deps: {
  plan(requestId: string): Promise<unknown>;
  claim(requestId: string): Promise<string>;
  assertLease(requestId: string, token: string): Promise<void>;
  prepareProviders?(requestId: string, token: string): Promise<void>;
  revokeSessions?(userId: string): Promise<void>;
  removeObjects(paths: string[]): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
  complete(requestId: string, token: string): Promise<void>;
}, execute = false) {
  if (!UUID.test(requestId)) throw new Error('A valid deletion receipt is required.');
  const plan = validateDeletionPlan(await deps.plan(requestId), requestId);
  const blockers = deletionBlockers(plan);
  if (!execute) return { mode: 'dry-run' as const, plan, blockers, complete: false };
  const canPrepare = plan.fulfillment_version === 1 && !!deps.prepareProviders;
  if ((canPrepare ? staticBlockers(plan) : blockers).length) throw new Error(blockers.join(' '));
  if (plan.status === 'completed') {
    if (plan.auth_user_exists || plan.storage_paths.length || Object.values(plan.record_counts).some(count => count !== 0)) {
      throw new Error('Stored completion status disagrees with remaining account data.');
    }
    return { mode: 'execute' as const, plan, blockers, complete: true };
  }
  const token = await deps.claim(requestId);
  if (!UUID.test(token)) throw new Error('Deletion lease was not confirmed.');
  // Re-read after claiming: the database lease is the source of authority.
  let claimed = validateDeletionPlan(await deps.plan(requestId), requestId);
  if (claimed.user_id !== plan.user_id || claimed.status !== 'processing' || staticBlockers(claimed).length
    || claimed.fulfillment_version !== plan.fulfillment_version) {
    throw new Error('Deletion ownership or prerequisites changed.');
  }
  if (canPrepare) {
    await deps.assertLease(requestId, token);
    await deps.prepareProviders!(requestId, token);
    claimed = validateDeletionPlan(await deps.plan(requestId), requestId);
  }
  if (claimed.user_id !== plan.user_id || claimed.status !== 'processing' || deletionBlockers(claimed).length) {
    throw new Error('Provider disconnection is not yet confirmed.');
  }
  if (claimed.auth_user_exists && deps.revokeSessions) {
    await deps.assertLease(requestId, token);
    await deps.revokeSessions(plan.user_id);
  }
  for (let i = 0; i < claimed.storage_paths.length; i += 100) {
    await deps.assertLease(requestId, token);
    await deps.removeObjects(claimed.storage_paths.slice(i, i + 100));
  }
  const cleaned = validateDeletionPlan(await deps.plan(requestId), requestId);
  if (cleaned.user_id !== plan.user_id || cleaned.status !== 'processing' || deletionBlockers(cleaned).length || cleaned.storage_paths.length) {
    throw new Error('Storage removal or ownership could not be verified. Auth account retained.');
  }
  await deps.assertLease(requestId, token);
  if (cleaned.auth_user_exists) await deps.deleteAuthUser(plan.user_id);
  const verified = validateDeletionPlan(await deps.plan(requestId), requestId);
  if (verified.user_id !== plan.user_id || verified.status !== 'processing' || verified.auth_user_exists
    || verified.storage_paths.length || verified.unsafe_storage_objects
    || Object.values(verified.record_counts).some(count => count !== 0)) throw new Error('Account removal is not yet verified. Request remains processing.');
  await deps.complete(requestId, token);
  return { mode: 'execute' as const, plan: verified, blockers: [], complete: true };
}
