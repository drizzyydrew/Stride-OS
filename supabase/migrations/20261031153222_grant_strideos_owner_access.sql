-- RLS ownership checks already exist; table grants must allow the intended
-- owner operations without granting RLS-bypassing maintenance privileges.
revoke all on public.profiles, public.activity_logs, public.workout_logs,
  public.strength_logs, public.custom_workout_logs, public.daily_check_ins
  from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.activity_logs,
  public.workout_logs, public.strength_logs, public.custom_workout_logs,
  public.daily_check_ins to authenticated, service_role;

revoke truncate, references, trigger on public.movement_videos,
  public.analysis_requests from anon, authenticated;
