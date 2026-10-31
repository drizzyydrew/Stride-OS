import { createClient } from '@supabase/supabase-js';
import { fulfillDeletion } from '../src/utils/deletionFulfillment';

async function main() {
  const args = process.argv.slice(2);
  const requestId = args.find(arg => !arg.startsWith('--'));
  const execute = args.includes('--execute');
  if (!requestId || args.some(arg => arg.startsWith('--') && !['--execute', '--dry-run'].includes(arg))
    || (execute && args.includes('--dry-run'))) throw new Error('Usage: npx tsx scripts/process-account-deletion.ts REQUEST_UUID [--dry-run|--execute]');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !url.startsWith('https://') || process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Provide SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY through a secure operator environment.');
  }
  if (execute && process.env.STRIDEOS_DELETION_CONFIRM_REQUEST !== requestId) {
    throw new Error('Execution requires STRIDEOS_DELETION_CONFIRM_REQUEST to match the exact requested receipt UUID.');
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  async function rpc(name: string, body: Record<string, string>) {
    const { data, error } = await admin.rpc(name, body);
    if (error) throw new Error('The deletion database operation failed. Keep the request pending and investigate through restricted logs.');
    return data;
  }
  const result = await fulfillDeletion(requestId, {
    plan: id => rpc('stride_deletion_plan', { request_id: id }),
    claim: id => rpc('claim_stride_deletion', { request_id: id }),
    assertLease: async (id, token) => {
      if (await rpc('renew_stride_deletion', { request_id: id, claim_token: token }) !== true) throw new Error('Deletion lease is no longer valid.');
    },
    removeObjects: async paths => {
      const { error } = await admin.storage.from('movement-videos').remove(paths);
      if (error) throw new Error('Storage removal failed; Auth account retained.');
    },
    deleteAuthUser: async userId => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error('Auth deletion failed. Request remains processing; do not mark complete.');
    },
    complete: async (id, token) => {
      if (await rpc('complete_stride_deletion', { request_id: id, claim_token: token }) !== true) throw new Error('Completion receipt was not confirmed.');
    },
  }, execute);
  // Do not print user IDs, object paths, records, credentials or provider tokens.
  console.log(JSON.stringify({ request: requestId, mode: result.mode, complete: result.complete,
    blockers: result.blockers, recordCounts: result.plan.record_counts, storageObjects: result.plan.storage_paths.length }, null, 2));
  if (result.blockers.length) process.exitCode = 2;
}
main().catch(() => {
  console.error('Deletion was not confirmed. Verify secure configuration and prerequisites; do not mark the request complete.');
  process.exitCode = 1;
});
