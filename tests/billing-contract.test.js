import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const accountUi=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');

test('payment failure webhooks persist an explicit UI-visible failure state',()=>{
  assert.match(server,/\['invoice\.paid','invoice\.payment_failed'\]\.includes\(event\.type\)/);
  assert.match(server,/event\.type==='invoice\.payment_failed'\?'payment_failed':'paid'/);
  assert.match(accountUi,/invoiceStatus.*includes\('failed'\)/s);
  assert.match(accountUi,/Payment needs attention/);
});

test('existing Stripe subscriptions go to recovery instead of duplicate checkout',()=>{
  assert.match(server,/const hasOpenStripeSub=sub=>Boolean\(sub\?\.stripe_subscription_id&&!\['canceled','incomplete_expired'\]\.includes\(sub\.status\)\)/);
  assert.match(server,/billingManageable:hasOpenStripeSub\(access\.sub\)/);
  const checkoutStart=server.indexOf("app.post('/api/create-checkout-session'");
  const portalStart=server.indexOf("app.post('/api/create-portal-session'",checkoutStart);
  const route=checkoutStart>=0&&portalStart>checkoutStart?server.slice(checkoutStart,portalStart):'';
  assert.ok(route,'checkout route must exist');
  assert.match(route,/BILLING_RECOVERY_REQUIRED/);
  assert.ok(route.indexOf('BILLING_RECOVERY_REQUIRED')<route.indexOf('stripe.checkout.sessions.create'),'recovery guard must run before checkout creation');
  assert.match(accountUi,/const manageBilling=Boolean\(account\.active\|\|account\.billingManageable\)/);
  assert.match(accountUi,/manageBilling\?'Manage billing':'Upgrade to Pro'/);
  assert.match(accountUi,/openBilling\(manageBilling\)/);
});
