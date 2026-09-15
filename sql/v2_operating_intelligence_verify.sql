-- Motion Supply Brand OS V2 post-migration verification
-- READ ONLY. This file does not create, alter, grant, revoke, update, or delete anything.
-- Run after both V2 migration files and before merging the V2 application release.

begin transaction read only;

-- 1) Every expected V2 table must exist.
with expected(table_name) as (
  values
    ('integration_connections'),
    ('integration_sync_runs'),
    ('commerce_daily_snapshots'),
    ('inventory_snapshots'),
    ('sku_planning_settings'),
    ('cash_forecasts'),
    ('operating_alerts'),
    ('integration_webhook_events')
)
select
  'tables_exist' as check_name,
  bool_and(to_regclass('public.' || table_name) is not null) as passed,
  array_agg(table_name order by table_name) filter (where to_regclass('public.' || table_name) is null) as missing
from expected;

-- 2) RLS must be enabled on every V2 table.
with expected(table_name) as (
  values
    ('integration_connections'),
    ('integration_sync_runs'),
    ('commerce_daily_snapshots'),
    ('inventory_snapshots'),
    ('sku_planning_settings'),
    ('cash_forecasts'),
    ('operating_alerts'),
    ('integration_webhook_events')
), state as (
  select e.table_name, coalesce(c.relrowsecurity,false) as rls_enabled
  from expected e
  left join pg_namespace n on n.nspname='public'
  left join pg_class c on c.relnamespace=n.oid and c.relname=e.table_name and c.relkind='r'
)
select
  'rls_enabled' as check_name,
  bool_and(rls_enabled) as passed,
  array_agg(table_name order by table_name) filter (where not rls_enabled) as failing_tables
from state;

-- 3) Browser roles must have no effective direct table privileges on V2 server-proxied tables.
with expected(table_name) as (
  values
    ('integration_connections'),
    ('integration_sync_runs'),
    ('commerce_daily_snapshots'),
    ('inventory_snapshots'),
    ('sku_planning_settings'),
    ('cash_forecasts'),
    ('operating_alerts'),
    ('integration_webhook_events')
), roles(role_name) as (
  values ('anon'),('authenticated')
), privileges(privilege_name) as (
  values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')
), leaked as (
  select r.role_name,e.table_name,p.privilege_name
  from expected e
  cross join roles r
  cross join privileges p
  where to_regclass('public.' || e.table_name) is not null
    and has_table_privilege(r.role_name,'public.' || quote_ident(e.table_name),p.privilege_name)
)
select
  'browser_direct_privileges_revoked' as check_name,
  not exists(select 1 from leaked) as passed,
  coalesce(jsonb_agg(jsonb_build_object('role',role_name,'table',table_name,'privilege',privilege_name)),'[]'::jsonb) as unexpected_privileges
from leaked;

-- 4) Existing ownership keys required by V2 must exist.
select
  'brands_id_owner_unique' as check_name,
  exists(
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace n on n.oid=rel.relnamespace
    where n.nspname='public'
      and rel.relname='brands'
      and con.contype in ('p','u')
      and pg_get_constraintdef(con.oid) ilike '%UNIQUE (id, owner_id)%'
  ) as passed;

select
  'skus_primary_key' as check_name,
  exists(
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace n on n.oid=rel.relnamespace
    where n.nspname='public'
      and rel.relname='skus'
      and con.contype='p'
      and pg_get_constraintdef(con.oid) ilike '%PRIMARY KEY (id)%'
  ) as passed;

select
  'skus_id_brand_owner_unique_index' as check_name,
  to_regclass('public.skus_id_brand_owner_key') is not null as passed;

-- 5) Brand ownership FKs must bind brand_id + owner_id together.
with expected(conname) as (
  values
    ('integration_connections_brand_owner_fk'),
    ('integration_sync_runs_brand_owner_fk'),
    ('commerce_daily_snapshots_brand_owner_fk'),
    ('inventory_snapshots_brand_owner_fk'),
    ('sku_planning_brand_owner_fk'),
    ('cash_forecasts_brand_owner_fk'),
    ('operating_alerts_brand_owner_fk')
), actual as (
  select con.conname,pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class rel on rel.oid=con.conrelid
  join pg_namespace n on n.oid=rel.relnamespace
  where n.nspname='public' and con.contype='f'
)
select
  'brand_owner_foreign_keys' as check_name,
  bool_and(coalesce(a.definition ilike '%FOREIGN KEY (brand_id, owner_id) REFERENCES brands(id, owner_id)%',false)) as passed,
  array_agg(e.conname order by e.conname) filter (where a.conname is null or a.definition not ilike '%FOREIGN KEY (brand_id, owner_id) REFERENCES brands(id, owner_id)%') as failing_constraints
from expected e
left join actual a using(conname);

-- 6) Optional SKU references must prove sku + brand + owner together.
with expected(conname) as (
  values
    ('inventory_snapshots_sku_owner_fk'),
    ('sku_planning_sku_owner_fk')
), actual as (
  select con.conname,pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class rel on rel.oid=con.conrelid
  join pg_namespace n on n.oid=rel.relnamespace
  where n.nspname='public' and con.contype='f'
)
select
  'sku_owner_foreign_keys' as check_name,
  bool_and(coalesce(a.definition ilike '%FOREIGN KEY (sku_id, brand_id, owner_id) REFERENCES skus(id, brand_id, owner_id)%',false)) as passed,
  array_agg(e.conname order by e.conname) filter (where a.conname is null or a.definition not ilike '%FOREIGN KEY (sku_id, brand_id, owner_id) REFERENCES skus(id, brand_id, owner_id)%') as failing_constraints
from expected e
left join actual a using(conname);

-- 7) Founder-entered weekly demand must be available in the base planning table.
select
  'manual_weekly_demand_column' as check_name,
  exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='sku_planning_settings'
      and column_name='manual_weekly_demand'
  ) as passed;

rollback;
