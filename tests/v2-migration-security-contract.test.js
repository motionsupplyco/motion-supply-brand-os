import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../sql/v2_operating_intelligence_migration.sql',import.meta.url),'utf8');
const planningExtension=await readFile(new URL('../sql/v2_planning_velocity_extension.sql',import.meta.url),'utf8');

const tables=['integration_connections','integration_sync_runs','commerce_daily_snapshots','inventory_snapshots','sku_planning_settings','cash_forecasts','operating_alerts','integration_webhook_events'];

test('V2 migration keeps browser roles out of server-proxied operating tables',()=>{
  for(const table of tables){
    assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`,'i'));
  }
  assert.match(migration,/revoke all on public\.integration_connections[\s\S]*from anon, authenticated/i);
});

test('brand-scoped V2 rows prove brand ownership through the existing brands composite key',()=>{
  const constraints=[
    'integration_connections_brand_owner_fk',
    'integration_sync_runs_brand_owner_fk',
    'commerce_daily_snapshots_brand_owner_fk',
    'inventory_snapshots_brand_owner_fk',
    'sku_planning_brand_owner_fk',
    'cash_forecasts_brand_owner_fk',
    'operating_alerts_brand_owner_fk'
  ];
  for(const name of constraints){
    assert.match(migration,new RegExp(`constraint ${name} foreign key \\(brand_id, owner_id\\) references public\\.brands\\(id, owner_id\\)`,'i'));
  }
});

test('optional SKU references are constrained to the same brand and owner',()=>{
  assert.match(migration,/create unique index if not exists skus_id_brand_owner_key on public\.skus\(id, brand_id, owner_id\)/i);
  assert.match(migration,/inventory_snapshots_sku_owner_fk foreign key \(sku_id, brand_id, owner_id\) references public\.skus\(id, brand_id, owner_id\)/i);
  assert.match(migration,/sku_planning_sku_owner_fk foreign key \(sku_id, brand_id, owner_id\) references public\.skus\(id, brand_id, owner_id\)/i);
  assert.doesNotMatch(migration,/foreign key \(sku_id\) references public\.skus\(id\)/i);
});

test('founder manual velocity exists in the base migration and the extension remains repeat-safe',()=>{
  assert.match(migration,/manual_weekly_demand numeric\(14,4\)/i);
  assert.match(planningExtension,/add column if not exists manual_weekly_demand numeric\(14,4\)/i);
});

test('integration token material remains named as ciphertext and customer PII columns are absent',()=>{
  assert.match(migration,/access_token_ciphertext text/i);
  assert.match(migration,/refresh_token_ciphertext text/i);
  for(const forbidden of ['customer_email','email_address','customer_name','first_name','last_name','phone','shipping_address','billing_address']){
    assert.doesNotMatch(migration,new RegExp(`\\b${forbidden}\\b`,'i'));
  }
});
