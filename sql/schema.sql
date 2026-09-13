-- Motion Supply Brand OS — secure Supabase schema (V5)
-- Fresh-install schema. RLS + grants protect user-owned data even if a client reaches the Data API.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  currency text not null default 'USD' check (char_length(currency) = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, owner_id)
);
create index if not exists brands_owner_idx on public.brands(owner_id);

create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null,
  sku text not null,
  name text not null,
  retail_price numeric(12,2) not null default 0 check (retail_price >= 0),
  landed_cost numeric(12,2) not null default 0 check (landed_cost >= 0),
  on_hand integer not null default 0 check (on_hand >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, brand_id, sku),
  constraint skus_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade
);
create index if not exists skus_brand_idx on public.skus(owner_id, brand_id);

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  name text not null check (char_length(name) between 1 and 160),
  kind text not null default 'operating',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scenarios_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade
);
create index if not exists scenarios_owner_brand_idx on public.scenarios(owner_id, brand_id);

-- Raw Shopify customer rows stay client-side. Only aggregate summaries are stored.
create table if not exists public.import_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  source text not null default 'shopify_csv',
  file_kind text not null,
  start_date text,
  end_date text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint import_summaries_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade
);
create index if not exists import_summaries_owner_idx on public.import_summaries(owner_id, brand_id);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.skus enable row level security;
alter table public.scenarios enable row level security;
alter table public.import_summaries enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "profiles own row" on public.profiles;
create policy "profiles own row" on public.profiles for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "brands own rows" on public.brands;
create policy "brands own rows" on public.brands for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "skus own rows" on public.skus;
create policy "skus own rows" on public.skus for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "scenarios own rows" on public.scenarios;
create policy "scenarios own rows" on public.scenarios for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "import summaries own rows" on public.import_summaries;
create policy "import summaries own rows" on public.import_summaries for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists "import summaries pro inserts" on public.import_summaries;
create policy "import summaries pro inserts" on public.import_summaries for insert to authenticated
with check ((select auth.uid()) = owner_id and exists (select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing')));

drop policy if exists "subscriptions readable by owner" on public.subscriptions;
create policy "subscriptions readable by owner" on public.subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

-- Tighten table grants. Server-side secret/service role bypasses RLS.
revoke all on public.profiles, public.brands, public.skus, public.scenarios, public.import_summaries, public.subscriptions from anon;
grant select, insert, update, delete on public.profiles, public.brands, public.skus, public.scenarios, public.import_summaries to authenticated;
revoke all on public.subscriptions from authenticated;
grant select on public.subscriptions to authenticated;

-- V5.5 operating memory + product analytics
create table if not exists public.business_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  data jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  constraint business_snapshots_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade
);
create index if not exists business_snapshots_owner_time_idx on public.business_snapshots(owner_id, captured_at desc);

create table if not exists public.recommendation_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  rule_key text not null check (char_length(rule_key) between 1 and 80),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  title text not null check (char_length(title) between 1 and 180),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','acted','dismissed')),
  created_at timestamptz not null default now(),
  constraint recommendation_history_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade
);
create index if not exists recommendation_history_owner_time_idx on public.recommendation_history(owner_id, created_at desc);

create table if not exists public.product_events (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  event_name text not null check (char_length(event_name) between 1 and 80),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists product_events_name_time_idx on public.product_events(event_name, created_at desc);
create index if not exists product_events_user_time_idx on public.product_events(user_id, created_at desc);

alter table public.business_snapshots enable row level security;
alter table public.recommendation_history enable row level security;
alter table public.product_events enable row level security;

drop policy if exists "snapshots own rows" on public.business_snapshots;
drop policy if exists "snapshots pro rows" on public.business_snapshots;
create policy "snapshots pro rows" on public.business_snapshots for all to authenticated
using ((select auth.uid()) = owner_id and exists (select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing')))
with check ((select auth.uid()) = owner_id and exists (select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing')));

drop policy if exists "recommendations own rows" on public.recommendation_history;
drop policy if exists "recommendations pro rows" on public.recommendation_history;
create policy "recommendations pro rows" on public.recommendation_history for all to authenticated
using ((select auth.uid()) = owner_id and exists (select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing')))
with check ((select auth.uid()) = owner_id and exists (select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','trialing')));

-- Product events are server-written only so clients cannot query other users' analytics rows.
revoke all on public.business_snapshots, public.recommendation_history, public.product_events from anon;
grant select, insert, update, delete on public.business_snapshots, public.recommendation_history to authenticated;
revoke all on public.product_events from authenticated;
