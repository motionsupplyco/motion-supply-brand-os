import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const helper=await readFile(new URL('../lib/stripe-customer-recovery.js',import.meta.url),'utf8');
const integration=await readFile(new URL('../lib/stripe-customer-recovery.integration.js',import.meta.url),'utf8');

test('stale recovery is limited to resource_missing or deleted customers',()=>{
  assert.match(helper,/resource_missing/);
  assert.match(helper,/customer\?\.deleted/);
  assert.match(helper,/throw error/);
});

test('recovery clears subscription identity before reconnecting',()=>{
  assert.match(helper,/stripe_customer_id:null/);
  assert.match(helper,/stripe_subscription_id:null/);
  assert.match(helper,/status:'inactive'/);
});

test('checkout and portal integration share the same verification helper',()=>{
  assert.match(integration,/verifyStripeCustomer\(stripe,customerId\)/);
  assert.match(integration,/verifyStripeCustomer\(stripe,existing\.stripe_customer_id\)/);
  assert.match(integration,/STALE_STRIPE_CUSTOMER/);
});
