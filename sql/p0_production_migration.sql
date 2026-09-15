-- Motion Supply Brand OS — P0 production lifecycle migration
-- Apply after v5_5_migration.sql. Idempotent where practical.

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists latest_invoice_status text;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  stripe_customer_id text,
  completed_at timestamptz,
  failure_reason text
);

create table if not exists public.business_memory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  memory_key text not null check (char_length(memory_key) between 1 and 80),
  value jsonb not null default '{}'::jsonb,
  source text not null default 'user' check (source in ('user','import','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_memory_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade
);
create index if not exists business_memory_owner_brand_idx on public.business_memory(owner_id, brand_id);
-- PostgreSQL 15+ NULLS NOT DISTINCT makes global (brand_id NULL) memory keys upsertable too.
create unique index if not exists business_memory_owner_brand_key_uidx on public.business_memory(owner_id, brand_id, memory_key) nulls not distinct;

alter table public.account_deletion_requests enable row level security;
alter table public.business_memory enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on public.account_deletion_requests, public.stripe_webhook_events from anon, authenticated;

drop policy if exists "business memory pro rows" on public.business_memory;
create policy "business memory pro rows" on public.business_memory for all to authenticated
using ((select auth.uid()) = owner_id and exists (select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing')))
with check ((select auth.uid()) = owner_id and exists (select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing')));
revoke all on public.business_memory from anon;
grant select, insert, update, delete on public.business_memory to authenticated;
