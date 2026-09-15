import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const schema=await readFile(new URL('../sql/schema.sql',import.meta.url),'utf8');
const auditFix=await readFile(new URL('../sql/p0_account_deletion_audit_fix.sql',import.meta.url),'utf8');
const analyticsCascade=await readFile(new URL('../sql/p0_product_events_delete_cascade.sql',import.meta.url),'utf8');

test('fresh schema deletes signed-in analytics with the Auth user',()=>{
  const productEvents=schema.match(/create table if not exists public\.product_events[\s\S]*?\);/)?.[0]||'';
  assert.ok(productEvents,'product_events table must exist');
  assert.match(productEvents,/user_id uuid references auth\.users\(id\) on delete cascade/);
  assert.doesNotMatch(productEvents,/on delete set null/);
});

test('older databases have an explicit analytics cascade upgrade',()=>{
  assert.match(analyticsCascade,/drop constraint if exists product_events_user_id_fkey/);
  assert.match(analyticsCascade,/references auth\.users\(id\) on delete cascade/);
});

test('deletion audit intentionally survives Auth user deletion',()=>{
  assert.match(auditFix,/drop constraint if exists account_deletion_requests_user_id_fkey/);
  assert.match(auditFix,/completed_at timestamptz/);
  assert.match(auditFix,/failure_reason text/);
});

test('server cancels billing before deleting the Auth user',()=>{
  const start=server.indexOf("app.delete('/api/account'");
  const end=server.indexOf("app.get('/api/brands'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'delete route must exist');
  const cancelAt=route.indexOf('stripe.subscriptions.cancel');
  const deleteAt=route.indexOf('admin.auth.admin.deleteUser');
  assert.ok(cancelAt>=0&&deleteAt>=0&&cancelAt<deleteAt,'Stripe subscription must be canceled before deleting the Auth user');
});
