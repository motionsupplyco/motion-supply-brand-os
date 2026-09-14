import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const webhookState=await readFile(new URL('../lib/stripe-webhook-state.js',import.meta.url),'utf8');
const schema=await readFile(new URL('../sql/schema.sql',import.meta.url),'utf8');
const p0=await readFile(new URL('../sql/p0_production_migration.sql',import.meta.url),'utf8');
const webhookMigration=await readFile(new URL('../sql/p0_webhook_idempotency.sql',import.meta.url),'utf8');
const deletionAuditFix=await readFile(new URL('../sql/p0_account_deletion_audit_fix.sql',import.meta.url),'utf8');

test('paid cloud features have server-side entitlement enforcement',()=>{
  assert.match(server,/requireProUser\(req,res\)/);
  assert.match(server,/Free accounts can save 1 brand/);
  assert.match(server,/Free accounts can save up to 5 SKUs/);
  assert.match(server,/app\.post\('\/api\/import-summaries'.*requireProUser/s);
  assert.match(server,/app\.get\('\/api\/business-memory'.*requireProUser/s);
  assert.match(server,/app\.put\('\/api\/business-memory\/:key'.*requireProUser/s);
  assert.match(server,/app\.delete\('\/api\/business-memory\/:id'.*requireProUser/s);
});

test('operating memory and recommendation history exist in the database contract',()=>{
  assert.match(schema,/create table if not exists public\.business_snapshots/);
  assert.match(schema,/create table if not exists public\.recommendation_history/);
  assert.match(p0,/create table if not exists public\.business_memory/);
  assert.match(p0,/business memory pro rows/);
  assert.match(p0,/enable row level security/);
});

test('product analytics is server-written and has an explicit event allowlist',()=>{
  assert.match(server,/allowedEvents=new Set/);
  assert.match(server,/app\.post\('\/api\/events'/);
  assert.match(schema,/create table if not exists public\.product_events/);
  assert.match(schema,/revoke all on public\.product_events from authenticated/);
});

test('P0 billing lifecycle persists cancellation, trial, invoice, and atomic webhook idempotency state',()=>{
  assert.match(p0,/cancel_at_period_end boolean/);
  assert.match(p0,/trial_end timestamptz/);
  assert.match(p0,/latest_invoice_status text/);
  assert.match(p0,/create table if not exists public\.stripe_webhook_events/);
  assert.match(server,/invoice\.payment_failed/);
  assert.match(server,/invoice\.paid/);
  assert.match(server,/claimStripeWebhook\(admin,event\)/);
  assert.match(server,/completeStripeWebhook\(admin,event\.id\)/);
  assert.match(server,/failStripeWebhook\(admin,event\.id,e\)/);
  assert.doesNotMatch(server,/select\('event_id'\).*maybeSingle\(\).*duplicate/s);
  assert.match(webhookState,/rpc\('claim_stripe_webhook_event'/);
  assert.match(webhookState,/status:'completed'/);
  assert.match(webhookState,/status:'failed'/);
  assert.match(webhookMigration,/create or replace function public\.claim_stripe_webhook_event/);
  assert.match(webhookMigration,/on conflict \(event_id\) do nothing/);
  assert.match(webhookMigration,/revoke all on function public\.claim_stripe_webhook_event/);
  assert.match(server,/cancel_at_period_end/);
});

test('account lifecycle includes complete password recovery and authenticated deletion',()=>{
  assert.match(server,/app\.post\('\/api\/auth\/recover'/);
  assert.match(server,/resetPasswordForEmail/);
  assert.match(server,/app\.post\('\/api\/auth\/update-password'/);
  assert.match(server,/admin\.auth\.admin\.updateUserById/);
  assert.match(server,/app\.delete\('\/api\/account'/);
  assert.match(server,/admin\.auth\.admin\.deleteUser/);
  assert.match(server,/status:'completed',completed_at:new Date\(\)\.toISOString\(\)/);
  assert.match(p0,/create table if not exists public\.account_deletion_requests/);
  assert.match(deletionAuditFix,/drop constraint if exists account_deletion_requests_user_id_fkey/);
});

test('security contract includes request IDs, CSP, no-store API responses, and rate limits',()=>{
  assert.match(server,/X-Request-Id/);
  assert.match(server,/Content-Security-Policy/);
  assert.match(server,/Cache-Control','no-store/);
  assert.match(server,/const apiLimit=limiter/);
  assert.match(server,/const .*sensitiveLimit=limiter/);
  assert.match(server,/express\.json\(\{limit:'256kb'\}\)/);
});

test('public config exposes legal and support destinations without secret values',()=>{
  const publicConfig=server.match(/app\.get\('\/api\/public-config',[\s\S]*?\}\)\);/)?.[0]||'';
  assert.match(publicConfig,/supportUrl:process\.env\.SUPPORT_URL/);
  assert.match(publicConfig,/privacyUrl:process\.env\.PRIVACY_URL/);
  assert.match(publicConfig,/termsUrl:process\.env\.TERMS_URL/);
  assert.doesNotMatch(publicConfig,/(?:serviceRoleKey|secretKey|webhookSecret)\s*:/i);
  assert.doesNotMatch(publicConfig,/res\.json\([^;]*(?:process\.env\.SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY|process\.env\.STRIPE_SECRET_KEY)\s*(?:[,}])/s);
});
