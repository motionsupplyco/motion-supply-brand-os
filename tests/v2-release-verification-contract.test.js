import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const verifier=await readFile(new URL('../sql/v2_operating_intelligence_verify.sql',import.meta.url),'utf8');
const checklist=await readFile(new URL('../docs/v2-production-release-checklist.md',import.meta.url),'utf8');
const expectedTables=[
  'integration_connections','integration_sync_runs','commerce_daily_snapshots','inventory_snapshots',
  'sku_planning_settings','cash_forecasts','operating_alerts','integration_webhook_events'
];

const sqlWithoutComments=verifier.replace(/^\s*--.*$/gm,'');
const sqlStatementsOnly=sqlWithoutComments.replace(/'(?:''|[^'])*'/g,"''");

test('V2 post-migration verifier is transactionally read-only',()=>{
  assert.match(verifier,/begin transaction read only;/i);
  assert.match(verifier,/rollback;/i);
  assert.doesNotMatch(sqlStatementsOnly,/\b(create|alter|drop|grant|revoke|insert|update|delete|truncate)\b/i);
});

test('V2 verifier covers every server-proxied operating table and security boundary',()=>{
  for(const table of expectedTables)assert.match(verifier,new RegExp(`['\"]${table}['\"]`),`missing verification for ${table}`);
  assert.match(verifier,/relrowsecurity/i);
  assert.match(verifier,/has_table_privilege/i);
  assert.match(verifier,/brands_id_owner_unique/i);
  assert.match(verifier,/skus_id_brand_owner_unique_index/i);
  assert.match(verifier,/brand_owner_foreign_keys/i);
  assert.match(verifier,/sku_owner_foreign_keys/i);
  assert.match(verifier,/manual_weekly_demand_column/i);
});

test('V2 release checklist keeps migration before application merge and exact-head verification explicit',()=>{
  const migration=checklist.indexOf('Apply the additive V2 database migration before merging application code');
  const merge=checklist.indexOf('Merge only the verified head');
  assert.ok(migration>=0,'release checklist must require migration before merge');
  assert.ok(merge>migration,'merge instructions must come after migration verification');
  assert.match(checklist,/exact PR head SHA/i);
  assert.match(checklist,/Do not merge if the head changes/i);
  assert.match(checklist,/Do not create fake production integration state/i);
  assert.match(checklist,/Never drop the V2 tables as an emergency first response/i);
});
