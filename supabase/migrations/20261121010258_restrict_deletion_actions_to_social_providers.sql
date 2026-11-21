-- Email identities have no OAuth provider action. Keep the worker plan contract
-- social-only while preserving every Apple capture/revocation guard.
-- CREATE OR REPLACE preserves the existing function owner and ACL; no account,
-- scheduler, public deletion activation, grants or RLS policy changes occur.
create or replace function stride_deletion_private.provider_actions(request_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('provider',p,
    'status',case when p='apple' and exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=r.user_id and i.state in ('reserved','uncertain')) then 'pending'
      when s.dispositions->>p in ('revoked','manual_required') then s.dispositions->>p else 'pending' end,
    'reason',case when p='apple' and exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=r.user_id and i.state='uncertain') then 'capture_outcome_unknown'
      when p='apple' and exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=r.user_id and i.state='reserved') then 'capture_in_flight'
      else coalesce(s.reasons->>p,'not_prepared') end) order by p),'[]'::jsonb)
  from stride_deletion_private.request_state s join public.stride_account_deletion_requests r on r.id=s.request_id,
    lateral (select unnest(s.providers) p union select i.provider from auth.identities i where i.user_id=r.user_id) providers
  where s.request_id=$1 and p in ('apple','google')
$$;
