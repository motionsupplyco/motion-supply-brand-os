-- Apply immediately after sql/v2_operating_intelligence_migration.sql.
-- This remains additive and is safe to run repeatedly.

alter table if exists public.sku_planning_settings
  add column if not exists manual_weekly_demand numeric(14,4)
  check (manual_weekly_demand is null or manual_weekly_demand >= 0);

comment on column public.sku_planning_settings.manual_weekly_demand is
  'Founder-entered weekly unit velocity used when no trusted synced velocity exists. Synced Shopify velocity remains an observation and does not overwrite this field.';
