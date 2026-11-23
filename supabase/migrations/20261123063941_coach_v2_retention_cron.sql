-- Independent content retention cleanup; no HTTP credential or email delivery.
-- Generation and pack-sales flags do not disable cleanup of existing replies.
select cron.schedule(
  'stride-coach-v2-retention',
  '* * * * *',
  'select public.stride_coach_v2_purge();'
);
