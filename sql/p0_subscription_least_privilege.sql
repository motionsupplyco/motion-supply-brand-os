-- P0: subscription state is authoritative billing data.
-- Authenticated users may read their own row through RLS, but all writes stay server-side.

revoke insert, update, delete, truncate, references, trigger
  on table public.subscriptions
  from authenticated;

revoke all on table public.subscriptions from anon;

grant select on table public.subscriptions to authenticated;
