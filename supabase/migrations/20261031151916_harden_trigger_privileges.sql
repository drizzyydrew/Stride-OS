-- Trigger bodies already qualify their application tables. Lock lookup paths
-- and remove direct API execution without changing their trigger behavior.
alter function public.handle_new_user() set search_path = pg_catalog;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.rls_auto_enable() to service_role;

create policy stride_coach_usage_service_only on public.stride_coach_usage
  for all to service_role using (true) with check (true);
