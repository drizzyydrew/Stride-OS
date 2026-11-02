-- Main's deployed metadata: both tables owned by postgres; no PUBLIC ACL.
-- anon/authenticated: MAINTAIN only. service_role: MAINTAIN, REFERENCES,
-- TRIGGER, TRUNCATE only. These are unused legacy maintenance grants, not
-- evidence of customer-row exposure. No CRUD grant, policy or record changes.
-- One statement is atomic even if the executor supplies no outer transaction.
do $legacy_maintenance$
declare
  relation_name text;
  relation_oid oid;
  role_name text;
  privilege_name text;
begin
  if pg_catalog.current_setting('server_version_num')::integer < 170000 then
    raise exception 'Legacy MAINTAIN cleanup requires PostgreSQL 17 or later';
  end if;
  perform pg_catalog.set_config('lock_timeout','2s',true);
  lock table public.movement_videos, public.analysis_requests in share row exclusive mode;

  -- Fail on replacement/non-RLS tables, API ownership, or grant-option drift.
  -- Missing direct grants are harmless: the migration is deliberately rerunnable.
  foreach relation_name in array array['public.movement_videos','public.analysis_requests'] loop
    relation_oid:=pg_catalog.to_regclass(relation_name);
    if not exists(select 1 from pg_catalog.pg_class c where c.oid=relation_oid
      and c.relkind='r' and c.relrowsecurity
      and c.relowner='postgres'::regrole::oid) then
      raise exception 'Legacy relation owner/type/RLS drift: %',relation_name;
    end if;
    -- PostgreSQL table REFERENCES revocation also removes matching column
    -- grants. Refuse unexpected column ACLs rather than changing unseen scope.
    if exists(select 1 from pg_catalog.pg_attribute c,
      lateral pg_catalog.aclexplode(c.attacl) a
      where c.attrelid=relation_oid and c.attnum>0 and not c.attisdropped
        and a.grantee in (0::oid,'anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid)
        and a.privilege_type='REFERENCES') then
      raise exception 'Legacy column REFERENCES maintenance drift: %',relation_name;
    end if;
    if exists(select 1 from pg_catalog.pg_class c,
      lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
      where c.oid=relation_oid and a.grantee in (0::oid,'anon'::regrole::oid,
        'authenticated'::regrole::oid,'service_role'::regrole::oid)
        and a.privilege_type in ('MAINTAIN','REFERENCES','TRIGGER','TRUNCATE') and a.is_grantable) then
      raise exception 'Legacy maintenance grant-option drift: %',relation_name;
    end if;
  end loop;

  -- Exact two-table, maintenance-only change; RESTRICT never cascades grants.
  revoke maintain, references, trigger, truncate on table
    public.movement_videos, public.analysis_requests
    from public, anon, authenticated, service_role restrict;

  -- Revoking direct grants cannot erase ownership or inherited access.
  -- Detect surviving effective rights and roll back ALL changes rather than
  -- changing any other role, membership, column grant or table.
  foreach relation_name in array array['public.movement_videos','public.analysis_requests'] loop
    relation_oid:=pg_catalog.to_regclass(relation_name);
    foreach role_name in array array['anon','authenticated','service_role'] loop
      foreach privilege_name in array array['MAINTAIN','REFERENCES','TRIGGER','TRUNCATE'] loop
        if pg_catalog.has_table_privilege(role_name,relation_oid,privilege_name)
          or (privilege_name='REFERENCES' and pg_catalog.has_any_column_privilege(role_name,relation_oid,'REFERENCES')) then
          raise exception 'Legacy maintenance access survives direct REVOKE: % % %',relation_name,role_name,privilege_name;
        end if;
      end loop;
    end loop;
  end loop;
end;
$legacy_maintenance$;
