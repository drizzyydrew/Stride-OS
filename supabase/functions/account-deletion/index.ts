import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { createDeletionRequestHandler } from '../_shared/launchHandlers.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const fields = 'id,requested_at,status';
Deno.serve(createDeletionRequestHandler({
  authenticate: async req => {
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },
  read: async userId => {
    const { data, error } = await admin.from('stride_account_deletion_requests').select(fields).eq('user_id', userId).maybeSingle();
    if (error) throw new Error('Request lookup failed');
    return data;
  },
  request: async userId => {
    const { error: insertError } = await admin.from('stride_account_deletion_requests').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (insertError) throw new Error('Request save failed');
    const { data, error } = await admin.from('stride_account_deletion_requests').select(fields).eq('user_id', userId).single();
    if (error || !data) throw new Error('Request confirmation failed');
    return data;
  },
}));
