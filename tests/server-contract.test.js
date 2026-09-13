import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const schema=await readFile(new URL('../sql/schema.sql',import.meta.url),'utf8');

test('paid cloud features have server-side entitlement enforcement',()=>{
  assert.match(server,/requireProUser\(req,res\)/);
  assert.match(server,/Free accounts can save 1 brand/);
  assert.match(server,/Free accounts can save up to 5 SKUs/);
  assert.match(server,/app\.post\('\/api\/import-summaries'.*requireProUser/s);
});

test('business memory and recommendation history exist in the database contract',()=>{
  assert.match(schema,/create table if not exists public\.business_snapshots/);
  assert.match(schema,/create table if not exists public\.recommendation_history/);
  assert.match(schema,/enable row level security/);
});

test('product analytics is server-written and has an explicit event allowlist',()=>{
  assert.match(server,/allowedEvents=new Set/);
  assert.match(server,/app\.post\('\/api\/events'/);
  assert.match(schema,/create table if not exists public\.product_events/);
  assert.match(schema,/revoke all on public\.product_events from authenticated/);
});
