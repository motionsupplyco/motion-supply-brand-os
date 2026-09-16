import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const accountUi=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');
const runbook=await readFile(new URL('../docs/STRIPE_LIFECYCLE_QA.md',import.meta.url),'utf8');

function routeBetween(startNeedle,endNeedle){
  const start=server.indexOf(startNeedle);
  const end=server.indexOf(endNeedle,start+startNeedle.length);
  assert.ok(start>=0,`missing route start: ${startNeedle}`);
  assert.ok(end>start,`missing route end after: ${startNeedle}`);
  return server.slice(start,end);
}

test('subscription webhook contract persists cancellation and renewal state',()=>{
  assert.match(server,/\['customer\.subscription\.created','customer\.subscription\.updated','customer\.subscription\.deleted'\]\.includes\(event\.type\)/);
  assert.match(server,/status:sub\.status/);
  assert.match(server,/price_id:sub\.items\?\.data\?\.\[0\]\?\.price\?\.id\|\|null/);
  assert.match(server,/current_period_end:sub\.current_period_end\?/);
  assert.match(server,/cancel_at_period_end:Boolean\(sub\.cancel_at_period_end\)/);
  assert.match(server,/canceled_at:sub\.canceled_at\?/);
  assert.match(server,/trial_end:sub\.trial_end\?/);
});

test('renewal success and payment failure refresh the current Stripe subscription',()=>{
  assert.match(server,/\['invoice\.paid','invoice\.payment_failed'\]\.includes\(event\.type\)/);
  assert.match(server,/stripe\.subscriptions\.retrieve\(event\.data\.object\.subscription\)/);
  assert.match(server,/event\.type==='invoice\.payment_failed'\?'payment_failed':'paid'/);
  assert.match(server,/latest_invoice_status=invoiceStatus/);
});

test('entitlement and portal semantics distinguish active access from manageable billing',()=>{
  assert.match(server,/const isActiveSub=sub=>Boolean\(sub&&\['active','trialing'\]\.includes\(sub\.status\)\)/);
  assert.match(server,/const hasOpenStripeSub=sub=>Boolean\(sub\?\.stripe_subscription_id&&!\['canceled','incomplete_expired'\]\.includes\(sub\.status\)\)/);
  assert.match(server,/plan:isActiveSub\(sub\)\?'pro':'free'/);
  assert.match(server,/billingManageable:hasOpenStripeSub\(access\.sub\)/);
});

test('customer portal remains the single customer-facing cancellation and payment-management surface',()=>{
  const portal=routeBetween("app.post('/api/create-portal-session'","app.use('/api'");
  assert.match(portal,/customerForPortal\(\{stripe,admin,user,existing\}\)/);
  assert.match(portal,/stripe\.billingPortal\.sessions\.create\(\{customer:portalCustomer\.customerId,return_url:billingOrigin\}\)/);
  assert.doesNotMatch(portal,/subscriptions\.cancel/);
  assert.doesNotMatch(portal,/subscriptions\.update/);
});

test('account UI exposes scheduled cancellation and payment-failure recovery state',()=>{
  assert.match(accountUi,/sub\?\.cancelAtPeriodEnd&&periodEnd/);
  assert.match(accountUi,/Cancellation scheduled\./);
  assert.match(accountUi,/Pro remains active through/);
  assert.match(accountUi,/invoiceStatus&&String\(sub\.invoiceStatus\)\.includes\('failed'\)/);
  assert.match(accountUi,/Payment needs attention\./);
  assert.match(accountUi,/Open billing to update your payment method\./);
});

test('lifecycle runbook requires live provider evidence instead of treating unit tests as Stripe QA',()=>{
  assert.match(runbook,/Customer Portal configuration/i);
  assert.match(runbook,/cancel at the end of the billing period/i);
  assert.match(runbook,/price switching/i);
  assert.match(runbook,/customer\.subscription\.updated/);
  assert.match(runbook,/customer\.subscription\.deleted/);
  assert.match(runbook,/invoice\.paid/);
  assert.match(runbook,/invoice\.payment_failed/);
  assert.match(runbook,/live provider evidence/i);
  assert.match(runbook,/do not check/i);
});
