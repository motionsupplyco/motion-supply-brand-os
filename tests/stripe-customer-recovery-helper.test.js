import test from 'node:test';
import assert from 'node:assert/strict';
import {isStripeResourceMissing,verifyStripeCustomer} from '../lib/stripe-customer-recovery.js';

test('recognizes Stripe resource_missing errors',()=>{
  assert.equal(isStripeResourceMissing({code:'resource_missing'}),true);
  assert.equal(isStripeResourceMissing({raw:{code:'resource_missing'}}),true);
  assert.equal(isStripeResourceMissing({code:'api_error'}),false);
});

test('verifies a customer that exists in the configured Stripe environment',async()=>{
  const stripe={customers:{retrieve:async id=>({id,email:'owner@example.com'})}};
  const result=await verifyStripeCustomer(stripe,'cus_live');
  assert.equal(result.valid,true);
  assert.equal(result.customer.id,'cus_live');
});

test('treats resource_missing as a stale customer instead of throwing',async()=>{
  const stripe={customers:{retrieve:async()=>{const e=new Error('No such customer');e.code='resource_missing';throw e}}};
  const result=await verifyStripeCustomer(stripe,'cus_from_other_environment');
  assert.equal(result.valid,false);
  assert.equal(result.missing,true);
});

test('does not swallow unrelated Stripe failures',async()=>{
  const stripe={customers:{retrieve:async()=>{const e=new Error('Stripe unavailable');e.code='api_error';throw e}}};
  await assert.rejects(()=>verifyStripeCustomer(stripe,'cus_live'),/Stripe unavailable/);
});
