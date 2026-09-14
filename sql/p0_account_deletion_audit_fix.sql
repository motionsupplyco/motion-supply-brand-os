-- Preserve account deletion lifecycle records after auth user deletion.
-- account_deletion_requests is server-only; user_id intentionally remains a plain UUID primary key.

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_user_id_fkey;

alter table public.account_deletion_requests
  add column if not exists completed_at timestamptz,
  add column if not exists failure_reason text;

comment on table public.account_deletion_requests is
  'Server-only account deletion lifecycle log retained after auth user deletion. user_id is intentionally not a foreign key so the audit row survives account removal.';
