-- Motion Supply Brand OS V2 operating-intelligence schema
-- ADDITIVE ONLY. Do not run until the V2 server/UI branch has passed CI and preview review.
-- Sensitive integration credentials remain server-only; provider tokens are encrypted before insert.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null,
  provider text not null check (provider in ('shopify','meta','tiktok','klaviyo')),
  external_account_id text,
  external_account_name text,
  status text not null default 'connected' check (status in ('connected','needs_attention','disconnected')),
  scopes text[] not null default '{}'::text[],
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade,
  unique(owner_id, brand_id, provider)
);
create index if not exists integration_connections_owner_provider_idx on public.integration_connections(owner_id, provider);

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null,
  provider text not null check (provider in ('shopify','meta','tiktok','klaviyo')),
  status text not null default 'running' check (status in ('running','completed','failed','partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_read integer not null default 0 check (records_read >= 0),
  records_written integer not null default 0 check (records_written >= 0),
  cursor text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint integration_sync_runs_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade
);
create index if not exists integration_sync_runs_owner_time_idx on public.integration_sync_runs(owner_id, started_at desc);
create index if not exists integration_sync_runs_brand_provider_idx on public.integration_sync_runs(owner_id, brand_id, provider, started_at desc);

-- Daily aggregates intentionally avoid customer PII. Null means the source did not provide a trustworthy value; zero means measured zero.
create table if not exists public.commerce_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null,
  source text not null check (source in ('shopify','meta','tiktok','klaviyo','manual')),
  snapshot_date date not null,
  currency text not null default 'USD' check (char_length(currency)=3),
  gross_sales numeric(14,2),
  net_sales numeric(14,2),
  refunds numeric(14,2),
  discounts numeric(14,2),
  shipping_collected numeric(14,2),
  taxes_collected numeric(14,2),
  order_count integer,
  units_sold integer,
  ad_spend numeric(14,2),
  attributed_revenue numeric(14,2),
  new_customers integer,
  sessions integer,
  source_payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  constraint commerce_daily_snapshots_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade,
  unique(owner_id, brand_id, source, snapshot_date)
);
create index if not exists commerce_daily_snapshots_brand_date_idx on public.commerce_daily_snapshots(owner_id, brand_id, snapshot_date desc);

create table if not exists public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null,
  source text not null check (source in ('shopify','manual')),
  sku_id uuid,
  external_variant_id text,
  sku_code text,
  product_name text,
  on_hand integer,
  available integer,
  committed integer,
  incoming integer,
  weekly_velocity numeric(14,4),
  source_payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  constraint inventory_snapshots_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade,
  constraint inventory_snapshots_sku_fk foreign key (sku_id) references public.skus(id) on delete set null
);
create index if not exists inventory_snapshots_brand_time_idx on public.inventory_snapshots(owner_id, brand_id, captured_at desc);
create index if not exists inventory_snapshots_external_idx on public.inventory_snapshots(owner_id, brand_id, source, external_variant_id, captured_at desc);

-- Founder planning inputs are kept separate from live source observations. A Shopify sync never overwrites these rules.
create table if not exists public.sku_planning_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null,
  item_key text not null check (char_length(item_key) between 1 and 220),
  sku_id uuid,
  source text not null default 'manual' check (source in ('manual','shopify')),
  external_variant_id text,
  sku_code text,
  label text,
  lead_weeks numeric(8,2) not null default 0 check (lead_weeks >= 0),
  high_weekly_demand numeric(14,4) check (high_weekly_demand is null or high_weekly_demand >= 0),
  moq integer not null default 0 check (moq >= 0),
  deposit_pct numeric(6,2) not null default 100 check (deposit_pct >= 0 and deposit_pct <= 100),
  landed_cost numeric(14,2) check (landed_cost is null or landed_cost >= 0),
  supplier_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sku_planning_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade,
  constraint sku_planning_sku_fk foreign key (sku_id) references public.skus(id) on delete set null,
  unique(owner_id, brand_id, item_key)
);
create index if not exists sku_planning_owner_brand_idx on public.sku_planning_settings(owner_id, brand_id, updated_at desc);

create table if not exists public.cash_forecasts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  name text not null default '13-week forecast' check (char_length(name) between 1 and 160),
  starting_cash numeric(14,2) not null default 0,
  protected_floor numeric(14,2) not null default 0 check (protected_floor >= 0),
  weeks jsonb not null default '[]'::jsonb,
  source_mix jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_forecasts_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade
);
create index if not exists cash_forecasts_owner_brand_idx on public.cash_forecasts(owner_id, brand_id, updated_at desc);

create table if not exists public.operating_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid,
  alert_type text not null check (char_length(alert_type) between 1 and 80),
  severity text not null check (severity in ('info','warning','critical')),
  entity_key text,
  title text not null check (char_length(title) between 1 and 220),
  detail text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint operating_alerts_brand_owner_fk foreign key (brand_id, owner_id) references public.brands(id, owner_id) on delete cascade,
  unique(owner_id, fingerprint)
);
create index if not exists operating_alerts_owner_status_idx on public.operating_alerts(owner_id, status, severity, last_seen_at desc);

-- Webhook idempotency/audit without retaining full third-party webhook payloads.
create table if not exists public.integration_webhook_events (
  provider text not null check (provider in ('shopify','meta','tiktok','klaviyo')),
  event_id text not null,
  event_type text,
  payload_sha256 text,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  attempts integer not null default 1 check (attempts >= 1),
  claimed_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_reason text,
  primary key(provider,event_id)
);

alter table public.integration_connections enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.commerce_daily_snapshots enable row level security;
alter table public.inventory_snapshots enable row level security;
alter table public.sku_planning_settings enable row level security;
alter table public.cash_forecasts enable row level security;
alter table public.operating_alerts enable row level security;
alter table public.integration_webhook_events enable row level security;

-- All V2 integration/forecast/alert tables are server-proxied. The Supabase service role performs reads/writes;
-- browser clients receive only owner-scoped API responses and can never query ciphertext/token rows directly.
revoke all on public.integration_connections,
  public.integration_sync_runs,
  public.commerce_daily_snapshots,
  public.inventory_snapshots,
  public.sku_planning_settings,
  public.cash_forecasts,
  public.operating_alerts,
  public.integration_webhook_events from anon, authenticated;

comment on table public.integration_connections is 'Server-only encrypted third-party connection records. Never return ciphertext fields to browsers.';
comment on table public.commerce_daily_snapshots is 'PII-minimized daily operating aggregates. Null means unavailable/not measured; zero means measured zero.';
comment on table public.inventory_snapshots is 'Source-aware inventory observations; does not overwrite user-maintained SKU records.';
comment on table public.sku_planning_settings is 'Founder-controlled supplier/reorder assumptions separate from synced observations.';
comment on table public.operating_alerts is 'Evidence-backed founder alerts. Alerts are recommendations/observations, not automatic purchasing actions.';
