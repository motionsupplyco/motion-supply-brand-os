import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const dataApi=await readFile(new URL('../sql/p0_server_only_data_api.sql',import.meta.url),'utf8');

test('browser CSP only permits same-origin network connections',()=>{
  const middleware=server.match(/Content-Security-Policy',[\s\S]*?next\(\)\}\);/)?.[0]||'';
  assert.ok(middleware,'security header middleware must exist');
  assert.match(middleware,/connect-src 'self';/);
  assert.doesNotMatch(middleware,/connect-src[^;]*supabase\.co/);
  assert.match(middleware,/frame-ancestors 'none'/);
  assert.match(middleware,/base-uri 'self'/);
  assert.match(middleware,/form-action 'self'/);
});

test('application tables are removed from direct browser Data API access',()=>{
  for(const table of ['profiles','brands','skus','scenarios','import_summaries','subscriptions','product_events','business_snapshots','recommendation_history','business_memory','account_deletion_requests','stripe_webhook_events']){
    assert.match(dataApi,new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }
  assert.match(dataApi,/alter default privileges in schema public revoke all on tables from anon, authenticated/);
});
