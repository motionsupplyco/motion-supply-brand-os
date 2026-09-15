import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const accountUi=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');
const appUi=await readFile(new URL('../public/app.js',import.meta.url),'utf8');

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

test('main app preserves billing recovery state across the header flow',()=>{
  assert.match(appUi,/billingManageable:Boolean\(acct\.billingManageable\)/);
  assert.match(appUi,/\(entitlement\.active\|\|entitlement\.billingManageable\)\?'Billing':'Upgrade'/);
  assert.match(appUi,/const manage=Boolean\(entitlement\.active\|\|entitlement\.billingManageable\)/);
  assert.match(appUi,/const endpoint=manage\?'\/api\/create-portal-session':'\/api\/create-checkout-session'/);
  assert.match(appUi,/Password \(8\+ characters\)/);
  assert.doesNotMatch(appUi,/Password \(6\+ characters\)/);
});

test('account deletion cancels any non-terminal Stripe subscription state',()=>{
  const deleteStart=server.indexOf("app.delete('/api/account'");
  const deleteEnd=server.indexOf("app.get('/api/brands'",deleteStart);
  const route=deleteStart>=0&&deleteEnd>deleteStart?server.slice(deleteStart,deleteEnd):'';
  assert.ok(route,'delete account route must exist');
  assert.match(route,/if\(stripe&&hasOpenStripeSub\(sub\)\)await stripe\.subscriptions\.cancel\(sub\.stripe_subscription_id\)/);
  assert.doesNotMatch(route,/\['active','trialing','past_due','unpaid','paused'\]\.includes\(sub\.status\)/);
});

test('checkout and portal preserve a trusted preview origin on return',()=>{
  const checkoutStart=server.indexOf("app.post('/api/create-checkout-session'");
  const portalStart=server.indexOf("app.post('/api/create-portal-session'",checkoutStart);
  const routeEnd=server.indexOf("app.use('/api'",portalStart);
  const checkoutRoute=checkoutStart>=0&&portalStart>checkoutStart?server.slice(checkoutStart,portalStart):'';
  const portalRoute=portalStart>=0&&routeEnd>portalStart?server.slice(portalStart,routeEnd):'';
  assert.match(checkoutRoute,/const billingOrigin=trustedRecoveryOrigin\(req\)/);
  assert.match(checkoutRoute,/success_url:`\$\{billingOrigin\}\/\?billing=success/);
  assert.match(checkoutRoute,/cancel_url:`\$\{billingOrigin\}\/\?billing=cancel`/);
  assert.match(portalRoute,/const billingOrigin=trustedRecoveryOrigin\(req\)/);
  assert.match(portalRoute,/return_url:billingOrigin/);
});
