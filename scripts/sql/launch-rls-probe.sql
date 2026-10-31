begin;
insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f58f8a39-105d-4e63-bff6-4e692d5c9a11','launch-probe-a@invalid.example','{}','{}',now(),now()),
 ('f58f8a39-105d-4e63-bff6-4e692d5c9a12','launch-probe-b@invalid.example','{}','{}',now(),now());
do $$ declare t text; begin
  foreach t in array array['activity_logs','workout_logs','strength_logs','custom_workout_logs'] loop
    execute format('insert into public.%I(user_id,id,data) values ($1,$3,$4),($2,$3,$4)',t)
      using 'f58f8a39-105d-4e63-bff6-4e692d5c9a11'::uuid,'f58f8a39-105d-4e63-bff6-4e692d5c9a12'::uuid,'launch-rls-probe','{"synthetic":true}'::jsonb;
  end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f58f8a39-105d-4e63-bff6-4e692d5c9a11","role":"authenticated"}',true);
do $$ declare t text; n integer; begin
  select count(*) into n from public.profiles where id in ('f58f8a39-105d-4e63-bff6-4e692d5c9a11','f58f8a39-105d-4e63-bff6-4e692d5c9a12');
  if n<>1 then raise exception 'Profile isolation or signup trigger failed'; end if;
  foreach t in array array['activity_logs','workout_logs','strength_logs','custom_workout_logs'] loop
    execute format('select count(*) from public.%I where id=$1',t) into n using 'launch-rls-probe';
    if n<>1 then raise exception 'Read isolation failed for %',t; end if;
    execute format('update public.%I set data=$1 where user_id=$2 and id=$3',t)
      using '{"synthetic":true,"updated":true}'::jsonb,'f58f8a39-105d-4e63-bff6-4e692d5c9a11'::uuid,'launch-rls-probe';
    get diagnostics n = row_count;
    if n<>1 then raise exception 'Own update failed for %',t; end if;
    execute format('update public.%I set data=$1 where user_id=$2 and id=$3',t)
      using '{}'::jsonb,'f58f8a39-105d-4e63-bff6-4e692d5c9a12'::uuid,'launch-rls-probe';
    get diagnostics n = row_count;
    if n<>0 then raise exception 'Cross-account update succeeded for %',t; end if;
    begin
      execute format('insert into public.%I(user_id,id,data) values ($1,$2,$3)',t)
        using 'f58f8a39-105d-4e63-bff6-4e692d5c9a12'::uuid,'launch-rls-write-probe','{}'::jsonb;
      raise exception 'Cross-account insert succeeded for %',t;
    exception when insufficient_privilege then null;
    end;
    if has_table_privilege('authenticated',format('public.%I',t),'TRUNCATE')
      or has_table_privilege('anon',format('public.%I',t),'TRUNCATE') then raise exception 'Unsafe maintenance privilege remains for %',t; end if;
  end loop;
end $$;
reset role;
rollback;
