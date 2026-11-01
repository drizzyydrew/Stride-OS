-- Install transport/scheduler only. No job, HTTP call, or deletion is started.
-- Activation remains owner-allowlisted via configure_stride_deletion_automation.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
