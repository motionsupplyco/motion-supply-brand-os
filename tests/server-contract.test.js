import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const webhookState=await readFile(new URL('../lib/stripe-webhook-state.js',import.meta.url),'utf8');
const schema=await readFile(new URL('../sql/schema.sql',import.meta.url),'utf8');
const p0=await readFile(new URL('../sql/p0_production_migration.sql',import.meta.url),'utf8');
const webhookMigration=await readFile(new URL('../sql/p0_webhook_idempotency.sql',import.meta.url),'utf8');
const deletionAuditFix=await readFile(new URL('../sql/p0_account_deletion_audit_fix.sql',import.meta.url),'utf8');
const memoryUi=await readFile(new URL('../public/business-memory-ui.js',import.meta.url),'utf8');
const accountUi=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');
const indexHtml=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const privacyHtml=await readFile(new URL('../public/privacy.html',import.meta.url),'utf8');
const termsHtml=await readFile(new URL('../public/terms.html',import.meta.url),'utf8');

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

test('Business Memory UI is wired, Pro-gated, scoped, and preserves scope after writes',()=>{
  assert.match(indexHtml,/id="memoryNav"/);
  assert.match(indexHtml,/src="business-memory-ui\.js"/);
  assert.match(memoryUi,/request\('\/api\/business-memory'\)/);
  assert.match(memoryUi,/request\('\/api\/brands'\)/);
  assert.match(memoryUi,/e\.status===402/);
  assert.match(memoryUi,/Business Memory is a Pro feature/);
  assert.match(memoryUi,/brand_id:scope\|\|null/);
  assert.match(memoryUi,/PUT',\{brand_id:scope\|\|null,value:\{text\}\}/);
  assert.match(memoryUi,/DELETE'/);
  assert.match(memoryUi,/renderBusinessMemory\(scope\)/);
  assert.match(memoryUi,/validScope=initialScope&&brands\.some/);
  assert.match(memoryUi,/Calculators should still use current inputs and imported data for math/);
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

test('Stripe subscription sync ignores events for deleted Brand OS users',()=>{
  const sync=server.match(/async function upsertSubscriptionFromStripe[\s\S]*?\n\napp\.post\('\/api\/stripe-webhook'/)?.[0]||'';
  assert.match(sync,/admin\.auth\.admin\.getUserById\(userId\)/);
  assert.match(sync,/if\(userError\|\|!userData\?\.user\)return/);
  assert.match(sync,/from\('subscriptions'\)\.upsert/);
  assert.ok(sync.indexOf('getUserById(userId)')<sync.indexOf("from('subscriptions').upsert"),'auth-user existence must be checked before subscription upsert');
});

test('account lifecycle includes user-scoped password recovery and authenticated deletion',()=>{
  assert.match(server,/app\.post\('\/api\/auth\/recover'/);
  assert.match(server,/resetPasswordForEmail/);
  const updateStart=server.indexOf("app.post('/api/auth/update-password'");
  const updateEnd=server.indexOf("app.get('/api/account'",updateStart);
  const updateRoute=updateStart>=0&&updateEnd>updateStart?server.slice(updateStart,updateEnd):'';
  assert.ok(updateRoute,'password update route must exist');
  assert.match(updateRoute,/Authorization:`Bearer \$\{token\}`/);
  assert.match(updateRoute,/userClient\.auth\.getUser\(\)/);
  assert.match(updateRoute,/userClient\.auth\.updateUser\(\{password\}\)/);
  assert.doesNotMatch(updateRoute,/admin\.auth\.admin\.updateUserById/);
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

test('legal policies are user-accessible even without external URL configuration',()=>{
  assert.match(accountUi,/config\?\.privacyUrl\|\|'\/privacy\.html'/);
  assert.match(accountUi,/config\?\.termsUrl\|\|'\/terms\.html'/);
  assert.match(privacyHtml,/<h1>Privacy Policy<\/h1>/);
  assert.match(privacyHtml,/account deletion/i);
  assert.match(termsHtml,/<h1>Terms of Service<\/h1>/);
  assert.match(termsHtml,/Paid plans/);
});

test('public config exposes legal and support destinations without secret values',()=>{
  const publicConfig=server.match(/app\.get\('\/api\/public-config',[\s\S]*?\}\)\);/)?.[0]||'';
  assert.match(publicConfig,/supportUrl:process\.env\.SUPPORT_URL/);
  assert.match(publicConfig,/privacyUrl:process\.env\.PRIVACY_URL/);
  assert.match(publicConfig,/termsUrl:process\.env\.TERMS_URL/);
  assert.doesNotMatch(publicConfig,/(?:serviceRoleKey|secretKey|webhookSecret)\s*:/i);
  assert.doesNotMatch(publicConfig,/res\.json\([^;]*(?:process\.env\.SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY|process\.env\.STRIPE_SECRET_KEY)\s*(?:[,}])/s);
});
