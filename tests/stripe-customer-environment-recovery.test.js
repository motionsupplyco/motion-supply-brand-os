import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const integration=await readFile(new URL('../lib/stripe-customer-recovery.integration.js',import.meta.url),'utf8');
const helper=await readFile(new URL('../lib/stripe-customer-recovery.js',import.meta.url),'utf8');

test('checkout does not blindly reuse a stale Stripe customer id',()=>{
  const start=server.indexOf("app.post('/api/create-checkout-session'");
  const end=server.indexOf("app.post('/api/create-portal-session'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'checkout route must exist');
  assert.match(route,/customerForCheckout\(\{stripe,admin,user,existing\}\)/,'checkout must delegate stored-customer validation to the recovery integration');
  assert.match(integration,/verifyStripeCustomer\(stripe,customerId\)/,'checkout integration must verify the stored customer against the configured Stripe environment');
  assert.match(helper,/resource_missing/,'recovery must recognize a Stripe customer missing from the configured environment');
  assert.match(helper,/stripe_customer_id:null/,'stale recovery must clear the invalid stored customer before replacement');
});

test('portal returns a recoverable stale-customer response instead of a generic stale-customer 500',()=>{
  const start=server.indexOf("app.post('/api/create-portal-session'");
  const end=server.indexOf("app.use('/api'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'portal route must exist');
  assert.match(route,/customerForPortal\(\{stripe,admin,user,existing\}\)/,'portal must delegate stored-customer validation to the recovery integration');
  assert.match(route,/portalCustomer\.status/,'portal must preserve the recovery status');
  assert.match(route,/portalCustomer\.code/,'portal must preserve the recovery code');
  assert.match(integration,/verifyStripeCustomer\(stripe,existing\.stripe_customer_id\)/,'portal integration must verify the stored Stripe customer');
  assert.match(integration,/STALE_STRIPE_CUSTOMER/,'portal recovery must expose a specific stale-customer code');
});
